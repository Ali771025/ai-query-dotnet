namespace AiQuery.Application.Features.VersionedKnowledge.DTOs;

public sealed record KnowledgeScope(Guid TenantId, Guid OrganizationId, Guid SoftwareId, Guid VersionId)
{
    public AiQuery.Domain.Common.AccessScope ToAccessScope() => new(new(TenantId), new(OrganizationId), new(SoftwareId), new(VersionId));
}

public sealed record SnapshotDto(Guid Id, Guid VersionId, string State, string? ManifestHash, string? IngestedHash, Guid? ApprovedBy, long Version);
public sealed record UploadKnowledgeFile(string FileName, string? DeclaredMediaType, Stream Content);
public sealed record KnowledgeUploadResult(SnapshotDto Snapshot, IReadOnlyCollection<AiQuery.Application.Common.Interfaces.KnowledgeFileProjection> Files);
public sealed record KnowledgeJobResult(Guid JobId, Guid SnapshotId, string State, int Progress, int AttemptCount, int MaxAttempts, string? LastErrorCode, long Version);
public sealed record CurrentPublicationDto(Guid VersionId, Guid? SnapshotId, long PointerVersion);
