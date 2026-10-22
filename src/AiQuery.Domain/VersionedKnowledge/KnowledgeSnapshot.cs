using AiQuery.Domain.Common;

namespace AiQuery.Domain.VersionedKnowledge;

public enum KnowledgeSnapshotState
{
    Draft,
    Uploading,
    PendingProcessing,
    Processing,
    ReadyForReview,
    Failed,
    Approved,
    Published,
    Retired
}

public sealed record KnowledgeSnapshotCreated(KnowledgeSnapshotId SnapshotId, SoftwareVersionId VersionId, DateTimeOffset OccurredAtUtc) : IDomainEvent;
public sealed record KnowledgeUploadStarted(KnowledgeSnapshotId SnapshotId, DateTimeOffset OccurredAtUtc) : IDomainEvent;
public sealed record KnowledgeIngestionQueued(KnowledgeSnapshotId SnapshotId, SnapshotHash ManifestHash, DateTimeOffset OccurredAtUtc) : IDomainEvent;
public sealed record KnowledgeIngestionStarted(KnowledgeSnapshotId SnapshotId, DateTimeOffset OccurredAtUtc) : IDomainEvent;
public sealed record KnowledgeIngestionSucceeded(KnowledgeSnapshotId SnapshotId, string Hash, DateTimeOffset OccurredAtUtc) : IDomainEvent;
public sealed record KnowledgeIngestionFailed(KnowledgeSnapshotId SnapshotId, string ErrorCode, DateTimeOffset OccurredAtUtc) : IDomainEvent;
public sealed record KnowledgeSnapshotApproved(KnowledgeSnapshotId SnapshotId, UserId ApproverId, DateTimeOffset OccurredAtUtc) : IDomainEvent;
public sealed record KnowledgeSnapshotRejected(KnowledgeSnapshotId SnapshotId, UserId ReviewerId, DateTimeOffset OccurredAtUtc) : IDomainEvent;
public sealed record KnowledgeSnapshotPublished(KnowledgeSnapshotId SnapshotId, DateTimeOffset OccurredAtUtc) : IDomainEvent;
public sealed record KnowledgeSnapshotRetired(KnowledgeSnapshotId SnapshotId, DateTimeOffset OccurredAtUtc) : IDomainEvent;

public sealed class FileIdentity(FileIdentityId id, string logicalName) : Entity<FileIdentityId>(id)
{
    public string LogicalName { get; } = NormalizeLogicalPath(logicalName);

    public static string NormalizeLogicalPath(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) throw new DomainRuleException("file.name.invalid", "Logical file path is required.");
        var normalized = path.Trim().Replace('\\', '/');
        if (normalized.StartsWith('/') || Path.IsPathRooted(normalized) || normalized.Split('/').Any(part => part is "" or "." or ".."))
        {
            throw new DomainRuleException("file.path.invalid", "Logical file path must be relative and canonical.");
        }

        if (normalized.Length > 500) throw new DomainRuleException("file.path.too_long", "Logical file path is too long.");
        return normalized;
    }
}

public sealed class FileRevision : Entity<FileRevisionId>
{
    public FileRevision(FileRevisionId id, FileIdentityId identityId, int revisionNumber, SnapshotHash contentHash)
        : this(id, identityId, revisionNumber, contentHash, "application/octet-stream", 0, string.Empty, true, DateTimeOffset.UnixEpoch)
    {
    }

    public FileRevision(
        FileRevisionId id,
        FileIdentityId identityId,
        int revisionNumber,
        SnapshotHash contentHash,
        string mediaType,
        long sizeBytes,
        string objectReference,
        bool isActive,
        DateTimeOffset createdAtUtc) : base(id)
    {
        if (id.Value == Guid.Empty || identityId.Value == Guid.Empty) throw new DomainRuleException("file.identity.invalid", "File identifiers are required.");
        if (revisionNumber < 1) throw new DomainRuleException("file.revision.invalid", "Revision number must be positive.");
        if (sizeBytes < 0) throw new DomainRuleException("file.size.invalid", "File size cannot be negative.");
        if (string.IsNullOrWhiteSpace(mediaType)) throw new DomainRuleException("file.media_type.invalid", "Media type is required.");
        IdentityId = identityId;
        RevisionNumber = revisionNumber;
        ContentHash = contentHash;
        MediaType = mediaType.Trim().ToLowerInvariant();
        SizeBytes = sizeBytes;
        ObjectReference = objectReference;
        IsActive = isActive;
        CreatedAtUtc = createdAtUtc;
    }

    public FileIdentityId IdentityId { get; }
    public int RevisionNumber { get; }
    public SnapshotHash ContentHash { get; }
    public string MediaType { get; }
    public long SizeBytes { get; }
    public string ObjectReference { get; }
    public bool IsActive { get; }
    public DateTimeOffset CreatedAtUtc { get; }
}

public sealed class KnowledgeSnapshot : AggregateRoot<KnowledgeSnapshotId>
{
    private readonly List<FileRevision> _revisions = [];
    private readonly HashSet<FileIdentityId> _tombstones = [];

