namespace AiQuery.Infrastructure.Persistence.Records;

internal sealed class OrganizationRecord
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public bool IsActive { get; set; } = true;
    public long Version { get; set; }
}

internal sealed class SoftwareProductRecord
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid OwnerOrganizationId { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public string Status { get; set; } = "Active";
    public bool IsDeleted { get; set; }
    public long Version { get; set; }
    public OrganizationRecord? OwnerOrganization { get; set; }
    public List<SoftwareVersionRecord> Versions { get; } = [];
}

internal sealed class SoftwareDatabaseRecord
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid SoftwareProductId { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public required string Dialect { get; set; }
    public Guid? IntroducedVersionId { get; set; }
    public Guid? RemovedVersionId { get; set; }
    public bool IsActive { get; set; } = true;
    public long Version { get; set; }
    public SoftwareProductRecord? SoftwareProduct { get; set; }
}

internal sealed class SoftwareVersionRecord
{
    public Guid Id { get; set; }
    public Guid SoftwareProductId { get; set; }
    public required string Label { get; set; }
    public string Status { get; set; } = "Active";
    public DateOnly? ReleaseDate { get; set; }
    public long Version { get; set; }
    public SoftwareProductRecord? SoftwareProduct { get; set; }
    public List<VersionDependencyRecord> Dependencies { get; } = [];
}

internal sealed class VersionDependencyRecord
{
    public Guid SoftwareVersionId { get; set; }
    public Guid DependencyVersionId { get; set; }
    public SoftwareVersionRecord? SoftwareVersion { get; set; }
    public SoftwareVersionRecord? DependencyVersion { get; set; }
}

internal sealed class KnowledgeSnapshotRecord
{
    public Guid Id { get; set; }
    public Guid SoftwareVersionId { get; set; }
    public Guid CreatorId { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public string State { get; set; } = "Draft";
    public string? ManifestHash { get; set; }
    public string? IngestedHash { get; set; }
    public Guid? ApprovedBy { get; set; }
    public long Version { get; set; }
    public SoftwareVersionRecord? SoftwareVersion { get; set; }
    public List<SnapshotFileRecord> Files { get; } = [];
}

internal sealed class KnowledgeFileRecord
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid SoftwareProductId { get; set; }
    public required string LogicalName { get; set; }
    public bool IsDeleted { get; set; }
    public long Version { get; set; }
    public List<FileRevisionRecord> Revisions { get; } = [];
}

internal sealed class FileRevisionRecord
{
    public Guid Id { get; set; }
    public Guid FileIdentityId { get; set; }
    public int RevisionNumber { get; set; }
    public required string ContentHash { get; set; }
    public required string ObjectReference { get; set; }
    public string MediaType { get; set; } = "application/octet-stream";
    public long SizeBytes { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; }
}

internal sealed class SnapshotFileRecord
{
    public Guid KnowledgeSnapshotId { get; set; }
    public Guid FileRevisionId { get; set; }
    public KnowledgeSnapshotRecord? KnowledgeSnapshot { get; set; }
}

internal sealed class SnapshotApprovalRecord
{
    public Guid Id { get; set; }
    public Guid KnowledgeSnapshotId { get; set; }
    public Guid ApproverId { get; set; }
    public required string Decision { get; set; }
    public DateTimeOffset DecidedAtUtc { get; set; }
    public KnowledgeSnapshotRecord? KnowledgeSnapshot { get; set; }
}

internal sealed class PublicationPointerRecord
{
    public Guid SoftwareVersionId { get; set; }
    public Guid? ActiveSnapshotId { get; set; }
    public long Version { get; set; }
    public SoftwareVersionRecord? SoftwareVersion { get; set; }
}

internal sealed class IngestionJobRecord
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid KnowledgeSnapshotId { get; set; }
    public required string IdempotencyKey { get; set; }
    public required string State { get; set; }
    public int AttemptCount { get; set; }
    public int MaxAttempts { get; set; }
    public DateTimeOffset? NextAttemptAtUtc { get; set; }
    public DateTimeOffset? LeaseExpiresAtUtc { get; set; }
    public string? LeaseOwner { get; set; }
    public int Progress { get; set; }
    public string? LastErrorCode { get; set; }
    public string? ResultHash { get; set; }
    public DateTimeOffset? StartedAtUtc { get; set; }
    public DateTimeOffset? CompletedAtUtc { get; set; }
    public DateTimeOffset? CancelledAtUtc { get; set; }
    public long FencingToken { get; set; }
    public long Version { get; set; }
    public KnowledgeSnapshotRecord? KnowledgeSnapshot { get; set; }
}
