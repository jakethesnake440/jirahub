namespace JiraHub.Api.Models;

public class TicketComment
{
    public int CommentId { get; set; }
    public int TicketId { get; set; }
    public Ticket Ticket { get; set; } = null!;

    public string CommentText { get; set; } = string.Empty;
    public string? CommentHtml { get; set; }
    public string? CommentAuthorContact { get; set; }
    public int? CreatedByUserId { get; set; }
    public AppUser? CreatedByUser { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; }
    public bool IsPinned { get; set; }

    public ICollection<TicketCommentMention> Mentions { get; set; } = new List<TicketCommentMention>();
}
