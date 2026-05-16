using System.Text.RegularExpressions;
using JiraHub.Api.Data;
using JiraHub.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace JiraHub.Api.Services;

public partial class MentionService
{
    private readonly JiraHubDbContext _db;

    public MentionService(JiraHubDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<TicketCommentMention>> BuildMentionsAsync(int commentId, string commentText, CancellationToken cancellationToken)
    {
        var usernames = UsernameRegex()
            .Matches(commentText)
            .Select(m => m.Groups[1].Value.Trim())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (!usernames.Any())
            return Array.Empty<TicketCommentMention>();

        var users = await _db.AppUsers
            .Where(u => u.IsActive && usernames.Contains(u.Username))
            .ToListAsync(cancellationToken);

        return users
            .Select(u => new TicketCommentMention
            {
                CommentId = commentId,
                MentionedUserId = u.UserId
            })
            .ToList();
    }

    [GeneratedRegex("@([a-zA-Z0-9_.-]+)")]
    private static partial Regex UsernameRegex();
}
