using AiQuery.Application.Common;
using AiQuery.Application.Common.Interfaces;
using AiQuery.Domain.VersionedKnowledge;
using AiQuery.Domain.Common;
using AiQuery.Infrastructure.Persistence;
using AiQuery.Infrastructure.Persistence.Records;
using Microsoft.EntityFrameworkCore;

namespace AiQuery.Infrastructure.Repositories;

internal sealed class EfIngestionJobStore(AppDbContext db) : IIngestionJobStore
{
    public async ValueTask<IngestionJobProjection?> FindByIdempotencyKeyAsync(AccessScope scope, string idempotencyKey, CancellationToken cancellationToken) =>
        Map(await Scoped(scope).AsNoTracking().SingleOrDefaultAsync(row => row.IdempotencyKey == idempotencyKey, cancellationToken));

    public ValueTask<IngestionJobProjection> EnqueueAsync(Guid jobId, KnowledgeSnapshot snapshot, AccessScope scope, string idempotencyKey, DateTimeOffset now, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var row = new IngestionJobRecord { Id = jobId, TenantId = scope.TenantId.Value, KnowledgeSnapshotId = snapshot.Id.Value, IdempotencyKey = idempotencyKey, State = "Pending", AttemptCount = 0, MaxAttempts = 5, NextAttemptAtUtc = now, Progress = 0, Version = 0 };
        db.Set<IngestionJobRecord>().Add(row);
        return ValueTask.FromResult(Map(row)!);
    }

    public async ValueTask<IngestionJobProjection?> FindAsync(Guid jobId, AccessScope scope, CancellationToken cancellationToken) =>
        Map(await Scoped(scope).AsNoTracking().SingleOrDefaultAsync(row => row.Id == jobId, cancellationToken));

    public async ValueTask CancelAsync(Guid jobId, AccessScope scope, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var row = await RequireAsync(jobId, scope, cancellationToken);
        if (row.State is "Completed" or "Cancelled") return;
        row.State = "Cancelled"; row.CancelledAtUtc = now; row.LeaseExpiresAtUtc = null; row.LeaseOwner = null; row.Version++;
    }

    public async ValueTask RetryAsync(Guid jobId, AccessScope scope, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var row = await RequireAsync(jobId, scope, cancellationToken);
        if (row.State is not ("Failed" or "RetryScheduled")) throw new ApplicationConcurrencyException("Only a failed ingestion job can be retried.");
        row.State = "Pending"; row.NextAttemptAtUtc = now; row.LastErrorCode = null; row.Progress = 0; row.Version++;
    }

    public async ValueTask<ClaimedIngestionJob?> ClaimNextAsync(string workerId, DateTimeOffset now, TimeSpan leaseDuration, CancellationToken cancellationToken)
    {
        var row = await db.Set<IngestionJobRecord>()
            .Where(item => item.State == "Pending" || item.State == "RetryScheduled" || (item.State == "Processing" && item.LeaseExpiresAtUtc < now))
            .Where(item => item.NextAttemptAtUtc == null || item.NextAttemptAtUtc <= now)
            .Where(item => item.AttemptCount < item.MaxAttempts)
            .OrderBy(item => item.NextAttemptAtUtc).ThenBy(item => item.Id)
            .Include(item => item.KnowledgeSnapshot)
            .ThenInclude(item => item!.Files)
            .FirstOrDefaultAsync(cancellationToken);
        if (row is null) return null;

        row.State = "Processing"; row.LeaseOwner = workerId; row.LeaseExpiresAtUtc = now.Add(leaseDuration); row.FencingToken++; row.AttemptCount++; row.StartedAtUtc ??= now; row.Progress = Math.Max(row.Progress, 1); row.Version++;
        await db.SaveChangesAsync(cancellationToken);

        var revisionIds = row.KnowledgeSnapshot!.Files.Select(item => item.FileRevisionId).ToArray();
        var artifacts = await db.Set<FileRevisionRecord>().AsNoTracking().Where(item => revisionIds.Contains(item.Id) && item.IsActive)
            .Select(item => new IngestionArtifact(item.Id, item.ObjectReference, item.ContentHash, item.MediaType, item.SizeBytes)).ToArrayAsync(cancellationToken);
        return new(row.Id, row.KnowledgeSnapshotId, row.TenantId, row.KnowledgeSnapshot.SoftwareVersionId, row.FencingToken, row.KnowledgeSnapshot.ManifestHash ?? throw new InvalidOperationException("Manifest hash is missing."), artifacts);
    }

