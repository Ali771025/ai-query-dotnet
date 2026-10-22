using AiQuery.Application.Common;
using AiQuery.Domain.Common;
using AiQuery.Domain.SoftwareCatalog;
using AiQuery.Domain.VersionedKnowledge;

namespace AiQuery.Application.Common.Interfaces;

public interface ISoftwareProductStore
{
    ValueTask<bool> CodeExistsAsync(TenantId tenantId, OrganizationId ownerId, SoftwareCode code, CancellationToken cancellationToken);
    ValueTask AddAsync(SoftwareProduct product, AccessScope scope, CancellationToken cancellationToken);
    ValueTask<SoftwareProduct?> FindAsync(SoftwareProductId id, AccessScope scope, CancellationToken cancellationToken);
}

public interface ISoftwareCatalogReadStore
{
    ValueTask<PageResult<SoftwareProductListItem>> ListAsync(PageRequest page, AccessScope scope, CancellationToken cancellationToken);
}
public sealed record SoftwareProductListItem(Guid Id, string Code, string Name, int VersionCount, long Version);

public interface IKnowledgeSnapshotStore
{
    ValueTask AddAsync(KnowledgeSnapshot snapshot, AccessScope scope, CancellationToken cancellationToken);
    ValueTask<KnowledgeSnapshot?> FindAsync(KnowledgeSnapshotId id, AccessScope scope, CancellationToken cancellationToken);
    ValueTask<KnowledgeSnapshot?> FindLatestAsync(SoftwareVersionId versionId, AccessScope scope, CancellationToken cancellationToken);
}

public interface IPublicationPointerStore
{
    ValueTask<PublicationPointer> GetOrCreateAsync(SoftwareVersionId versionId, AccessScope scope, CancellationToken cancellationToken);
}

public interface IKnowledgeFileStore
{
    ValueTask<KnowledgeFileProjection> AddRevisionAsync(KnowledgeSnapshot snapshot, AccessScope scope, KnowledgeFileWrite write, CancellationToken cancellationToken);
    ValueTask<PageResult<KnowledgeFileProjection>> ListAsync(KnowledgeSnapshotId snapshotId, AccessScope scope, PageRequest page, string? folder, CancellationToken cancellationToken);
    ValueTask<IReadOnlyCollection<KnowledgeFileProjection>> ListArtifactsAsync(KnowledgeSnapshotId snapshotId, AccessScope scope, CancellationToken cancellationToken);
    ValueTask<IReadOnlyCollection<KnowledgeDiffProjection>> DiffAsync(KnowledgeSnapshotId leftId, KnowledgeSnapshotId rightId, AccessScope scope, CancellationToken cancellationToken);
}

public sealed record KnowledgeFileWrite(Guid RevisionId, string LogicalPath, string ContentHash, string MediaType, long SizeBytes, string ObjectReference, bool IsActive, DateTimeOffset CreatedAtUtc);
public sealed record KnowledgeFileProjection(Guid IdentityId, Guid RevisionId, string Path, int RevisionNumber, string ContentHash, string MediaType, long SizeBytes, string ObjectReference, bool IsActive, DateTimeOffset CreatedAtUtc);
public sealed record KnowledgeDiffProjection(string Path, string Kind, string? LeftHash, string? RightHash);

public interface IIngestionJobStore
{
    ValueTask<IngestionJobProjection?> FindByIdempotencyKeyAsync(AccessScope scope, string idempotencyKey, CancellationToken cancellationToken);
    ValueTask<IngestionJobProjection> EnqueueAsync(Guid jobId, KnowledgeSnapshot snapshot, AccessScope scope, string idempotencyKey, DateTimeOffset now, CancellationToken cancellationToken);
    ValueTask<IngestionJobProjection?> FindAsync(Guid jobId, AccessScope scope, CancellationToken cancellationToken);
    ValueTask CancelAsync(Guid jobId, AccessScope scope, DateTimeOffset now, CancellationToken cancellationToken);
    ValueTask RetryAsync(Guid jobId, AccessScope scope, DateTimeOffset now, CancellationToken cancellationToken);
    ValueTask<ClaimedIngestionJob?> ClaimNextAsync(string workerId, DateTimeOffset now, TimeSpan leaseDuration, CancellationToken cancellationToken);
    ValueTask HeartbeatAsync(Guid jobId, long fencingToken, DateTimeOffset now, TimeSpan leaseDuration, int progress, CancellationToken cancellationToken);
    ValueTask CompleteAsync(Guid jobId, long fencingToken, string resultHash, DateTimeOffset now, CancellationToken cancellationToken);
    ValueTask FailAsync(Guid jobId, long fencingToken, string errorCode, DateTimeOffset now, CancellationToken cancellationToken);
}

public sealed record IngestionJobProjection(Guid Id, Guid SnapshotId, string State, int Progress, int AttemptCount, int MaxAttempts, DateTimeOffset? StartedAtUtc, DateTimeOffset? CompletedAtUtc, DateTimeOffset? NextAttemptAtUtc, string? LastErrorCode, long Version);
public sealed record ClaimedIngestionJob(Guid Id, Guid SnapshotId, Guid TenantId, Guid SoftwareVersionId, long FencingToken, string ManifestHash, IReadOnlyCollection<IngestionArtifact> Artifacts);

public interface IQueryResultReadStore
{
    ValueTask<bool> ExistsForActorAsync(QueryResultId resultId, UserId actorId, CancellationToken cancellationToken);
}
