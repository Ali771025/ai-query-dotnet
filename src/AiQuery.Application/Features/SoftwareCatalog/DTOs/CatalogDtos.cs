using AiQuery.Domain.Common;

namespace AiQuery.Application.Features.SoftwareCatalog;

public sealed record CatalogScope(Guid TenantId, Guid? OrganizationId, Guid SoftwareId)
{
    public AccessScope ToAccessScope() => new(
        new(TenantId),
        OrganizationId is null ? null : new(OrganizationId.Value),
        new(SoftwareId));
}

public sealed record SoftwareDetail(Guid Id, Guid TenantId, Guid OwnerOrganizationId, string Code, string Name, string Status, int VersionCount, string KnowledgeStatus, long Version);
public sealed record DatabaseDetail(Guid Id, Guid SoftwareId, string Code, string Name, string Dialect, Guid? IntroducedVersionId, Guid? RemovedVersionId, bool IsActive, long Version);
public sealed record VersionDetail(Guid Id, Guid SoftwareId, string Label, DateOnly? ReleaseDate, string Status, IReadOnlyCollection<Guid> Dependencies, string KnowledgeStatus, long Version);
public sealed record CatalogPage<T>(IReadOnlyCollection<T> Items, int Page, int PageSize, long Total);
