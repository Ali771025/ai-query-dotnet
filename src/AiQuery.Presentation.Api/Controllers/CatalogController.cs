using AiQuery.Application.Features.SoftwareCatalog;
using AiQuery.Presentation.Api.Models.Catalog;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiQuery.Presentation.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/catalog")]
public sealed class CatalogController(CatalogManagementUseCases useCases) : ControllerBase
{
    [HttpGet("software")]
    public async Task<CatalogPage<SoftwareDetail>> ListSoftware(Guid tenantId, Guid? organizationId, int page, int pageSize, string? filter, string? sort, bool desc, CancellationToken cancellationToken) =>
        await useCases.ListSoftwareAsync(tenantId, organizationId, page, pageSize, filter, sort ?? "code", desc, cancellationToken);

    [HttpPost("software")]
    public async Task<ActionResult<SoftwareDetail>> CreateSoftware(CreateSoftwareRequest request, CancellationToken cancellationToken)
    {
        var result = await useCases.CreateSoftwareAsync(new(request.TenantId, request.OwnerOrganizationId, request.Code, request.Name, HttpContext.TraceIdentifier), cancellationToken);
        return CreatedAtAction(nameof(ListSoftware), result);
    }

    [HttpPut("software/{softwareId:guid}")]
    public async Task<SoftwareDetail> UpdateSoftware(Guid softwareId, SoftwareWriteRequest request, CancellationToken cancellationToken) =>
        await useCases.UpdateSoftwareAsync(new(request.Scope(softwareId), request.Name, request.Version, HttpContext.TraceIdentifier), null, false, cancellationToken);

    [HttpPut("software/{softwareId:guid}/status")]
    public async Task<SoftwareDetail> SetSoftwareStatus(Guid softwareId, SoftwareStatusRequest request, CancellationToken cancellationToken) =>
        await useCases.UpdateSoftwareAsync(new(request.Scope(softwareId), request.Name, request.Version, HttpContext.TraceIdentifier), request.Active, false, cancellationToken);

    [HttpDelete("software/{softwareId:guid}")]
    public async Task<SoftwareDetail> DeleteSoftware(Guid softwareId, Guid tenantId, Guid? organizationId, long version, CancellationToken cancellationToken) =>
        await useCases.UpdateSoftwareAsync(new(new(tenantId, organizationId, softwareId), "deleted", version, HttpContext.TraceIdentifier), null, true, cancellationToken);

    [HttpGet("software/{softwareId:guid}/databases")]
    public async Task<CatalogPage<DatabaseDetail>> ListDatabases(Guid softwareId, Guid tenantId, Guid? organizationId, int page, int pageSize, CancellationToken cancellationToken) =>
        await useCases.ListDatabasesAsync(new(tenantId, organizationId, softwareId), page, pageSize, cancellationToken);

    [HttpPost("software/{softwareId:guid}/databases")]
    public async Task<ActionResult<DatabaseDetail>> CreateDatabase(Guid softwareId, DatabaseWriteRequest request, CancellationToken cancellationToken)
    {
        var result = await useCases.CreateDatabaseAsync(new(request.Scope(softwareId), request.Code, request.Name, request.Dialect, request.IntroducedVersionId, request.RemovedVersionId, HttpContext.TraceIdentifier), cancellationToken);
        return CreatedAtAction(nameof(ListDatabases), new { softwareId }, result);
    }

    [HttpPut("software/{softwareId:guid}/databases/{databaseId:guid}")]
    public async Task<DatabaseDetail> UpdateDatabase(Guid softwareId, Guid databaseId, DatabaseWriteRequest request, CancellationToken cancellationToken) =>
        await useCases.UpdateDatabaseAsync(new(request.Scope(softwareId), databaseId, request.Name, request.Dialect, request.IntroducedVersionId, request.RemovedVersionId, request.Active, request.Version, HttpContext.TraceIdentifier), false, cancellationToken);

