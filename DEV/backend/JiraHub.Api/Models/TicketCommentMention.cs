namespace JiraHub.Api.Models;

public class TicketCommentMention
{
    public int MentionId { get; set; }
    public int CommentId { get; set; }
    public TicketComment Comment { get; set; } = null!;
    public int MentionedUserId { get; set; }
    public AppUser MentionedUser { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
