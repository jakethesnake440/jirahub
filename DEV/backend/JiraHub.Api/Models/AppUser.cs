namespace JiraHub.Api.Models;

public class AppUser
{
    public int UserId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Role { get; set; } = "END USER";
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // === Authentication fields ===
    public string? PasswordHash { get; set; }
    public bool MustChangePassword { get; set; } = true;

    // === Navigation property (required by EF Core) ===
    public ICollection<TicketComment> Comments { get; set; } = new List<TicketComment>();
}
