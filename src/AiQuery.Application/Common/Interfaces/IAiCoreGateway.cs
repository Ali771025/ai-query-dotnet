namespace AiQuery.Application.Common.Interfaces;

public interface IAiCoreGateway
{
    Task<AiCoreHealth> GetHealthAsync(CancellationToken cancellationToken = default);
    Task<IngestionProcessingResult> ProcessSnapshotAsync(IngestionProcessingRequest request, CancellationToken cancellationToken = default);
}

public sealed record AiCoreHealth(bool IsHealthy, string StatusCode);
public sealed record IngestionProcessingRequest(Guid JobId, Guid SnapshotId, string ManifestHash, IReadOnlyCollection<IngestionArtifact> Artifacts);
public sealed record IngestionArtifact(Guid RevisionId, string ObjectReference, string Sha256, string MediaType, long SizeBytes);
public sealed record IngestionProcessingResult(string IndexManifestHash, int ProcessedFiles);
