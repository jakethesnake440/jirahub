namespace JiraHub.Api.DTOs;

public record UserDto(int UserId, string DisplayName, string? Email, string Username, string Role, bool IsActive);

public record CreateUserRequest(string DisplayName, string? Email, string Username, string Role = "END USER");

public record UpdateUserRoleRequest(string Role);
