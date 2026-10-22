using AiQuery.Application.Common;
using AiQuery.Application.Common.Interfaces;
using AiQuery.Domain.Common;

namespace AiQuery.Application.Features.VersionedKnowledge.Services;

public sealed class IngestionJobProcessor(
    IIngestionJobStore jobs,
    IKnowledgeSnapshotStore snapshots,
    IAiCoreGateway aiCore,
    IUnitOfWork unitOfWork,
    IOutbox outbox,
    IClock clock)
{
    public async Task<bool> ProcessNextAsync(string workerId, CancellationToken cancellationToken)
    {
        var claimed = await jobs.ClaimNextAsync(workerId, clock.UtcNow, TimeSpan.FromMinutes(2), cancellationToken);
        if (claimed is null) return false;
        var scope = new AccessScope(new(claimed.TenantId), VersionId: new(claimed.SoftwareVersionId));
        var snapshot = await snapshots.FindAsync(new(claimed.SnapshotId), scope, cancellationToken)
            ?? throw new InvalidOperationException("Claimed snapshot no longer exists.");
        try
        {
            if (snapshot.State == Domain.VersionedKnowledge.KnowledgeSnapshotState.Failed)
            {
                snapshot.QueueIngestion(snapshot.ManifestHash ?? throw new InvalidOperationException("Snapshot manifest is missing."), clock.UtcNow);
            }
            if (snapshot.State == Domain.VersionedKnowledge.KnowledgeSnapshotState.PendingProcessing)
            {
                snapshot.StartIngestion(clock.UtcNow);
                await outbox.EnqueueAsync(snapshot.DomainEvents, cancellationToken);
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }
            await jobs.HeartbeatAsync(claimed.Id, claimed.FencingToken, clock.UtcNow, TimeSpan.FromMinutes(2), 25, cancellationToken);
            var result = await aiCore.ProcessSnapshotAsync(new(claimed.Id, claimed.SnapshotId, claimed.ManifestHash, claimed.Artifacts), cancellationToken);
            snapshot.CompleteIngestion(SnapshotHash.Create(result.IndexManifestHash), clock.UtcNow);
            await outbox.EnqueueAsync(snapshot.DomainEvents, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);
            await jobs.CompleteAsync(claimed.Id, claimed.FencingToken, result.IndexManifestHash, clock.UtcNow, cancellationToken);
            return true;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch
        {
            if (snapshot.State is Domain.VersionedKnowledge.KnowledgeSnapshotState.PendingProcessing or Domain.VersionedKnowledge.KnowledgeSnapshotState.Processing)
            {
                snapshot.FailIngestion("ai.ingestion.failed", clock.UtcNow);
                await outbox.EnqueueAsync(snapshot.DomainEvents, CancellationToken.None);
                await unitOfWork.SaveChangesAsync(CancellationToken.None);
            }
            await jobs.FailAsync(claimed.Id, claimed.FencingToken, "ai.ingestion.failed", clock.UtcNow, CancellationToken.None);
            return true;
        }
    }
}
