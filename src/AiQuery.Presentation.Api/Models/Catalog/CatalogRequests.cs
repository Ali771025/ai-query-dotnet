using AiQuery.Application.Features.SoftwareCatalog;

namespace AiQuery.Presentation.Api.Models.Catalog;

public sealed record CreateSoftwareRequest(Guid TenantId, Guid OwnerOrganizationId, string Code, string Name);
public record ScopedRequest(Guid TenantId, Guid? OrganizationId)
{
    public CatalogScope Scope(Guid softwareId) => new(TenantId, OrganizationId, softwareId);
}

public sealed record SoftwareWriteRequest(Guid TenantId, Guid? OrganizationId, string Name, long Version) : ScopedRequest(TenantId, OrganizationId);
public sealed record SoftwareStatusRequest(Guid TenantId, Guid? OrganizationId, string Name, bool Active, long Version) : ScopedRequest(TenantId, OrganizationId);
public sealed record DatabaseWriteRequest(Guid TenantId, Guid? OrganizationId, string Code, string Name, string Dialect, Guid? IntroducedVersionId, Guid? RemovedVersionId, bool Active, long Version) : ScopedRequest(TenantId, OrganizationId);
public sealed record VersionWriteRequest(Guid TenantId, Guid? OrganizationId, string Label, DateOnly? ReleaseDate) : ScopedRequest(TenantId, OrganizationId);
public sealed record VersionUpdateRequest(Guid TenantId, Guid? OrganizationId, DateOnly? ReleaseDate, long Version) : ScopedRequest(TenantId, OrganizationId);
public sealed record DependencyRequest(Guid TenantId, Guid? OrganizationId, Guid DependencyId) : ScopedRequest(TenantId, OrganizationId);
public sealed record ScopedVersionRequest(Guid TenantId, Guid? OrganizationId, long Version) : ScopedRequest(TenantId, OrganizationId);