    private KnowledgeSnapshot(KnowledgeSnapshotId id, SoftwareVersionId versionId, UserId creatorId) : base(id)
    {
        SoftwareVersionId = versionId;
        CreatorId = creatorId;
    }

    public SoftwareVersionId SoftwareVersionId { get; }
    public UserId CreatorId { get; }
    public KnowledgeSnapshotState State { get; private set; } = KnowledgeSnapshotState.Draft;
    public SnapshotHash? ManifestHash { get; private set; }
    public SnapshotHash? IngestedHash { get; private set; }
    public UserId? ApprovedBy { get; private set; }
    public IReadOnlyList<FileRevision> Revisions => _revisions.AsReadOnly();
    public IReadOnlySet<FileIdentityId> Tombstones => _tombstones;

    public static KnowledgeSnapshot Create(KnowledgeSnapshotId id, SoftwareVersionId versionId, UserId creatorId, DateTimeOffset occurredAtUtc)
    {
        if (id.Value == Guid.Empty || versionId.Value == Guid.Empty || creatorId.Value == Guid.Empty) throw new DomainRuleException("snapshot.identity.invalid", "Snapshot, version and creator identifiers are required.");
        var snapshot = new KnowledgeSnapshot(id, versionId, creatorId);
        snapshot.RecordEvent(new KnowledgeSnapshotCreated(id, versionId, occurredAtUtc));
        return snapshot;
    }

    public static KnowledgeSnapshot Rehydrate(
        KnowledgeSnapshotId id,
        SoftwareVersionId versionId,
        UserId creatorId,
        KnowledgeSnapshotState state,
        SnapshotHash? ingestedHash,
        UserId? approvedBy,
        long version,
        IEnumerable<FileRevision> revisions,
        SnapshotHash? manifestHash = null,
        IEnumerable<FileIdentityId>? tombstones = null)
    {
        var snapshot = new KnowledgeSnapshot(id, versionId, creatorId)
        {
            State = state,
            ManifestHash = manifestHash,
            IngestedHash = ingestedHash,
            ApprovedBy = approvedBy
        };
        snapshot._revisions.AddRange(revisions);
        if (tombstones is not null) snapshot._tombstones.UnionWith(tombstones);
        snapshot.RestoreVersion(version);
        return snapshot;
    }

    public void BeginUpload(DateTimeOffset occurredAtUtc)
    {
        RequireState(KnowledgeSnapshotState.Draft);
        State = KnowledgeSnapshotState.Uploading;
        RecordEvent(new KnowledgeUploadStarted(Id, occurredAtUtc));
    }

    public void AddRevision(FileRevision revision)
    {
        RequireMutableManifest();
        if (_revisions.Any(item => item.IdentityId == revision.IdentityId)) throw new DomainRuleException("snapshot.file.duplicate", "A snapshot can contain only one revision for each file identity.");
        _tombstones.Remove(revision.IdentityId);
        _revisions.Add(revision);
        IncrementVersion();
    }

    public void ReplaceRevision(FileRevision revision)
    {
        RequireMutableManifest();
        var existing = _revisions.SingleOrDefault(item => item.IdentityId == revision.IdentityId)
            ?? throw new DomainRuleException("snapshot.file.not_found", "File identity does not exist in the snapshot.");
        if (revision.RevisionNumber <= existing.RevisionNumber) throw new DomainRuleException("file.revision.order", "Replacement revision number must increase.");
        _revisions.Remove(existing);
        _revisions.Add(revision);
        IncrementVersion();
    }

    public void RemoveFile(FileIdentityId identityId)
    {
        RequireMutableManifest();
        var removed = _revisions.RemoveAll(item => item.IdentityId == identityId);
        if (removed == 0) throw new DomainRuleException("snapshot.file.not_found", "File identity does not exist in the snapshot.");
        _tombstones.Add(identityId);
        IncrementVersion();
    }

    public void QueueIngestion(SnapshotHash manifestHash, DateTimeOffset occurredAtUtc)
    {
        if (State is not (KnowledgeSnapshotState.Draft or KnowledgeSnapshotState.Uploading or KnowledgeSnapshotState.Failed)) throw InvalidTransition("queue ingestion");
        if (_revisions.Count == 0) throw new DomainRuleException("snapshot.empty", "At least one file revision is required before ingestion.");
        ManifestHash = manifestHash;
        IngestedHash = null;
        IncrementVersion();
        ApprovedBy = null;
        State = KnowledgeSnapshotState.PendingProcessing;
        RecordEvent(new KnowledgeIngestionQueued(Id, manifestHash, occurredAtUtc));
    }

    public void StartIngestion(DateTimeOffset occurredAtUtc)
    {
        RequireState(KnowledgeSnapshotState.PendingProcessing);
        State = KnowledgeSnapshotState.Processing;
        RecordEvent(new KnowledgeIngestionStarted(Id, occurredAtUtc));
    }

