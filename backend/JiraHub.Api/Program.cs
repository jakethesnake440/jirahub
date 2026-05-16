using System.Text.RegularExpressions;
using JiraHub.Api.Data;
using JiraHub.Api.DTOs;
using JiraHub.Api.Models;
using JiraHub.Api.Services;
using Microsoft.EntityFrameworkCore;

const string RoleAdmin = "ADMIN";

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<JiraHubDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddScoped<CsvTicketImportService>();
builder.Services.AddScoped<MentionService>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173", "http://127.0.0.1:5173", "https://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<JiraHubDbContext>();
    db.Database.EnsureCreated();
    EnsurePerformanceIndexes(db);
    NormalizeExistingRoles(db);

    if (!db.AppUsers.Any())
    {
        db.AppUsers.Add(new AppUser
        {
            DisplayName = "Local Admin",
            Email = "local.admin@example.com",
            Username = "admin",
            Role = RoleAdmin,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        });
        db.SaveChanges();
    }

    if (!db.AppUsers.Any(u => u.Role == RoleAdmin && u.IsActive))
    {
        var firstUser = db.AppUsers.OrderBy(u => u.UserId).FirstOrDefault();
        if (firstUser is not null)
        {
            firstUser.Role = RoleAdmin;
            firstUser.IsActive = true;
            db.SaveChanges();
        }
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("Frontend");

app.MapGet("/api/health", () => Results.Ok(new { status = "ok", app = "JIRA Hub", utc = DateTime.UtcNow }));

app.MapGet("/api/metadata", async (JiraHubDbContext db, CancellationToken ct) =>
{
    var totalTickets = await db.Tickets.CountAsync(ct);
    var inProcess = await db.Tickets.CountAsync(t => t.BuildFixed != null && t.BuildFixed.Contains("IN PROCESS"), ct);
    var withComments = await db.Tickets.CountAsync(t => t.Comments.Any(c => !c.IsDeleted), ct);

    async Task<List<string>> DistinctValues(IQueryable<string?> query) =>
        await query
            .Where(x => x != null && x != "")
            .Distinct()
            .Select(x => x!)
            .Take(1000)
            .ToListAsync(ct);

    var platforms = (await DistinctValues(db.Tickets.Select(t => t.Platform)))
        .OrderBy(x => x)
        .ToList();

    var functionalities = (await DistinctValues(db.Tickets.Select(t => t.Functionality)))
        .OrderBy(x => x)
        .ToList();

    var buildFixedValues = (await DistinctValues(db.Tickets.Select(t => t.BuildFixed)))
        .Select(NormalizeBuildForDisplay)
        .Where(x => !string.IsNullOrWhiteSpace(x))
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .OrderBy(BuildSortBucket)
        .ThenByDescending(BuildSortKey)
        .ThenBy(x => x)
        .ToList();

    var versionFoundValues = (await DistinctValues(db.Tickets.Select(t => t.VersionFound)))
        .OrderBy(BuildSortBucket)
        .ThenByDescending(BuildSortKey)
        .ThenBy(x => x)
        .ToList();

    return Results.Ok(new MetadataDto(
        totalTickets,
        inProcess,
        withComments,
        platforms,
        functionalities,
        buildFixedValues,
        versionFoundValues
    ));
});

app.MapGet("/api/tickets", async (
    JiraHubDbContext db,
    string? search,
    string? platform,
    string? platforms,
    string? functionality,
    string? functionalities,
    string? buildFixed,
    string? buildFixedValues,
    string? versionFound,
    string? versionFoundValues,
    bool? hasComments,
    bool? inProcess,
    string? sort,
    int page = 1,
    int pageSize = 25,
    CancellationToken ct = default) =>
{
    page = Math.Max(1, page);
    pageSize = Math.Clamp(pageSize, 10, 100);

    var query = db.Tickets.AsNoTracking();
    var searchTerms = ParseSearchTerms(search);
    var trimmedSearch = search?.Trim() ?? string.Empty;

    foreach (var term in searchTerms)
    {
        var like = $"%{term}%";
        query = query.Where(t =>
            EF.Functions.Like(t.TicketKey, like) ||
            (t.Platform != null && EF.Functions.Like(t.Platform, like)) ||
            (t.VersionFound != null && EF.Functions.Like(t.VersionFound, like)) ||
            (t.BuildFixed != null && EF.Functions.Like(t.BuildFixed, like)) ||
            (t.Functionality != null && EF.Functions.Like(t.Functionality, like)) ||
            (t.IssueTitle != null && EF.Functions.Like(t.IssueTitle, like)) ||
            (t.Summary != null && EF.Functions.Like(t.Summary, like)) ||
            (t.SourceInternalComments != null && EF.Functions.Like(t.SourceInternalComments, like)) ||
            t.Comments.Any(c => !c.IsDeleted &&
                (EF.Functions.Like(c.CommentText, like) ||
                 (c.CreatedByUser != null && EF.Functions.Like(c.CreatedByUser.DisplayName, like)) ||
                 (c.CreatedByUser != null && EF.Functions.Like(c.CreatedByUser.Username, like)) ||
                 c.Mentions.Any(m =>
                    EF.Functions.Like(m.MentionedUser.DisplayName, like) ||
                    EF.Functions.Like(m.MentionedUser.Username, like)
                 )
                )
            )
        );
    }

    var platformFilters = ParseFilterValues(CombineFilters(platform, platforms));
    if (platformFilters.Count > 0)
        query = query.Where(t => t.Platform != null && platformFilters.Contains(t.Platform));

    var functionalityFilters = ParseFilterValues(CombineFilters(functionality, functionalities));
    if (functionalityFilters.Count > 0)
        query = query.Where(t => t.Functionality != null && functionalityFilters.Contains(t.Functionality));

    var versionFilters = ParseFilterValues(CombineFilters(versionFound, versionFoundValues));
    if (versionFilters.Count > 0)
        query = query.Where(t => t.VersionFound != null && versionFilters.Contains(t.VersionFound));

    var buildFilters = ParseFilterValues(CombineFilters(buildFixed, buildFixedValues));
    if (buildFilters.Count > 0)
    {
        var rawBuildFilters = buildFilters
            .SelectMany(BuildFilterCandidates)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        query = query.Where(t => t.BuildFixed != null && rawBuildFilters.Contains(t.BuildFixed));
    }

    if (inProcess.HasValue)
    {
        query = inProcess.Value
            ? query.Where(t => t.BuildFixed != null && t.BuildFixed.Contains("IN PROCESS"))
            : query.Where(t => t.BuildFixed == null || !t.BuildFixed.Contains("IN PROCESS"));
    }

    if (hasComments.HasValue)
        query = hasComments.Value
            ? query.Where(t => t.Comments.Any(c => !c.IsDeleted))
            : query.Where(t => !t.Comments.Any(c => !c.IsDeleted));

    var rawItems = await query
        .Select(t => new
        {
            t.TicketId,
            t.TicketKey,
            t.Platform,
            t.VersionFound,
            t.BuildFixed,
            t.Functionality,
            t.IssueTitle,
            t.Summary,
            CommentCount = t.Comments.Count(c => !c.IsDeleted),
            LatestCommentPreview = t.Comments
                .Where(c => !c.IsDeleted)
                .OrderByDescending(c => c.CreatedAt)
                .Select(c => c.CommentText)
                .FirstOrDefault(),
            t.LastImportedAt,
            t.UpdatedAt
        })
        .ToListAsync(ct);

    var items = rawItems
        .Select(t => new TicketListItemDto(
            t.TicketId,
            t.TicketKey,
            t.Platform,
            t.VersionFound,
            NormalizeBuildForDisplay(t.BuildFixed),
            t.Functionality,
            t.IssueTitle,
            t.Summary,
            t.CommentCount,
            t.LatestCommentPreview,
            t.LastImportedAt,
            t.UpdatedAt
        ))
        .ToList();

    items = OrderTickets(items, sort, searchTerms, trimmedSearch).ToList();

    var total = items.Count;
    var paged = items
        .Skip((page - 1) * pageSize)
        .Take(pageSize)
        .ToList();

    return Results.Ok(new SearchResultDto<TicketListItemDto>(
        paged,
        page,
        pageSize,
        total,
        (int)Math.Ceiling(total / (double)pageSize)
    ));
});

app.MapGet("/api/tickets/{ticketKey}", async (string ticketKey, JiraHubDbContext db, CancellationToken ct) =>
{
    var ticket = await db.Tickets
        .AsNoTracking()
        .Include(t => t.Comments.Where(c => !c.IsDeleted))
            .ThenInclude(c => c.CreatedByUser)
        .Include(t => t.Comments.Where(c => !c.IsDeleted))
            .ThenInclude(c => c.Mentions)
                .ThenInclude(m => m.MentionedUser)
        .FirstOrDefaultAsync(t => t.TicketKey == ticketKey, ct);

    if (ticket is null)
        return Results.NotFound();

    var dto = new TicketDetailDto(
        ticket.TicketId,
        ticket.TicketKey,
        ticket.Platform,
        ticket.VersionFound,
        ticket.BuildFixed,
        ticket.Functionality,
        ticket.IssueTitle,
        ticket.Summary,
        ticket.SourceInternalComments,
        ticket.LastImportedAt,
        ticket.CreatedAt,
        ticket.UpdatedAt,
        ticket.Comments
            .OrderByDescending(c => c.IsPinned)
            .ThenByDescending(c => c.CreatedAt)
            .Select(c => new CommentDto(
                c.CommentId,
                c.CommentText,
                c.CreatedByUserId,
                c.CreatedByUser?.DisplayName,
                c.CreatedByUser?.Username,
                c.CreatedAt,
                c.UpdatedAt,
                c.IsPinned,
                c.Mentions.Select(m => new MentionDto(
                    m.MentionedUser.UserId,
                    m.MentionedUser.DisplayName,
                    m.MentionedUser.Username,
                    m.MentionedUser.Email
                )).ToList()
            ))
            .ToList()
    );

    return Results.Ok(dto);
});

app.MapPost("/api/tickets/{ticketKey}/comments", async (
    string ticketKey,
    CreateCommentRequest request,
    JiraHubDbContext db,
    MentionService mentionService,
    CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(request.CommentText))
        return Results.BadRequest(new { message = "Comment text is required." });

    var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.TicketKey == ticketKey, ct);
    if (ticket is null)
        return Results.NotFound(new { message = "Ticket not found." });

    if (request.CreatedByUserId.HasValue)
    {
        var userExists = await db.AppUsers.AnyAsync(u => u.UserId == request.CreatedByUserId.Value && u.IsActive, ct);
        if (!userExists)
            return Results.BadRequest(new { message = "CreatedByUserId does not match an active user." });
    }

    var comment = new TicketComment
    {
        TicketId = ticket.TicketId,
        CommentText = request.CommentText.Trim(),
        CreatedByUserId = request.CreatedByUserId,
        IsPinned = request.IsPinned,
        CreatedAt = DateTime.UtcNow
    };

    db.TicketComments.Add(comment);
    await db.SaveChangesAsync(ct);

    var mentions = await mentionService.BuildMentionsAsync(comment.CommentId, comment.CommentText, ct);
    foreach (var mention in mentions)
        db.TicketCommentMentions.Add(mention);

    ticket.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync(ct);

    return Results.Created($"/api/tickets/{ticketKey}", new { comment.CommentId, mentions = mentions.Count });
});

