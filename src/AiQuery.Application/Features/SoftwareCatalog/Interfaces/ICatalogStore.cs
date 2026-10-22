namespace AiQuery.Application.Features.SoftwareCatalog;

public interface ICatalogStore
{
    ValueTask<SoftwareDetail> CreateSoftwareAsync(Guid id, CreateSoftware command, CancellationToken cancellationToken);
    ValueTask<SoftwareDetail?> GetSoftwareAsync(CatalogScope scope, CancellationToken cancellationToken);
    ValueTask<CatalogPage<SoftwareDetail>> ListSoftwareAsync(Guid tenantId, Guid? organizationId, int page, int pageSize, string? filter, string sort, bool descending, CancellationToken cancellationToken);
    ValueTask<SoftwareDetail> UpdateSoftwareAsync(UpdateSoftware command, bool? active, bool delete, CancellationToken cancellationToken);
    ValueTask<DatabaseDetail> CreateDatabaseAsync(Guid id, CreateDatabase command, CancellationToken cancellationToken);
    ValueTask<DatabaseDetail> UpdateDatabaseAsync(UpdateDatabase command, bool delete, CancellationToken cancellationToken);
    ValueTask<CatalogPage<DatabaseDetail>> ListDatabasesAsync(CatalogScope scope, int page, int pageSize, CancellationToken cancellationToken);
    ValueTask<VersionDetail> CreateVersionAsync(Guid id, CreateVersion command, CancellationToken cancellationToken);
    ValueTask<VersionDetail> UpdateVersionAsync(UpdateVersion command, CancellationToken cancellationToken);
    ValueTask<VersionDetail> AddDependencyAsync(AddVersionDependency command, CancellationToken cancellationToken);
    ValueTask<VersionDetail> RetireVersionAsync(CatalogScope scope, Guid versionId, long version, CancellationToken cancellationToken);
    ValueTask<CatalogPage<VersionDetail>> ListVersionsAsync(CatalogScope scope, int page, int pageSize, string? filter, CancellationToken cancellationToken);
}
