namespace JiraHub.Api.Models;

public class Ticket
{
    public int TicketId { get; set; }
    public string TicketKey { get; set; } = string.Empty;
    public string? Platform { get; set; }
    public string? VersionFound { get; set; }
    public string? BuildFixed { get; set; }
    public string? Functionality { get; set; }
    public string? IssueTitle { get; set; }
    public string? Summary { get; set; }
    public string? SourceInternalComments { get; set; }
    public DateTime LastImportedAt { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<TicketComment> Comments { get; set; } = new List<TicketComment>();
}