    [HttpDelete("software/{softwareId:guid}/databases/{databaseId:guid}")]
    public async Task<DatabaseDetail> DeleteDatabase(Guid softwareId, Guid databaseId, Guid tenantId, Guid? organizationId, long version, CancellationToken cancellationToken) =>
        await useCases.UpdateDatabaseAsync(new(new(tenantId, organizationId, softwareId), databaseId, "deleted", "metadata", null, null, false, version, HttpContext.TraceIdentifier), true, cancellationToken);

    [HttpGet("software/{softwareId:guid}/versions")]
    public async Task<CatalogPage<VersionDetail>> ListVersions(Guid softwareId, Guid tenantId, Guid? organizationId, int page, int pageSize, string? filter, CancellationToken cancellationToken) =>
        await useCases.ListVersionsAsync(new(tenantId, organizationId, softwareId), page, pageSize, filter, cancellationToken);

    [HttpPost("software/{softwareId:guid}/versions")]
    public async Task<ActionResult<VersionDetail>> CreateVersion(Guid softwareId, VersionWriteRequest request, CancellationToken cancellationToken)
    {
        var result = await useCases.CreateVersionAsync(new(request.Scope(softwareId), request.Label, request.ReleaseDate, HttpContext.TraceIdentifier), cancellationToken);
        return CreatedAtAction(nameof(GetVersion), new { softwareId, versionId = result.Id, request.TenantId, request.OrganizationId }, result);
    }

    [HttpPut("software/{softwareId:guid}/versions/{versionId:guid}")]
    public async Task<VersionDetail> UpdateVersion(Guid softwareId, Guid versionId, VersionUpdateRequest request, CancellationToken cancellationToken) =>
        await useCases.UpdateVersionAsync(new(request.Scope(softwareId), versionId, request.ReleaseDate, request.Version, HttpContext.TraceIdentifier), cancellationToken);

    [HttpGet("software/{softwareId:guid}/versions/{versionId:guid}")]
    public async Task<VersionDetail> GetVersion(Guid softwareId, Guid versionId, Guid tenantId, Guid? organizationId, CancellationToken cancellationToken) =>
        await useCases.GetVersionAsync(new(tenantId, organizationId, softwareId), versionId, cancellationToken);

    [HttpGet("software/{softwareId:guid}/versions/{versionId:guid}/eligible-references")]
    public async Task<IReadOnlyCollection<VersionDetail>> ListEligibleReferences(Guid softwareId, Guid versionId, Guid tenantId, Guid? organizationId, CancellationToken cancellationToken) =>
        await useCases.ListEligibleReferencesAsync(new(tenantId, organizationId, softwareId), versionId, cancellationToken);

    [HttpGet("software/{softwareId:guid}/versions/{versionId:guid}/effective-databases")]
    public async Task<IReadOnlyCollection<DatabaseDetail>> ListEffectiveDatabases(Guid softwareId, Guid versionId, Guid tenantId, Guid? organizationId, CancellationToken cancellationToken) =>
        await useCases.ListEffectiveDatabasesAsync(new(tenantId, organizationId, softwareId), versionId, cancellationToken);

    [HttpGet("software/{softwareId:guid}/dependency-graph")]
    public async Task<IReadOnlyCollection<VersionDetail>> GetDependencyGraph(Guid softwareId, Guid tenantId, Guid? organizationId, CancellationToken cancellationToken) =>
        await useCases.GetDependencyGraphAsync(new(tenantId, organizationId, softwareId), cancellationToken);

    [HttpPost("software/{softwareId:guid}/versions/{versionId:guid}/dependencies")]
    public async Task<VersionDetail> AddDependency(Guid softwareId, Guid versionId, DependencyRequest request, CancellationToken cancellationToken) =>
        await useCases.AddDependencyAsync(new(request.Scope(softwareId), versionId, request.DependencyId, HttpContext.TraceIdentifier), cancellationToken);

    [HttpPut("software/{softwareId:guid}/versions/{versionId:guid}/retire")]
    public async Task<VersionDetail> RetireVersion(Guid softwareId, Guid versionId, ScopedVersionRequest request, CancellationToken cancellationToken) =>
        await useCases.RetireVersionAsync(request.Scope(softwareId), versionId, request.Version, HttpContext.TraceIdentifier, cancellationToken);
}
