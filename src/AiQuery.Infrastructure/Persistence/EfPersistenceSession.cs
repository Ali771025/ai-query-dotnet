using System.Text.Json;
using AiQuery.Application.Common.Interfaces;
using AiQuery.Application.Features.AuditQuality.Commands.SubmitQueryFeedback;
using AiQuery.Application.Common;
using AiQuery.Domain.Common;
using AiQuery.Domain.QueryGeneration;
using AiQuery.Domain.SoftwareCatalog;
using AiQuery.Domain.VersionedKnowledge;
using AiQuery.Infrastructure.Persistence.Records;
using Microsoft.EntityFrameworkCore;

namespace AiQuery.Infrastructure.Persistence;

internal sealed class EfPersistenceSession(AppDbContext dbContext, IClock clock) :
    ISoftwareProductStore,
    ISoftwareCatalogReadStore,
    IKnowledgeSnapshotStore,
    IKnowledgeFileStore,
    IPublicationPointerStore,
    IQueryResultReadStore,
    IQueryFeedbackStore,
    IIdempotencyStore,
    IUnitOfWork,
    IOutbox,
    IAuditSink
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly Dictionary<SoftwareProduct, SoftwareProductRecord> _trackedProducts = [];
    private readonly Dictionary<KnowledgeSnapshot, KnowledgeSnapshotRecord> _trackedSnapshots = [];
    private readonly Dictionary<PublicationPointer, PublicationPointerRecord> _trackedPointers = [];

    public ValueTask<bool> CodeExistsAsync(TenantId tenantId, OrganizationId ownerId, SoftwareCode code, CancellationToken cancellationToken) =>
        new(dbContext.SoftwareProducts.IgnoreQueryFilters().AnyAsync(row => row.TenantId == tenantId.Value && row.OwnerOrganizationId == ownerId.Value && row.Code == code.Value && !row.IsDeleted, cancellationToken));

    public ValueTask AddAsync(SoftwareProduct product, AccessScope scope, CancellationToken cancellationToken)
    {
        RequireSoftwareScope(scope, product.Id);
        if (scope.OrganizationId is null) throw new ApplicationAuthorizationException("scope.organization.required", "Organization scope is required.");
        var row = new SoftwareProductRecord
        {
            Id = product.Id.Value,
            TenantId = scope.TenantId.Value,
            OwnerOrganizationId = product.OwnerOrganizationId.Value,
            Code = product.Code.Value,
            Name = product.Name,
            Version = product.Version
        };
        foreach (var version in product.Versions)
        {
            var versionRow = new SoftwareVersionRecord { Id = version.Id.Value, SoftwareProductId = product.Id.Value, Label = version.Label.Value, Version = 0 };
            foreach (var dependency in version.Dependencies) versionRow.Dependencies.Add(new VersionDependencyRecord { SoftwareVersionId = version.Id.Value, DependencyVersionId = dependency.Value });
            row.Versions.Add(versionRow);
        }
        dbContext.SoftwareProducts.Add(row);
        _trackedProducts.Add(product, row);
        return ValueTask.CompletedTask;
    }

    public async ValueTask<SoftwareProduct?> FindAsync(SoftwareProductId id, AccessScope scope, CancellationToken cancellationToken)
    {
        var query = dbContext.SoftwareProducts.Where(row => row.Id == id.Value && row.TenantId == scope.TenantId.Value);
        if (scope.OrganizationId is { } organizationId) query = query.Where(row => row.OwnerOrganizationId == organizationId.Value);
        var row = await query.Include(item => item.Versions).ThenInclude(item => item.Dependencies).SingleOrDefaultAsync(cancellationToken);
        if (row is null) return null;
        var product = SoftwareProduct.Rehydrate(new(row.Id), new(row.OwnerOrganizationId), SoftwareCode.Create(row.Code), row.Name, row.Version,
            row.Versions.Select(version => (new SoftwareVersionId(version.Id), VersionLabel.Create(version.Label), (IReadOnlyCollection<SoftwareVersionId>)version.Dependencies.Select(dependency => new SoftwareVersionId(dependency.DependencyVersionId)).ToArray())));
        _trackedProducts.Add(product, row);
        return product;
    }

    public async ValueTask<PageResult<SoftwareProductListItem>> ListAsync(PageRequest page, AccessScope scope, CancellationToken cancellationToken)
    {
        var query = dbContext.SoftwareProducts.AsNoTracking().Where(row => row.TenantId == scope.TenantId.Value);
        if (scope.OrganizationId is { } organizationId) query = query.Where(row => row.OwnerOrganizationId == organizationId.Value);
        if (!string.IsNullOrWhiteSpace(page.Filter)) query = query.Where(row => EF.Functions.ILike(row.Code, $"%{page.Filter}%") || EF.Functions.ILike(row.Name, $"%{page.Filter}%"));
        query = (page.SortBy, page.Direction) switch
        {
            ("name", SortDirection.Ascending) => query.OrderBy(row => row.Name).ThenBy(row => row.Id),
            ("name", SortDirection.Descending) => query.OrderByDescending(row => row.Name).ThenBy(row => row.Id),
            ("versionCount", SortDirection.Ascending) => query.OrderBy(row => row.Versions.Count).ThenBy(row => row.Id),
            ("versionCount", SortDirection.Descending) => query.OrderByDescending(row => row.Versions.Count).ThenBy(row => row.Id),
            (_, SortDirection.Descending) => query.OrderByDescending(row => row.Code).ThenBy(row => row.Id),
            _ => query.OrderBy(row => row.Code).ThenBy(row => row.Id)
        };
        var total = await query.LongCountAsync(cancellationToken);
        var items = await query.Skip((page.PageNumber - 1) * page.PageSize).Take(page.PageSize)
            .Select(row => new SoftwareProductListItem(row.Id, row.Code, row.Name, row.Versions.Count, row.Version)).ToArrayAsync(cancellationToken);
        return new PageResult<SoftwareProductListItem>(items, page.PageNumber, page.PageSize, total);
    }

    public ValueTask AddAsync(KnowledgeSnapshot snapshot, AccessScope scope, CancellationToken cancellationToken)
    {
        RequireVersionScope(scope, snapshot.SoftwareVersionId);
        var row = new KnowledgeSnapshotRecord { Id = snapshot.Id.Value, SoftwareVersionId = snapshot.SoftwareVersionId.Value, CreatorId = snapshot.CreatorId.Value, CreatedAtUtc = clock.UtcNow, State = snapshot.State.ToString(), ManifestHash = snapshot.ManifestHash?.Value, IngestedHash = snapshot.IngestedHash?.Value, ApprovedBy = snapshot.ApprovedBy?.Value, Version = snapshot.Version };
        foreach (var revision in snapshot.Revisions) row.Files.Add(new SnapshotFileRecord { KnowledgeSnapshotId = snapshot.Id.Value, FileRevisionId = revision.Id.Value });
        dbContext.KnowledgeSnapshots.Add(row);
        _trackedSnapshots.Add(snapshot, row);
        return ValueTask.CompletedTask;
    }

    public async ValueTask<KnowledgeSnapshot?> FindAsync(KnowledgeSnapshotId id, AccessScope scope, CancellationToken cancellationToken)
    {
        var query = ScopedSnapshots(scope).Where(row => row.Id == id.Value);
        var row = await query.Include(item => item.Files).SingleOrDefaultAsync(cancellationToken);
        if (row is null) return null;
        var revisionIds = row.Files.Select(file => file.FileRevisionId).ToArray();
        var revisions = await dbContext.Set<FileRevisionRecord>().Where(item => revisionIds.Contains(item.Id)).ToArrayAsync(cancellationToken);
        var snapshot = KnowledgeSnapshot.Rehydrate(new(row.Id), new(row.SoftwareVersionId), new(row.CreatorId), ParseSnapshotState(row.State), row.IngestedHash is null ? null : SnapshotHash.Create(row.IngestedHash), row.ApprovedBy is null ? null : new UserId(row.ApprovedBy.Value), row.Version,
            revisions.Select(revision => new FileRevision(new(revision.Id), new(revision.FileIdentityId), revision.RevisionNumber, SnapshotHash.Create(revision.ContentHash), revision.MediaType, revision.SizeBytes, revision.ObjectReference, revision.IsActive, revision.CreatedAtUtc)), row.ManifestHash is null ? null : SnapshotHash.Create(row.ManifestHash));
        _trackedSnapshots.Add(snapshot, row);
        return snapshot;
    }

    public async ValueTask<KnowledgeSnapshot?> FindLatestAsync(SoftwareVersionId versionId, AccessScope scope, CancellationToken cancellationToken)
    {
        var id = await ScopedSnapshots(scope).Where(row => row.SoftwareVersionId == versionId.Value).OrderByDescending(row => row.CreatedAtUtc).Select(row => (Guid?)row.Id).FirstOrDefaultAsync(cancellationToken);
        return id is null ? null : await FindAsync(new KnowledgeSnapshotId(id.Value), scope, cancellationToken);
    }

    public async ValueTask<KnowledgeFileProjection> AddRevisionAsync(KnowledgeSnapshot snapshot, AccessScope scope, KnowledgeFileWrite write, CancellationToken cancellationToken)
    {
        RequireVersionScope(scope, snapshot.SoftwareVersionId);
        var path = FileIdentity.NormalizeLogicalPath(write.LogicalPath);
        var file = await dbContext.Set<KnowledgeFileRecord>().SingleOrDefaultAsync(row => row.TenantId == scope.TenantId.Value && row.SoftwareProductId == scope.SoftwareId!.Value.Value && row.LogicalName.ToLower() == path.ToLower(), cancellationToken);
        if (file is null)
        {
            file = new KnowledgeFileRecord { Id = Guid.NewGuid(), TenantId = scope.TenantId.Value, SoftwareProductId = scope.SoftwareId!.Value.Value, LogicalName = path, Version = 0 };
            dbContext.Set<KnowledgeFileRecord>().Add(file);
        }
        var nextRevision = await dbContext.Set<FileRevisionRecord>().Where(row => row.FileIdentityId == file.Id).Select(row => (int?)row.RevisionNumber).MaxAsync(cancellationToken) ?? 0;
        var revision = new FileRevision(new(write.RevisionId), new(file.Id), nextRevision + 1, SnapshotHash.Create(write.ContentHash), write.MediaType, write.SizeBytes, write.ObjectReference, write.IsActive, write.CreatedAtUtc);
        snapshot.AddRevision(revision);
        dbContext.Set<FileRevisionRecord>().Add(new FileRevisionRecord { Id = write.RevisionId, FileIdentityId = file.Id, RevisionNumber = revision.RevisionNumber, ContentHash = write.ContentHash, ObjectReference = write.ObjectReference, MediaType = write.MediaType, SizeBytes = write.SizeBytes, IsActive = write.IsActive, CreatedAtUtc = write.CreatedAtUtc });
        return new(file.Id, write.RevisionId, path, revision.RevisionNumber, write.ContentHash, write.MediaType, write.SizeBytes, write.ObjectReference, write.IsActive, write.CreatedAtUtc);
    }

    public async ValueTask<PageResult<KnowledgeFileProjection>> ListAsync(KnowledgeSnapshotId snapshotId, AccessScope scope, PageRequest page, string? folder, CancellationToken cancellationToken)
    {
        var query = ScopedFileProjections(snapshotId, scope);
        if (!string.IsNullOrWhiteSpace(folder))
        {
            var prefix = FileIdentity.NormalizeLogicalPath(folder).TrimEnd('/') + "/";
            query = query.Where(row => row.File.LogicalName.StartsWith(prefix));
        }
        if (!string.IsNullOrWhiteSpace(page.Filter)) query = query.Where(row => EF.Functions.ILike(row.File.LogicalName, $"%{page.Filter}%"));
        var total = await query.LongCountAsync(cancellationToken);
        var rows = await query.OrderBy(row => row.File.LogicalName).Skip((page.PageNumber - 1) * page.PageSize).Take(page.PageSize).ToArrayAsync(cancellationToken);
        return new(rows.Select(MapFile).ToArray(), page.PageNumber, page.PageSize, total);
    }

    public async ValueTask<IReadOnlyCollection<KnowledgeFileProjection>> ListArtifactsAsync(KnowledgeSnapshotId snapshotId, AccessScope scope, CancellationToken cancellationToken) =>
        (await ScopedFileProjections(snapshotId, scope).OrderBy(row => row.File.LogicalName).ToArrayAsync(cancellationToken)).Select(MapFile).ToArray();

    public async ValueTask<IReadOnlyCollection<KnowledgeDiffProjection>> DiffAsync(KnowledgeSnapshotId leftId, KnowledgeSnapshotId rightId, AccessScope scope, CancellationToken cancellationToken)
    {
        var left = (await ScopedFileProjections(leftId, scope).ToArrayAsync(cancellationToken)).ToDictionary(row => row.File.LogicalName, row => row.Revision.ContentHash, StringComparer.OrdinalIgnoreCase);
        var right = (await ScopedFileProjections(rightId, scope).ToArrayAsync(cancellationToken)).ToDictionary(row => row.File.LogicalName, row => row.Revision.ContentHash, StringComparer.OrdinalIgnoreCase);
        return left.Keys.Union(right.Keys, StringComparer.OrdinalIgnoreCase).Order(StringComparer.OrdinalIgnoreCase).Select(path =>
        {
            left.TryGetValue(path, out var leftHash); right.TryGetValue(path, out var rightHash);
            var kind = leftHash is null ? "Added" : rightHash is null ? "Removed" : leftHash == rightHash ? "Unchanged" : "Modified";
            return new KnowledgeDiffProjection(path, kind, leftHash, rightHash);
        }).ToArray();
    }

    public async ValueTask<PublicationPointer> GetOrCreateAsync(SoftwareVersionId versionId, AccessScope scope, CancellationToken cancellationToken)
    {
        RequireVersionScope(scope, versionId);
        var versionVisible = await dbContext.SoftwareVersions.AnyAsync(row => row.Id == versionId.Value && row.SoftwareProduct!.TenantId == scope.TenantId.Value && (scope.OrganizationId == null || row.SoftwareProduct.OwnerOrganizationId == scope.OrganizationId.Value.Value) && (scope.SoftwareId == null || row.SoftwareProductId == scope.SoftwareId.Value.Value), cancellationToken);
        if (!versionVisible) throw new ApplicationAuthorizationException("scope.version.not_found", "Software version is outside the authorized scope.");
        var row = await dbContext.PublicationPointers.SingleOrDefaultAsync(item => item.SoftwareVersionId == versionId.Value, cancellationToken);
        row ??= new PublicationPointerRecord { SoftwareVersionId = versionId.Value, Version = 0 };
        if (dbContext.Entry(row).State == EntityState.Detached) dbContext.PublicationPointers.Add(row);
        var pointer = PublicationPointer.Rehydrate(versionId, row.ActiveSnapshotId is null ? null : new KnowledgeSnapshotId(row.ActiveSnapshotId.Value), row.Version);
        _trackedPointers.Add(pointer, row);
        return pointer;
    }

    public async ValueTask<bool> ExistsForActorAsync(QueryResultId resultId, UserId actorId, CancellationToken cancellationToken) =>
        await dbContext.QueryResults.AnyAsync(result => result.Id == resultId.Value && dbContext.Set<QueryAttemptRecord>().Any(attempt => attempt.Id == result.QueryAttemptId && dbContext.Set<QueryRequestRecord>().Any(request => request.Id == attempt.QueryRequestId && request.ActorId == actorId.Value)), cancellationToken);

    public ValueTask AddAsync(QueryFeedback feedback, CancellationToken cancellationToken)
    {
        dbContext.FeedbackEntries.Add(new FeedbackEntryRecord { Id = feedback.Id.Value, QueryResultId = feedback.ResultId.Value, ActorId = feedback.ActorId.Value, ActorType = "user", Helpful = feedback.Helpful, Comment = feedback.Comment, CreatedAtUtc = clock.UtcNow });
        return ValueTask.CompletedTask;
    }

    public async ValueTask<T?> GetAsync<T>(string key, CancellationToken cancellationToken) where T : class
    {
        var row = await dbContext.IdempotencyRecords.AsNoTracking().SingleOrDefaultAsync(item => item.Key == key && item.ExpiresAtUtc > clock.UtcNow, cancellationToken);
        return row is null ? null : JsonSerializer.Deserialize<T>(row.ResponseJson, JsonOptions);
    }

    public ValueTask StoreAsync<T>(string key, T value, CancellationToken cancellationToken) where T : class
    {
        dbContext.IdempotencyRecords.Add(new IdempotencyRecord { Key = key, ResponseType = typeof(T).FullName ?? typeof(T).Name, ResponseJson = JsonSerializer.Serialize(value, JsonOptions), CreatedAtUtc = clock.UtcNow, ExpiresAtUtc = clock.UtcNow.AddHours(24) });
        return ValueTask.CompletedTask;
    }

    public ValueTask EnqueueAsync(IReadOnlyCollection<IDomainEvent> events, CancellationToken cancellationToken)
    {
        foreach (var domainEvent in events) dbContext.OutboxMessages.Add(new OutboxMessageRecord { Id = Guid.NewGuid(), OccurredAtUtc = domainEvent.OccurredAtUtc, Type = domainEvent.GetType().FullName ?? domainEvent.GetType().Name, PayloadJson = JsonSerializer.Serialize(domainEvent, domainEvent.GetType(), JsonOptions) });
        return ValueTask.CompletedTask;
    }

    public ValueTask WriteAsync(AuditRecord record, CancellationToken cancellationToken = default)
    {
        dbContext.Set<AuditEventRecord>().Add(new AuditEventRecord { Id = Guid.NewGuid(), EventCode = record.EventCode, CorrelationId = record.CorrelationId, ActorId = record.ActorId, OccurredAtUtc = record.OccurredAtUtc, SafeMetadataJson = JsonSerializer.Serialize(record.SafeMetadata, JsonOptions) });
        return ValueTask.CompletedTask;
    }

    public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        foreach (var (aggregate, row) in _trackedProducts)
        {
            row.Name = aggregate.Name;
            row.Version = aggregate.Version;
            foreach (var version in aggregate.Versions.Where(version => row.Versions.All(existing => existing.Id != version.Id.Value)))
            {
                var versionRow = new SoftwareVersionRecord { Id = version.Id.Value, SoftwareProductId = aggregate.Id.Value, Label = version.Label.Value, Version = 0 };
                foreach (var dependency in version.Dependencies) versionRow.Dependencies.Add(new VersionDependencyRecord { SoftwareVersionId = version.Id.Value, DependencyVersionId = dependency.Value });
                row.Versions.Add(versionRow);
            }
        }
        foreach (var (aggregate, row) in _trackedSnapshots)
        {
            row.State = aggregate.State.ToString(); row.ManifestHash = aggregate.ManifestHash?.Value; row.IngestedHash = aggregate.IngestedHash?.Value; row.ApprovedBy = aggregate.ApprovedBy?.Value; row.Version = aggregate.Version;
            foreach (var revision in aggregate.Revisions.Where(revision => row.Files.All(existing => existing.FileRevisionId != revision.Id.Value))) row.Files.Add(new SnapshotFileRecord { KnowledgeSnapshotId = aggregate.Id.Value, FileRevisionId = revision.Id.Value });
        }
        foreach (var (aggregate, row) in _trackedPointers) { row.ActiveSnapshotId = aggregate.ActiveSnapshotId?.Value; row.Version = aggregate.Version; }
        try { return await dbContext.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException exception) { throw new ApplicationConcurrencyException("The persisted aggregate changed after it was loaded.", exception); }
    }

    private IQueryable<KnowledgeSnapshotRecord> ScopedSnapshots(AccessScope scope)
    {
        var query = dbContext.KnowledgeSnapshots.Where(row => row.SoftwareVersion!.SoftwareProduct!.TenantId == scope.TenantId.Value);
        if (scope.OrganizationId is { } organizationId) query = query.Where(row => row.SoftwareVersion!.SoftwareProduct!.OwnerOrganizationId == organizationId.Value);
        if (scope.SoftwareId is { } softwareId) query = query.Where(row => row.SoftwareVersion!.SoftwareProductId == softwareId.Value);
        if (scope.VersionId is { } versionId) query = query.Where(row => row.SoftwareVersionId == versionId.Value);
        return query;
    }

    private IQueryable<FileProjectionRow> ScopedFileProjections(KnowledgeSnapshotId snapshotId, AccessScope scope) =>
        from link in dbContext.Set<SnapshotFileRecord>()
        join snapshot in ScopedSnapshots(scope) on link.KnowledgeSnapshotId equals snapshot.Id
        join revision in dbContext.Set<FileRevisionRecord>() on link.FileRevisionId equals revision.Id
        join file in dbContext.Set<KnowledgeFileRecord>() on revision.FileIdentityId equals file.Id
        where snapshot.Id == snapshotId.Value
        select new FileProjectionRow(file, revision);

    private static KnowledgeFileProjection MapFile(FileProjectionRow row) => new(row.File.Id, row.Revision.Id, row.File.LogicalName, row.Revision.RevisionNumber, row.Revision.ContentHash, row.Revision.MediaType, row.Revision.SizeBytes, row.Revision.ObjectReference, row.Revision.IsActive, row.Revision.CreatedAtUtc);
    private static KnowledgeSnapshotState ParseSnapshotState(string state) => state switch { "Ingesting" => KnowledgeSnapshotState.Processing, "IngestionFailed" => KnowledgeSnapshotState.Failed, _ => Enum.Parse<KnowledgeSnapshotState>(state) };
    private sealed record FileProjectionRow(KnowledgeFileRecord File, FileRevisionRecord Revision);

    private static void RequireSoftwareScope(AccessScope scope, SoftwareProductId productId)
    {
        if (scope.SoftwareId is not null && scope.SoftwareId != productId) throw new ApplicationAuthorizationException("scope.software.invalid", "Software is outside the authorized scope.");
    }
    private static void RequireVersionScope(AccessScope scope, SoftwareVersionId versionId)
    {
        if (scope.VersionId is not null && scope.VersionId != versionId) throw new ApplicationAuthorizationException("scope.version.invalid", "Version is outside the authorized scope.");
    }
}