app.MapPut("/api/comments/{commentId:int}", async (
    int commentId,
    UpdateCommentRequest request,
    JiraHubDbContext db,
    MentionService mentionService,
    CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(request.CommentText))
        return Results.BadRequest(new { message = "Comment text is required." });

    var comment = await db.TicketComments
        .Include(c => c.Ticket)
        .Include(c => c.Mentions)
        .FirstOrDefaultAsync(c => c.CommentId == commentId && !c.IsDeleted, ct);

    if (comment is null)
        return Results.NotFound(new { message = "Comment not found." });

    if (!await CanModifyCommentAsync(comment, request.UpdatedByUserId, db, ct))
        return Results.Forbid();

    comment.CommentText = request.CommentText.Trim();
    comment.UpdatedAt = DateTime.UtcNow;
    comment.Ticket.UpdatedAt = DateTime.UtcNow;

    db.TicketCommentMentions.RemoveRange(comment.Mentions);
    await db.SaveChangesAsync(ct);

    var mentions = await mentionService.BuildMentionsAsync(comment.CommentId, comment.CommentText, ct);
    foreach (var mention in mentions)
        db.TicketCommentMentions.Add(mention);

    await db.SaveChangesAsync(ct);
    return Results.Ok(new { comment.CommentId, mentions = mentions.Count });
});

