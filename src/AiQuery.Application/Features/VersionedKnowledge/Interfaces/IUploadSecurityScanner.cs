namespace AiQuery.Application.Features.VersionedKnowledge.Interfaces;

public interface IUploadSecurityScanner
{
    ValueTask<UploadScanResult> ScanAsync(Stream content, string logicalPath, CancellationToken cancellationToken);
}

public sealed record UploadScanResult(bool IsClean, string StatusCode);

