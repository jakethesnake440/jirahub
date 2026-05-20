using System.Globalization;
using CsvHelper;
using CsvHelper.Configuration;
using JiraHub.Api.Data;
using JiraHub.Api.DTOs;
using JiraHub.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace JiraHub.Api.Services;

public class CsvTicketImportService
{
    private readonly JiraHubDbContext _db;

    public CsvTicketImportService(JiraHubDbContext db)
    {
        _db = db;
    }

    public async Task<ImportResultDto> ImportAsync(IFormFile file, string? uploadedBy, CancellationToken cancellationToken)
    {
        if (file.Length == 0)
            throw new InvalidOperationException("Uploaded file is empty.");

        var batch = new ImportBatch
        {
            FileName = file.FileName,
            UploadedBy = uploadedBy,
            UploadedAt = DateTime.UtcNow
        };

        _db.ImportBatches.Add(batch);
        await _db.SaveChangesAsync(cancellationToken);

        var errors = new List<string>();

        await using var stream = file.OpenReadStream();
        using var reader = new StreamReader(stream);

        var raw = await reader.ReadToEndAsync(cancellationToken);
        raw = raw.TrimStart('\uFEFF');

        if (raw.StartsWith("ListSchema=", StringComparison.OrdinalIgnoreCase))
        {
            var firstNewLine = raw.IndexOf('\n');
            if (firstNewLine >= 0)
                raw = raw[(firstNewLine + 1)..];
        }

        using var stringReader = new StringReader(raw);

        var config = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HasHeaderRecord = true,
            BadDataFound = null,
            MissingFieldFound = null,
            HeaderValidated = null,
            TrimOptions = TrimOptions.Trim,
            DetectDelimiter = true,
            IgnoreBlankLines = true
        };

        using var csv = new CsvReader(stringReader, config);
        await csv.ReadAsync();
        csv.ReadHeader();

        var headers = csv.HeaderRecord ?? Array.Empty<string>();
        var required = new[] { "Title", "Platform", "Version Found", "Build Fixed", "Functionality", "Issue Title", "Summary", "Internal Comments" };
        var missing = required.Where(h => !headers.Any(x => string.Equals(x, h, StringComparison.OrdinalIgnoreCase))).ToList();
        if (missing.Any())
            throw new InvalidOperationException($"Missing required CSV columns: {string.Join(", ", missing)}");

        var existingByKey = await _db.Tickets
            .AsTracking()
            .ToDictionaryAsync(x => x.TicketKey, StringComparer.OrdinalIgnoreCase, cancellationToken);

        var rowNumber = 1;
        while (await csv.ReadAsync())
        {
            rowNumber++;
            try
            {
                batch.TotalRows++;

                var ticketKey = GetField(csv, "Title");
                if (string.IsNullOrWhiteSpace(ticketKey))
                {
                    batch.SkippedRows++;
                    continue;
                }

                ticketKey = ticketKey.Trim();

                var platform = EmptyToNull(GetField(csv, "Platform"));
                var versionFound = EmptyToNull(GetField(csv, "Version Found"));
                var buildFixed = EmptyToNull(GetField(csv, "Build Fixed"));
                var functionality = EmptyToNull(GetField(csv, "Functionality"));
                var issueTitle = EmptyToNull(GetField(csv, "Issue Title"));
                var summary = EmptyToNull(GetField(csv, "Summary"));
                var internalComments = EmptyToNull(GetField(csv, "Internal Comments"));

                if (existingByKey.TryGetValue(ticketKey, out var existing))
                {
                    existing.Platform = platform;
                    existing.VersionFound = versionFound;
                    existing.BuildFixed = buildFixed;
                    existing.Functionality = functionality;
                    existing.IssueTitle = issueTitle;
                    existing.Summary = summary;
                    existing.SourceInternalComments = internalComments;
                    existing.LastImportedAt = DateTime.UtcNow;
                    existing.UpdatedAt = DateTime.UtcNow;
                    batch.UpdatedRows++;
                }
                else
                {
                    var ticket = new Ticket
                    {
                        TicketKey = ticketKey,
                        Platform = platform,
                        VersionFound = versionFound,
                        BuildFixed = buildFixed,
                        Functionality = functionality,
                        IssueTitle = issueTitle,
                        Summary = summary,
                        SourceInternalComments = internalComments,
                        LastImportedAt = DateTime.UtcNow,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };

                    _db.Tickets.Add(ticket);
                    existingByKey[ticketKey] = ticket;
                    batch.InsertedRows++;
                }
            }
            catch (Exception ex)
            {
                batch.ErrorRows++;
                var message = $"Row {rowNumber}: {ex.Message}";
                errors.Add(message);
                batch.Errors.Add(new ImportBatchError
                {
                    RowNumber = rowNumber,
                    ErrorMessage = ex.Message,
                    RawRow = csv.Context.Parser?.RawRecord
                });
            }
        }

        await _db.SaveChangesAsync(cancellationToken);

        return new ImportResultDto(
            batch.ImportBatchId,
            batch.FileName,
            batch.TotalRows,
            batch.InsertedRows,
            batch.UpdatedRows,
            batch.SkippedRows,
            batch.ErrorRows,
            batch.UploadedAt,
            errors.Take(50).ToList()
        );
    }

    private static string? GetField(CsvReader csv, string name)
    {
        try
        {
            return csv.GetField(name);
        }
        catch
        {
            return null;
        }
    }

    private static string? EmptyToNull(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
