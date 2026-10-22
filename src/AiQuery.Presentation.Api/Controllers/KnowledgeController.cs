using AiQuery.Application.Common;
using AiQuery.Application.Features.VersionedKnowledge.DTOs;
using AiQuery.Application.Features.VersionedKnowledge.Services;
using AiQuery.Presentation.Api.Models.Knowledge;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiQuery.Presentation.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/catalog/software/{softwareId:guid}/versions/{versionId:guid}/knowledge")]
public sealed class KnowledgeController(KnowledgeLifecycleUseCases useCases, IAntiforgery antiforgery) : ControllerBase
{
    [HttpGet("snapshots/latest")]
    public Task<SnapshotDto?> GetLatest(Guid softwareId, Guid versionId, Guid tenantId, Guid organizationId, CancellationToken cancellationToken) =>
        useCases.GetLatestAsync(KnowledgeRequestMapping.Scope(tenantId, organizationId, softwareId, versionId), cancellationToken);

    [HttpPost("snapshots")]
    public async Task<ActionResult<SnapshotDto>> CreateDraft(Guid softwareId, Guid versionId, SnapshotMutationRequest request, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(HttpContext);
        var result = await useCases.CreateDraftAsync(KnowledgeRequestMapping.Scope(request.TenantId, request.OrganizationId, softwareId, versionId), cancellationToken);
        return CreatedAtAction(nameof(ListFiles), new { softwareId, versionId, snapshotId = result.Id, request.TenantId, request.OrganizationId }, result);
    }

    [HttpPost("snapshots/{snapshotId:guid}/files")]
    [RequestFormLimits(MultipartBodyLengthLimit = 110 * 1024 * 1024)]
    [RequestSizeLimit(110 * 1024 * 1024)]
    public async Task<KnowledgeUploadResult> Upload(Guid softwareId, Guid versionId, Guid snapshotId, Guid tenantId, Guid organizationId, IReadOnlyList<IFormFile> files, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(HttpContext);
        var uploads = files.Select(file => new UploadKnowledgeFile(file.FileName, file.ContentType, file.OpenReadStream())).ToArray();
        try
        {
            return await useCases.UploadAsync(KnowledgeRequestMapping.Scope(tenantId, organizationId, softwareId, versionId), snapshotId, uploads, cancellationToken);
        }
        finally
        {
            foreach (var upload in uploads) await upload.Content.DisposeAsync();
        }
    }

    [HttpGet("snapshots/{snapshotId:guid}/files")]
    public Task<PageResult<AiQuery.Application.Common.Interfaces.KnowledgeFileProjection>> ListFiles(Guid softwareId, Guid versionId, Guid snapshotId, Guid tenantId, Guid organizationId, int page = 1, int pageSize = 100, string? folder = null, string? filter = null, CancellationToken cancellationToken = default) =>
        useCases.ListFilesAsync(KnowledgeRequestMapping.Scope(tenantId, organizationId, softwareId, versionId), snapshotId, new(page, pageSize, filter, "path", SortDirection.Ascending), folder, cancellationToken);

    [HttpPost("snapshots/{snapshotId:guid}/ingestion")]
    public async Task<KnowledgeJobResult> StartIngestion(Guid softwareId, Guid versionId, Guid snapshotId, StartIngestionRequest request, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(HttpContext);
        return await useCases.StartIngestionAsync(KnowledgeRequestMapping.Scope(request.TenantId, request.OrganizationId, softwareId, versionId), snapshotId, request.IdempotencyKey, request.Version, cancellationToken);
    }

    [HttpGet("jobs/{jobId:guid}")]
    public Task<KnowledgeJobResult> GetJob(Guid softwareId, Guid versionId, Guid jobId, Guid tenantId, Guid organizationId, CancellationToken cancellationToken) =>
        useCases.GetJobAsync(KnowledgeRequestMapping.Scope(tenantId, organizationId, softwareId, versionId), jobId, cancellationToken);

    [HttpPost("jobs/{jobId:guid}/retry")]
    public async Task<KnowledgeJobResult> Retry(Guid softwareId, Guid versionId, Guid jobId, JobMutationRequest request, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(HttpContext);
        return await useCases.RetryJobAsync(KnowledgeRequestMapping.Scope(request.TenantId, request.OrganizationId, softwareId, versionId), request.SnapshotId, jobId, request.SnapshotVersion, cancellationToken);
    }

    [HttpPost("jobs/{jobId:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid softwareId, Guid versionId, Guid jobId, JobMutationRequest request, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(HttpContext);
        await useCases.CancelJobAsync(KnowledgeRequestMapping.Scope(request.TenantId, request.OrganizationId, softwareId, versionId), request.SnapshotId, jobId, request.SnapshotVersion, cancellationToken);
        return NoContent();
    }

    [HttpPost("snapshots/{snapshotId:guid}/approve")]
    public async Task<SnapshotDto> Approve(Guid softwareId, Guid versionId, Guid snapshotId, SnapshotMutationRequest request, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(HttpContext);
        return await useCases.ReviewAsync(KnowledgeRequestMapping.Scope(request.TenantId, request.OrganizationId, softwareId, versionId), snapshotId, true, request.Version, cancellationToken);
    }

    [HttpPost("snapshots/{snapshotId:guid}/reject")]
    public async Task<SnapshotDto> Reject(Guid softwareId, Guid versionId, Guid snapshotId, SnapshotMutationRequest request, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(HttpContext);
        return await useCases.ReviewAsync(KnowledgeRequestMapping.Scope(request.TenantId, request.OrganizationId, softwareId, versionId), snapshotId, false, request.Version, cancellationToken);
    }

    [HttpPost("snapshots/{snapshotId:guid}/publish")]
    public async Task<CurrentPublicationDto> Publish(Guid softwareId, Guid versionId, Guid snapshotId, PublishSnapshotRequest request, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(HttpContext);
        return await useCases.PublishAsync(KnowledgeRequestMapping.Scope(request.TenantId, request.OrganizationId, softwareId, versionId), snapshotId, request.SnapshotVersion, request.PointerVersion, cancellationToken);
    }

    [HttpPost("snapshots/{snapshotId:guid}/rollback")]
    public async Task<CurrentPublicationDto> Rollback(Guid softwareId, Guid versionId, Guid snapshotId, PublishSnapshotRequest request, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(HttpContext);
        return await useCases.RollbackAsync(KnowledgeRequestMapping.Scope(request.TenantId, request.OrganizationId, softwareId, versionId), snapshotId, request.SnapshotVersion, request.PointerVersion, cancellationToken);
    }

    [HttpGet("diff")]
    public Task<IReadOnlyCollection<AiQuery.Application.Common.Interfaces.KnowledgeDiffProjection>> Diff(Guid softwareId, Guid versionId, Guid leftSnapshotId, Guid rightSnapshotId, Guid tenantId, Guid organizationId, CancellationToken cancellationToken) =>
        useCases.DiffAsync(KnowledgeRequestMapping.Scope(tenantId, organizationId, softwareId, versionId), leftSnapshotId, rightSnapshotId, cancellationToken);
}