    public async ValueTask HeartbeatAsync(Guid jobId, long fencingToken, DateTimeOffset now, TimeSpan leaseDuration, int progress, CancellationToken cancellationToken)
    {
        var row = await RequireLeaseAsync(jobId, fencingToken, cancellationToken);
        row.LeaseExpiresAtUtc = now.Add(leaseDuration); row.Progress = Math.Clamp(progress, 1, 99); row.Version++;
        await db.SaveChangesAsync(cancellationToken);
    }

    public async ValueTask CompleteAsync(Guid jobId, long fencingToken, string resultHash, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var row = await RequireLeaseAsync(jobId, fencingToken, cancellationToken);
        row.State = "Completed"; row.Progress = 100; row.ResultHash = resultHash; row.CompletedAtUtc = now; row.LeaseExpiresAtUtc = null; row.LeaseOwner = null; row.Version++;
        await db.SaveChangesAsync(cancellationToken);
    }

    public async ValueTask FailAsync(Guid jobId, long fencingToken, string errorCode, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var row = await RequireLeaseAsync(jobId, fencingToken, cancellationToken);
        row.LastErrorCode = errorCode; row.LeaseExpiresAtUtc = null; row.LeaseOwner = null; row.Progress = 0;
        if (row.AttemptCount >= row.MaxAttempts) { row.State = "Failed"; row.CompletedAtUtc = now; }
        else { row.State = "RetryScheduled"; row.NextAttemptAtUtc = now.AddSeconds(Math.Min(300, Math.Pow(2, row.AttemptCount))); }
        row.Version++;
        await db.SaveChangesAsync(cancellationToken);
    }

    private IQueryable<IngestionJobRecord> Scoped(AccessScope scope)
    {
        var query = db.Set<IngestionJobRecord>().Where(row => row.TenantId == scope.TenantId.Value && row.KnowledgeSnapshot!.SoftwareVersionId == scope.VersionId!.Value.Value);
        if (scope.SoftwareId is { } softwareId) query = query.Where(row => row.KnowledgeSnapshot!.SoftwareVersion!.SoftwareProductId == softwareId.Value);
        if (scope.OrganizationId is { } organizationId) query = query.Where(row => row.KnowledgeSnapshot!.SoftwareVersion!.SoftwareProduct!.OwnerOrganizationId == organizationId.Value);
        return query;
    }

    private async Task<IngestionJobRecord> RequireAsync(Guid jobId, AccessScope scope, CancellationToken cancellationToken) =>
        await Scoped(scope).SingleOrDefaultAsync(row => row.Id == jobId, cancellationToken) ?? throw new ApplicationAuthorizationException("knowledge.job.not_found", "Ingestion job was not found in the active scope.");

    private async Task<IngestionJobRecord> RequireLeaseAsync(Guid jobId, long fencingToken, CancellationToken cancellationToken)
    {
        var row = await db.Set<IngestionJobRecord>().SingleOrDefaultAsync(item => item.Id == jobId, cancellationToken) ?? throw new ApplicationConcurrencyException("Ingestion job no longer exists.");
        if (row.State != "Processing" || row.FencingToken != fencingToken) throw new ApplicationConcurrencyException("Ingestion job lease is stale.");
        return row;
    }

    private static IngestionJobProjection? Map(IngestionJobRecord? row) => row is null ? null : new(row.Id, row.KnowledgeSnapshotId, row.State, row.Progress, row.AttemptCount, row.MaxAttempts, row.StartedAtUtc, row.CompletedAtUtc, row.NextAttemptAtUtc, row.LastErrorCode, row.Version);
}
