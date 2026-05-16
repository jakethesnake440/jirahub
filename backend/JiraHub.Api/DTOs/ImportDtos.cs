namespace JiraHub.Api.DTOs;

public record ImportResultDto(
    int ImportBatchId,
    string FileName,
    int TotalRows,
    int InsertedRows,
    int UpdatedRows,
    int SkippedRows,
    int ErrorRows,
    DateTime UploadedAt,
    IReadOnlyList<string> Errors
);

public record ImportBatchDto(
    int ImportBatchId,
    string FileName,
    DateTime UploadedAt,
    int TotalRows,
    int InsertedRows,
    int UpdatedRows,
    int SkippedRows,
    int ErrorRows
);
