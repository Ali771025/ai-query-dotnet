namespace AiQuery.Application.Features.SoftwareCatalog;

public sealed record CreateSoftware(Guid TenantId, Guid OwnerOrganizationId, string Code, string Name, string CorrelationId);
public sealed record UpdateSoftware(CatalogScope Scope, string Name, long Version, string CorrelationId);
public sealed record CreateDatabase(CatalogScope Scope, string Code, string Name, string Dialect, Guid? IntroducedVersionId, Guid? RemovedVersionId, string CorrelationId);
public sealed record UpdateDatabase(CatalogScope Scope, Guid DatabaseId, string Name, string Dialect, Guid? IntroducedVersionId, Guid? RemovedVersionId, bool IsActive, long Version, string CorrelationId);
public sealed record CreateVersion(CatalogScope Scope, string Label, DateOnly? ReleaseDate, string CorrelationId);
public sealed record UpdateVersion(CatalogScope Scope, Guid VersionId, DateOnly? ReleaseDate, long Version, string CorrelationId);
public sealed record AddVersionDependency(CatalogScope Scope, Guid VersionId, Guid DependencyId, string CorrelationId);
