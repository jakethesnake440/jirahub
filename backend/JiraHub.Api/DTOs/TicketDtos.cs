namespace JiraHub.Api.DTOs;

public record TicketListItemDto(
    int TicketId,
    string TicketKey,
    string? Platform,
    string? VersionFound,
    string? BuildFixed,
    string? Functionality,
    string? IssueTitle,
    string? Summary,
    int CommentCount,
    string? LatestCommentPreview,
    DateTime LastImportedAt,
    DateTime UpdatedAt
);

public record TicketDetailDto(
    int TicketId,
    string TicketKey,
    string? Platform,
    string? VersionFound,
    string? BuildFixed,
    string? Functionality,
    string? IssueTitle,
    string? Summary,
    string? SourceInternalComments,
    DateTime LastImportedAt,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    List<CommentDto> Comments
);

public record CommentDto(
    int CommentId,
    string CommentText,
    int? CreatedByUserId,
    string? CreatedByDisplayName,
    string? CreatedByUsername,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    bool IsPinned,
    List<MentionDto> Mentions
);

public record MentionDto(int UserId, string DisplayName, string Username, string? Email);

public record CreateCommentRequest(string CommentText, int? CreatedByUserId, bool IsPinned = false);

public record UpdateCommentRequest(string CommentText, int? UpdatedByUserId);

public record SearchResultDto<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount, int TotalPages);

public record MetadataDto(
    int TotalTickets,
    int InProcessTickets,
    int TicketsWithComments,
    IReadOnlyList<string> Platforms,
    IReadOnlyList<string> Functionalities,
    IReadOnlyList<string> BuildFixedValues,
    IReadOnlyList<string> VersionFoundValues
);
