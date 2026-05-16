namespace JiraHub.Api.Models;

public class ImportBatchError
{
    public int ImportBatchErrorId { get; set; }
    public int ImportBatchId { get; set; }
    public ImportBatch ImportBatch { get; set; } = null!;
    public int RowNumber { get; set; }
    public string ErrorMessage { get; set; } = string.Empty;
    public string? RawRow { get; set; }
}
