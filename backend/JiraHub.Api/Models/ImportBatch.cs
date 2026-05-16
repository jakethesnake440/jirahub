namespace JiraHub.Api.Models;

public class ImportBatch
{
    public int ImportBatchId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string? UploadedBy { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    public int TotalRows { get; set; }
    public int InsertedRows { get; set; }
    public int UpdatedRows { get; set; }
    public int SkippedRows { get; set; }
    public int ErrorRows { get; set; }

    public ICollection<ImportBatchError> Errors { get; set; } = new List<ImportBatchError>();
}