app.MapDelete("/api/comments/{commentId:int}", async (int commentId, int? deletedByUserId, JiraHubDbContext db, CancellationToken ct) =>
{
    var comment = await db.TicketComments
        .Include(c => c.Ticket)
        .FirstOrDefaultAsync(c => c.CommentId == commentId && !c.IsDeleted, ct);

    if (comment is null)
        return Results.NotFound();

    if (!await CanModifyCommentAsync(comment, deletedByUserId, db, ct))
        return Results.Forbid();

    comment.IsDeleted = true;
    comment.UpdatedAt = DateTime.UtcNow;
    comment.Ticket.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync(ct);
    return Results.NoContent();
});

app.MapGet("/api/users", async (JiraHubDbContext db, string? search, CancellationToken ct) =>
{
    var query = db.AppUsers.AsNoTracking();

    if (!string.IsNullOrWhiteSpace(search))
    {
        var like = $"%{search.Trim()}%";
        query = query.Where(u =>
            EF.Functions.Like(u.DisplayName, like) ||
            EF.Functions.Like(u.Username, like) ||
            (u.Email != null && EF.Functions.Like(u.Email, like)) ||
            EF.Functions.Like(u.Role, like)
        );
    }

    var users = await query
        .OrderByDescending(u => u.Role == RoleAdmin)
        .ThenBy(u => u.DisplayName)
        .Take(100)
        .Select(u => new UserDto(u.UserId, u.DisplayName, u.Email, u.Username, u.Role, u.IsActive))
        .ToListAsync(ct);

    return Results.Ok(users);
});

