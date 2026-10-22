using AiQuery.Application.Common;
using AiQuery.Application.Common.Interfaces;
using AiQuery.Domain.Common;
using FluentValidation;

namespace AiQuery.Application.Features.SoftwareCatalog;

public sealed class CatalogManagementUseCases(
    ICatalogStore store,
    IAuthorizationService authorization,
    IIdGenerator ids,
    IAuditSink audit,
    IUnitOfWork unitOfWork,
    IClock clock)
{
    public async Task<SoftwareDetail> CreateSoftwareAsync(CreateSoftware command, CancellationToken cancellationToken)
    {
        await ValidateAndAuthorize(new CreateSoftwareValidator(), command, "software.create", new AccessScope(new(command.TenantId), new(command.OwnerOrganizationId)), cancellationToken);
        var result = await store.CreateSoftwareAsync(ids.NewId(), command, cancellationToken);
        await Commit("software.created", command.CorrelationId, result.Id, cancellationToken);
        return result;
    }

    public async Task<SoftwareDetail> UpdateSoftwareAsync(UpdateSoftware command, bool? active, bool delete, CancellationToken cancellationToken)
    {
        await Authorize(delete ? "software.delete" : "software.edit", command.Scope, cancellationToken);
        var result = await store.UpdateSoftwareAsync(command, active, delete, cancellationToken);
        await Commit(delete ? "software.deleted" : active is null ? "software.updated" : "software.status.changed", command.CorrelationId, result.Id, cancellationToken);
        return result;
    }

    public async Task<DatabaseDetail> CreateDatabaseAsync(CreateDatabase command, CancellationToken cancellationToken)
    {
        await ValidateAndAuthorize(new CreateDatabaseValidator(), command, "databases.create", command.Scope.ToAccessScope(), cancellationToken);
        var result = await store.CreateDatabaseAsync(ids.NewId(), command, cancellationToken);
        await Commit("software.database.created", command.CorrelationId, result.Id, cancellationToken);
        return result;
    }

    public async Task<DatabaseDetail> UpdateDatabaseAsync(UpdateDatabase command, bool delete, CancellationToken cancellationToken)
    {
        await Authorize(delete ? "databases.delete" : "databases.edit", command.Scope, cancellationToken);
        var result = await store.UpdateDatabaseAsync(command, delete, cancellationToken);
        await Commit(delete ? "software.database.deleted" : "software.database.updated", command.CorrelationId, result.Id, cancellationToken);
        return result;
    }

    public async Task<VersionDetail> CreateVersionAsync(CreateVersion command, CancellationToken cancellationToken)
    {
        await ValidateAndAuthorize(new CreateVersionValidator(), command, "versions.create", command.Scope.ToAccessScope(), cancellationToken);
        var result = await store.CreateVersionAsync(ids.NewId(), command, cancellationToken);
        await Commit("software.version.created", command.CorrelationId, result.Id, cancellationToken);
        return result;
    }

    public async Task<VersionDetail> UpdateVersionAsync(UpdateVersion command, CancellationToken cancellationToken)
    {
        await Authorize("versions.edit", command.Scope, cancellationToken);
        var result = await store.UpdateVersionAsync(command, cancellationToken);
        await Commit("software.version.updated", command.CorrelationId, result.Id, cancellationToken);
        return result;
    }

    public async Task<VersionDetail> AddDependencyAsync(AddVersionDependency command, CancellationToken cancellationToken)
    {
        await Authorize("versions.edit", command.Scope, cancellationToken);
        var result = await store.AddDependencyAsync(command, cancellationToken);
        await Commit("software.version.dependency.added", command.CorrelationId, result.Id, cancellationToken);
        return result;
    }

    public async Task<VersionDetail> RetireVersionAsync(CatalogScope scope, Guid versionId, long version, string correlationId, CancellationToken cancellationToken)
    {
        await Authorize("versions.edit", scope, cancellationToken);
        var result = await store.RetireVersionAsync(scope, versionId, version, cancellationToken);
        await Commit("software.version.retired", correlationId, result.Id, cancellationToken);
        return result;
    }

    public async Task<CatalogPage<SoftwareDetail>> ListSoftwareAsync(Guid tenant, Guid? organization, int page, int size, string? filter, string sort, bool descending, CancellationToken cancellationToken)
    {
        var scope = new AccessScope(new(tenant), organization is null ? null : new(organization.Value));
        if (!await authorization.IsAuthorizedAsync(new("software.view", scope), cancellationToken) &&
            !await authorization.IsAuthorizedAsync(new("software.read", scope), cancellationToken))
        {
            throw new ApplicationAuthorizationException("software.view.forbidden", "Software catalog is outside active scope.");
        }

        return await store.ListSoftwareAsync(tenant, organization, page, size, filter, sort, descending, cancellationToken);
    }

    public async ValueTask<CatalogPage<DatabaseDetail>> ListDatabasesAsync(CatalogScope scope, int page, int size, CancellationToken cancellationToken)
    {
        await Authorize("databases.view", scope, cancellationToken);
        return await store.ListDatabasesAsync(scope, page, size, cancellationToken);
    }

    public async ValueTask<CatalogPage<VersionDetail>> ListVersionsAsync(CatalogScope scope, int page, int size, string? filter, CancellationToken cancellationToken)
    {
        await Authorize("versions.view", scope, cancellationToken);
        return await store.ListVersionsAsync(scope, page, size, filter, cancellationToken);
    }

    public async ValueTask<VersionDetail> GetVersionAsync(CatalogScope scope, Guid versionId, CancellationToken cancellationToken)
    {
        var page = await ListVersionsAsync(scope, 1, 200, null, cancellationToken);
        return page.Items.SingleOrDefault(x => x.Id == versionId)
            ?? throw new ApplicationAuthorizationException("catalog.not_found", "Catalog resource was not found in active scope.");
    }

    public async ValueTask<IReadOnlyCollection<VersionDetail>> ListEligibleReferencesAsync(CatalogScope scope, Guid versionId, CancellationToken cancellationToken)
    {
        _ = await GetVersionAsync(scope, versionId, cancellationToken);
        var page = await ListVersionsAsync(scope, 1, 200, null, cancellationToken);
        return page.Items.Where(x => x.Id != versionId && x.Status != "Retired").ToArray();
    }

    public async ValueTask<IReadOnlyCollection<DatabaseDetail>> ListEffectiveDatabasesAsync(CatalogScope scope, Guid versionId, CancellationToken cancellationToken)
    {
        var versions = await ListVersionsAsync(scope, 1, 200, null, cancellationToken);
        var ordered = versions.Items.OrderBy(x => x.ReleaseDate).ThenBy(x => x.Label).Select(x => x.Id).ToArray();
        var target = Array.IndexOf(ordered, versionId);
        if (target < 0) throw new ApplicationAuthorizationException("catalog.not_found", "Catalog resource was not found in active scope.");

        var databases = await ListDatabasesAsync(scope, 1, 200, cancellationToken);
        return databases.Items.Where(x =>
            x.IsActive &&
            (x.IntroducedVersionId is null || Array.IndexOf(ordered, x.IntroducedVersionId.Value) <= target) &&
            (x.RemovedVersionId is null || Array.IndexOf(ordered, x.RemovedVersionId.Value) > target)).ToArray();
    }

    public async ValueTask<IReadOnlyCollection<VersionDetail>> GetDependencyGraphAsync(CatalogScope scope, CancellationToken cancellationToken) =>
        (await ListVersionsAsync(scope, 1, 200, null, cancellationToken)).Items;

    private async Task Authorize(string permission, CatalogScope scope, CancellationToken cancellationToken)
    {
        if (!await authorization.IsAuthorizedAsync(new(permission, scope.ToAccessScope()), cancellationToken))
        {
            throw new ApplicationAuthorizationException("catalog.scope.forbidden", "Catalog resource is outside active scope.");
        }
    }

    private async Task ValidateAndAuthorize<T>(AbstractValidator<T> validator, T command, string permission, AccessScope scope, CancellationToken cancellationToken)
    {
        var result = await validator.ValidateAsync(command, cancellationToken);
        if (!result.IsValid)
        {
            throw new ApplicationValidationException(result.Errors
                .GroupBy(x => x.PropertyName)
                .ToDictionary(x => x.Key, x => x.Select(error => error.ErrorMessage).ToArray()));
        }

        if (!await authorization.IsAuthorizedAsync(new(permission, scope), cancellationToken))
        {
            throw new ApplicationAuthorizationException("catalog.scope.forbidden", "Catalog resource is outside active scope.");
        }
    }

    private async Task Commit(string code, string correlation, Guid target, CancellationToken cancellationToken)
    {
        await audit.WriteAsync(new(code, correlation, null, clock.UtcNow, new Dictionary<string, string> { { "targetId", target.ToString() } }), cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