    public void CompleteIngestion(SnapshotHash hash, DateTimeOffset occurredAtUtc)
    {
        RequireState(KnowledgeSnapshotState.Processing);
        IngestedHash = hash;
        State = KnowledgeSnapshotState.ReadyForReview;
        RecordEvent(new KnowledgeIngestionSucceeded(Id, hash.Value, occurredAtUtc));
    }

    public void FailIngestion(string errorCode, DateTimeOffset occurredAtUtc)
    {
        if (State is not (KnowledgeSnapshotState.PendingProcessing or KnowledgeSnapshotState.Processing)) throw InvalidTransition("fail ingestion");
        State = KnowledgeSnapshotState.Failed;
        RecordEvent(new KnowledgeIngestionFailed(Id, errorCode, occurredAtUtc));
    }

    public void CancelIngestion()
    {
        if (State is not (KnowledgeSnapshotState.PendingProcessing or KnowledgeSnapshotState.Processing)) throw InvalidTransition("cancel ingestion");
        State = KnowledgeSnapshotState.Draft;
        ManifestHash = null;
        IngestedHash = null;
    }

    public void RejectReview(UserId reviewerId, DateTimeOffset occurredAtUtc)
    {
        RequireState(KnowledgeSnapshotState.ReadyForReview);
        State = KnowledgeSnapshotState.Draft;
        IngestedHash = null;
        ApprovedBy = null;
        RecordEvent(new KnowledgeSnapshotRejected(Id, reviewerId, occurredAtUtc));
    }

    public void Approve(UserId approverId, DateTimeOffset occurredAtUtc)
    {
        RequireState(KnowledgeSnapshotState.ReadyForReview);
        if (approverId.Value == Guid.Empty) throw new DomainRuleException("snapshot.approver.invalid", "Approver is required.");
        ApprovedBy = approverId;
        State = KnowledgeSnapshotState.Approved;
        RecordEvent(new KnowledgeSnapshotApproved(Id, approverId, occurredAtUtc));
    }

    public void Publish(DateTimeOffset occurredAtUtc)
    {
        RequireState(KnowledgeSnapshotState.Approved);
        EnsurePublishPrerequisites();
        State = KnowledgeSnapshotState.Published;
        RecordEvent(new KnowledgeSnapshotPublished(Id, occurredAtUtc));
    }

    public void Retire(DateTimeOffset occurredAtUtc)
    {
        RequireState(KnowledgeSnapshotState.Published);
        State = KnowledgeSnapshotState.Retired;
        RecordEvent(new KnowledgeSnapshotRetired(Id, occurredAtUtc));
    }

    public void RestorePublication(DateTimeOffset occurredAtUtc)
    {
        RequireState(KnowledgeSnapshotState.Retired);
        EnsurePublishPrerequisites();
        State = KnowledgeSnapshotState.Published;
        RecordEvent(new KnowledgeSnapshotPublished(Id, occurredAtUtc));
    }

    private void EnsurePublishPrerequisites()
    {
        if (ManifestHash is null || IngestedHash is null || ApprovedBy is null) throw new DomainRuleException("snapshot.publish.prerequisite", "A fixed manifest, successful ingestion and approval are required.");
    }

    private void RequireMutableManifest()
    {
        if (State is not (KnowledgeSnapshotState.Draft or KnowledgeSnapshotState.Uploading)) throw InvalidTransition("change manifest");
    }

    private void RequireState(KnowledgeSnapshotState expected)
    {
        if (State != expected) throw InvalidTransition($"perform operation requiring {expected}");
    }

    private DomainRuleException InvalidTransition(string action) => new("snapshot.transition.invalid", $"Cannot {action} while snapshot state is {State}.");
}

public sealed record PublicationChanged(SoftwareVersionId VersionId, KnowledgeSnapshotId SnapshotId, KnowledgeSnapshotId? PreviousSnapshotId, DateTimeOffset OccurredAtUtc) : IDomainEvent;

public sealed class PublicationPointer : AggregateRoot<SoftwareVersionId>
{
    public PublicationPointer(SoftwareVersionId versionId) : base(versionId) { }
    public KnowledgeSnapshotId? ActiveSnapshotId { get; private set; }

    public static PublicationPointer Rehydrate(SoftwareVersionId versionId, KnowledgeSnapshotId? activeSnapshotId, long version)
    {
        var pointer = new PublicationPointer(versionId) { ActiveSnapshotId = activeSnapshotId };
        pointer.RestoreVersion(version);
        return pointer;
    }

    public void MoveTo(KnowledgeSnapshot snapshot, long expectedVersion, DateTimeOffset occurredAtUtc)
    {
        EnsureVersion(expectedVersion);
        if (snapshot.SoftwareVersionId != Id || snapshot.State != KnowledgeSnapshotState.Published) throw new DomainRuleException("publication.snapshot.invalid", "Only a published snapshot for the same software version can become active.");
        var previous = ActiveSnapshotId;
        ActiveSnapshotId = snapshot.Id;
        RecordEvent(new PublicationChanged(Id, snapshot.Id, previous, occurredAtUtc));
    }
}