app.MapPost("/api/users", async (CreateUserRequest request, JiraHubDbContext db, CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(request.DisplayName))
        return Results.BadRequest(new { message = "Display name is required." });

    if (string.IsNullOrWhiteSpace(request.Username))
        return Results.BadRequest(new { message = "Username is required." });

    var username = request.Username.Trim().TrimStart('@').ToLowerInvariant();
    var exists = await db.AppUsers.AnyAsync(u => u.Username == username, ct);
    if (exists)
        return Results.Conflict(new { message = "Username already exists." });

    var user = new AppUser
    {
        DisplayName = request.DisplayName.Trim(),
        Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim(),
        Username = username,
        Role = NormalizeRole(request.Role),
        IsActive = true,
        CreatedAt = DateTime.UtcNow
    };

    db.AppUsers.Add(user);
    await db.SaveChangesAsync(ct);

    return Results.Created($"/api/users/{user.UserId}", new UserDto(user.UserId, user.DisplayName, user.Email, user.Username, user.Role, user.IsActive));
});

app.MapPut("/api/users/{userId:int}/role", async (int userId, UpdateUserRoleRequest request, JiraHubDbContext db, CancellationToken ct) =>
{
    var user = await db.AppUsers.FirstOrDefaultAsync(u => u.UserId == userId, ct);
    if (user is null)
        return Results.NotFound(new { message = "User not found." });

    user.Role = NormalizeRole(request.Role);
    await db.SaveChangesAsync(ct);

    return Results.Ok(new UserDto(user.UserId, user.DisplayName, user.Email, user.Username, user.Role, user.IsActive));
});

