using AiQuery.Application.Features.VersionedKnowledge.DTOs;

namespace AiQuery.Presentation.Api.Models.Knowledge;

public sealed record SnapshotMutationRequest(Guid TenantId, Guid OrganizationId, long Version);
public sealed record StartIngestionRequest(Guid TenantId, Guid OrganizationId, long Version, string IdempotencyKey);
public sealed record JobMutationRequest(Guid TenantId, Guid OrganizationId, Guid SnapshotId, long SnapshotVersion);
public sealed record PublishSnapshotRequest(Guid TenantId, Guid OrganizationId, long SnapshotVersion, long PointerVersion);

public static class KnowledgeRequestMapping
{
    public static KnowledgeScope Scope(Guid tenantId, Guid organizationId, Guid softwareId, Guid versionId) => new(tenantId, organizationId, softwareId, versionId);
}