app.MapPost("/api/admin/import", async (
    IFormFile file,
    string? uploadedBy,
    CsvTicketImportService importService,
    CancellationToken ct) =>
{
    if (!file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
        return Results.BadRequest(new { message = "v1 supports CSV files only." });

    var result = await importService.ImportAsync(file, uploadedBy, ct);
    return Results.Ok(result);
}).DisableAntiforgery();

app.MapGet("/api/admin/imports", async (JiraHubDbContext db, CancellationToken ct) =>
{
    var imports = await db.ImportBatches
        .AsNoTracking()
        .OrderByDescending(i => i.UploadedAt)
        .Take(25)
        .Select(i => new ImportBatchDto(
            i.ImportBatchId,
            i.FileName,
            i.UploadedAt,
            i.TotalRows,
            i.InsertedRows,
            i.UpdatedRows,
            i.SkippedRows,
            i.ErrorRows
        ))
        .ToListAsync(ct);

    return Results.Ok(imports);
});

app.Run();

static List<string> ParseSearchTerms(string? search)
{
    if (string.IsNullOrWhiteSpace(search))
        return [];

    return search
        .Trim()
        .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Where(term => term.Length > 0)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .Take(10)
        .ToList();
}

static string? CombineFilters(params string?[] values)
{
    var parts = values
        .Where(x => !string.IsNullOrWhiteSpace(x))
        .Select(x => x!.Trim())
        .ToList();

    return parts.Count == 0 ? null : string.Join("|", parts);
}

static List<string> ParseFilterValues(string? value)
{
    if (string.IsNullOrWhiteSpace(value))
        return [];

    return value
        .Split(new[] { '|', ';', ',' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Where(x => !string.IsNullOrWhiteSpace(x))
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToList();
}

static IEnumerable<string> BuildFilterCandidates(string value)
{
    var normalized = NormalizeBuildForDisplay(value) ?? value;
    yield return normalized;

    if (Regex.IsMatch(normalized, @"^\d+(\.\d+)+$"))
        yield return normalized + ".1000";

    if (value.EndsWith(".1000", StringComparison.OrdinalIgnoreCase))
        yield return value;
}

static string? NormalizeBuildForDisplay(string? value)
{
    if (string.IsNullOrWhiteSpace(value))
        return value;

    var trimmed = value.Trim();
    return Regex.IsMatch(trimmed, @"^\d+(\.\d+)+\.1000$")
        ? trimmed[..^5]
        : trimmed;
}

static int BuildSortBucket(string? value)
{
    var parts = ParseBuildParts(value);
    if (parts.Count == 0)
        return 2;

    return parts[0] >= 21 ? 0 : 1;
}

static string BuildSortKey(string? value)
{
    var parts = ParseBuildParts(value);
    if (parts.Count == 0)
        return "0000.0000.0000.0000";

    return string.Join('.', parts.Take(4).Select(x => x.ToString("D4")));
}

static List<int> ParseBuildParts(string? value)
{
    var normalized = NormalizeBuildForDisplay(value);
    if (string.IsNullOrWhiteSpace(normalized))
        return [];

    var match = Regex.Match(normalized, @"\d+(?:\.\d+)+");
    if (!match.Success)
        return [];

    return match.Value
        .Split('.')
        .Select(part => int.TryParse(part, out var number) ? number : 0)
        .ToList();
}

static IEnumerable<TicketListItemDto> OrderTickets(List<TicketListItemDto> items, string? sort, List<string> searchTerms, string trimmedSearch)
{
    var selectedSort = string.IsNullOrWhiteSpace(sort) ? "relevance" : sort.Trim();

    return selectedSort switch
    {
        "updatedAsc" => items.OrderBy(t => t.UpdatedAt).ThenBy(t => t.TicketKey),
        "updatedDesc" => items.OrderByDescending(t => t.UpdatedAt).ThenBy(t => t.TicketKey),
        "importedAsc" => items.OrderBy(t => t.LastImportedAt).ThenBy(t => t.TicketKey),
        "importedDesc" => items.OrderByDescending(t => t.LastImportedAt).ThenBy(t => t.TicketKey),
        "keyAsc" => items.OrderBy(t => t.TicketKey),
        "keyDesc" => items.OrderByDescending(t => t.TicketKey),
        "buildAsc" => items.OrderBy(t => BuildSortBucket(t.BuildFixed)).ThenBy(t => BuildSortKey(t.BuildFixed)).ThenBy(t => t.TicketKey),
        "buildDesc" => items.OrderBy(t => BuildSortBucket(t.BuildFixed)).ThenByDescending(t => BuildSortKey(t.BuildFixed)).ThenBy(t => t.TicketKey),
        "commentsDesc" => items.OrderByDescending(t => t.CommentCount).ThenByDescending(t => t.UpdatedAt),
        "platformAsc" => items.OrderBy(t => t.Platform ?? "~").ThenBy(t => t.TicketKey),
        "functionalityAsc" => items.OrderBy(t => t.Functionality ?? "~").ThenBy(t => t.TicketKey),
        _ => searchTerms.Count > 0
            ? items.OrderByDescending(t => ScoreSearchResult(t, searchTerms, trimmedSearch)).ThenByDescending(t => t.UpdatedAt).ThenBy(t => t.TicketKey)
            : items.OrderByDescending(t => t.UpdatedAt).ThenBy(t => t.TicketKey)
    };
}

static int ScoreSearchResult(TicketListItemDto ticket, List<string> terms, string exact)
{
    if (terms.Count == 0)
        return 0;

    var score = 0;
    if (!string.IsNullOrWhiteSpace(exact))
    {
        if (string.Equals(ticket.TicketKey, exact, StringComparison.OrdinalIgnoreCase))
            score += 1000;
        if (ticket.TicketKey.StartsWith(exact, StringComparison.OrdinalIgnoreCase))
            score += 700;
    }

    foreach (var term in terms)
    {
        score += Contains(ticket.TicketKey, term) ? 100 : 0;
        score += Contains(ticket.IssueTitle, term) ? 75 : 0;
        score += Contains(ticket.Summary, term) ? 45 : 0;
        score += Contains(ticket.LatestCommentPreview, term) ? 40 : 0;
        score += Contains(ticket.Functionality, term) ? 25 : 0;
        score += Contains(ticket.Platform, term) ? 20 : 0;
        score += Contains(ticket.BuildFixed, term) ? 20 : 0;
        score += Contains(ticket.VersionFound, term) ? 15 : 0;
    }

    if (ticket.CommentCount > 0)
        score += 5;

    return score;

    static bool Contains(string? value, string term) =>
        !string.IsNullOrWhiteSpace(value) && value.Contains(term, StringComparison.OrdinalIgnoreCase);
}

static string NormalizeRole(string? role)
{
    var value = (role ?? string.Empty).Trim().ToUpperInvariant();
    return value switch
    {
        "ADMIN" or "ADMINISTRATOR" => "ADMIN",
        "END USER" or "ENDUSER" or "USER" or "STANDARD USER" or "READ ONLY" => "END USER",
        _ => "END USER"
    };
}

static void NormalizeExistingRoles(JiraHubDbContext db)
{
    var users = db.AppUsers.ToList();
    foreach (var user in users)
    {
        var normalized = NormalizeRole(user.Role);
        if (user.Role != normalized)
            user.Role = normalized;
    }

    if (users.Count > 0)
        db.SaveChanges();
}

static async Task<bool> CanModifyCommentAsync(TicketComment comment, int? actingUserId, JiraHubDbContext db, CancellationToken ct)
{
    if (!actingUserId.HasValue)
        return comment.CreatedByUserId is null;

    var user = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == actingUserId.Value && u.IsActive, ct);
    if (user is null)
        return false;

    if (user.Role == RoleAdmin)
        return true;

    return comment.CreatedByUserId == user.UserId;
}

static void EnsurePerformanceIndexes(JiraHubDbContext db)
{
    var statements = new[]
    {
        "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TicketComments_TicketId_IsDeleted_CreatedAt' AND object_id = OBJECT_ID('dbo.TicketComments')) CREATE INDEX IX_TicketComments_TicketId_IsDeleted_CreatedAt ON dbo.TicketComments (TicketId, IsDeleted, CreatedAt DESC)",
        "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tickets_UpdatedAt' AND object_id = OBJECT_ID('dbo.Tickets')) CREATE INDEX IX_Tickets_UpdatedAt ON dbo.Tickets (UpdatedAt DESC)",
        "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tickets_BuildFixed_UpdatedAt' AND object_id = OBJECT_ID('dbo.Tickets')) CREATE INDEX IX_Tickets_BuildFixed_UpdatedAt ON dbo.Tickets (BuildFixed, UpdatedAt DESC)",
        "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AppUsers_Role' AND object_id = OBJECT_ID('dbo.AppUsers')) CREATE INDEX IX_AppUsers_Role ON dbo.AppUsers (Role)",
        "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TicketCommentMentions_MentionedUserId' AND object_id = OBJECT_ID('dbo.TicketCommentMentions')) CREATE INDEX IX_TicketCommentMentions_MentionedUserId ON dbo.TicketCommentMentions (MentionedUserId)"
    };

    foreach (var statement in statements)
    {
        try
        {
            db.Database.ExecuteSqlRaw(statement);
        }
        catch
        {
            // Index creation is a performance enhancement only. The app should still start if this fails.
        }
    }
}
