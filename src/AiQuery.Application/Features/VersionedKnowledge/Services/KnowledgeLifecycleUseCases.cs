using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using AiQuery.Application.Common;
using AiQuery.Application.Common.Interfaces;
using AiQuery.Application.Features.VersionedKnowledge.DTOs;
using AiQuery.Application.Features.VersionedKnowledge.Interfaces;
using AiQuery.Domain.Common;
using AiQuery.Domain.VersionedKnowledge;

namespace AiQuery.Application.Features.VersionedKnowledge.Services;

public sealed class KnowledgeLifecycleUseCases(
    IKnowledgeSnapshotStore snapshots,
    IKnowledgeFileStore files,
    IIngestionJobStore jobs,
    IPublicationPointerStore pointers,
    IFileObjectStore objects,
    IUploadSecurityScanner scanner,
    IAuthorizationService authorization,
    ICurrentActor actor,
    IUnitOfWork unitOfWork,
    IOutbox outbox,
    IAuditSink audit,
    IClock clock,
    IIdGenerator ids,
    KnowledgeLifecycleOptions options)
{
    private readonly KnowledgeLifecycleOptions _options = options;

    public async Task<SnapshotDto> CreateDraftAsync(KnowledgeScope scope, CancellationToken cancellationToken)
    {
        await AuthorizeAsync("knowledge.create", scope, cancellationToken);
        var creatorId = RequireActorId();
        var snapshot = KnowledgeSnapshot.Create(new(ids.NewId()), new(scope.VersionId), new(creatorId), clock.UtcNow);
        await snapshots.AddAsync(snapshot, scope.ToAccessScope(), cancellationToken);
        await PersistMutationAsync(snapshot.DomainEvents, "knowledge.snapshot.created", snapshot.Id.Value, cancellationToken);
        return Map(snapshot);
    }

    public async Task<SnapshotDto?> GetLatestAsync(KnowledgeScope scope, CancellationToken cancellationToken)
    {
        await AuthorizeAsync("knowledge.read", scope, cancellationToken);
        var snapshot = await snapshots.FindLatestAsync(new(scope.VersionId), scope.ToAccessScope(), cancellationToken);
        return snapshot is null ? null : Map(snapshot);
    }

    public async Task<KnowledgeUploadResult> UploadAsync(KnowledgeScope scope, Guid snapshotId, IReadOnlyCollection<UploadKnowledgeFile> uploads, CancellationToken cancellationToken)
    {
        await AuthorizeAsync("knowledge.edit", scope, cancellationToken);
        if (uploads.Count is 0 || uploads.Count > _options.MaxFilesPerUpload) throw Validation("files", "تعداد فایل‌های بارگذاری‌شده مجاز نیست.");
        var snapshot = await RequireSnapshotAsync(scope, snapshotId, cancellationToken);
        snapshot.EnsureVersion(snapshot.Version);
        if (snapshot.State == KnowledgeSnapshotState.Draft) snapshot.BeginUpload(clock.UtcNow);
        var createdObjects = new List<string>();
        var results = new List<KnowledgeFileProjection>();
        try
        {
            foreach (var upload in uploads)
            {
                await foreach (var item in ExpandAndValidateAsync(upload, cancellationToken))
                {
                    await using var content = item.Content;
                    var objectId = $"staging/{scope.TenantId:N}/{scope.SoftwareId:N}/{snapshotId:N}/{ids.NewId():N}";
                    var write = await objects.PutAsync(objectId, content, item.MediaType, cancellationToken);
                    createdObjects.Add(write.ObjectId);
                    var revision = await files.AddRevisionAsync(snapshot, scope.ToAccessScope(), new(
                        ids.NewId(), item.Path, write.Sha256, item.MediaType, write.SizeBytes, write.ObjectId, true, clock.UtcNow), cancellationToken);
                    results.Add(revision);
                }
            }

            await PersistMutationAsync(snapshot.DomainEvents, "knowledge.files.uploaded", snapshot.Id.Value, cancellationToken, new Dictionary<string, string> { ["fileCount"] = results.Count.ToString() });
            return new(Map(snapshot), results);
        }
        catch
        {
            foreach (var objectId in createdObjects)
            {
                await objects.DeleteAsync(objectId, CancellationToken.None);
            }
            throw;
        }
    }

    public async Task<KnowledgeJobResult> StartIngestionAsync(KnowledgeScope scope, Guid snapshotId, string idempotencyKey, long expectedVersion, CancellationToken cancellationToken)
    {
        await AuthorizeAsync("knowledge.ingest", scope, cancellationToken);
        if (string.IsNullOrWhiteSpace(idempotencyKey) || idempotencyKey.Length > 200) throw Validation("idempotencyKey", "کلید تکرارپذیری معتبر نیست.");
        var existing = await jobs.FindByIdempotencyKeyAsync(scope.ToAccessScope(), idempotencyKey, cancellationToken);
        if (existing is not null) return Map(existing);
        var snapshot = await RequireSnapshotAsync(scope, snapshotId, cancellationToken);
        snapshot.EnsureVersion(expectedVersion);
        var artifacts = await files.ListArtifactsAsync(snapshot.Id, scope.ToAccessScope(), cancellationToken);
        var manifestHash = ComputeManifestHash(artifacts);
        snapshot.QueueIngestion(SnapshotHash.Create(manifestHash), clock.UtcNow);
        var job = await jobs.EnqueueAsync(ids.NewId(), snapshot, scope.ToAccessScope(), idempotencyKey, clock.UtcNow, cancellationToken);
        await PersistMutationAsync(snapshot.DomainEvents, "knowledge.ingestion.queued", snapshot.Id.Value, cancellationToken, new Dictionary<string, string> { ["jobId"] = job.Id.ToString() });
        return Map(job);
    }

    public async Task<KnowledgeJobResult> GetJobAsync(KnowledgeScope scope, Guid jobId, CancellationToken cancellationToken)
    {
        await AuthorizeAsync("knowledge.read", scope, cancellationToken);
        var job = await jobs.FindAsync(jobId, scope.ToAccessScope(), cancellationToken) ?? throw new ApplicationValidationException(new Dictionary<string, string[]> { ["jobId"] = ["کار پردازش یافت نشد."] });
        return Map(job);
    }

    public async Task CancelJobAsync(KnowledgeScope scope, Guid snapshotId, Guid jobId, long expectedVersion, CancellationToken cancellationToken)
    {
        await AuthorizeAsync("knowledge.ingest", scope, cancellationToken);
        var snapshot = await RequireSnapshotAsync(scope, snapshotId, cancellationToken);
        snapshot.EnsureVersion(expectedVersion);
        snapshot.CancelIngestion();
        await jobs.CancelAsync(jobId, scope.ToAccessScope(), clock.UtcNow, cancellationToken);
        await PersistMutationAsync(snapshot.DomainEvents, "knowledge.ingestion.cancelled", snapshotId, cancellationToken);
    }

    public async Task<KnowledgeJobResult> RetryJobAsync(KnowledgeScope scope, Guid snapshotId, Guid jobId, long expectedVersion, CancellationToken cancellationToken)
    {
        await AuthorizeAsync("knowledge.ingest", scope, cancellationToken);
        var snapshot = await RequireSnapshotAsync(scope, snapshotId, cancellationToken);
        snapshot.EnsureVersion(expectedVersion);
        if (snapshot.ManifestHash is null) throw new InvalidOperationException("Snapshot manifest is missing.");
        snapshot.QueueIngestion(snapshot.ManifestHash, clock.UtcNow);
        await jobs.RetryAsync(jobId, scope.ToAccessScope(), clock.UtcNow, cancellationToken);
        await PersistMutationAsync(snapshot.DomainEvents, "knowledge.ingestion.retried", snapshotId, cancellationToken);
        return Map((await jobs.FindAsync(jobId, scope.ToAccessScope(), cancellationToken))!);
    }

    public async Task<SnapshotDto> ReviewAsync(KnowledgeScope scope, Guid snapshotId, bool approve, long expectedVersion, CancellationToken cancellationToken)
    {
        await AuthorizeAsync(approve ? "knowledge.approve" : "knowledge.review", scope, cancellationToken);
        var snapshot = await RequireSnapshotAsync(scope, snapshotId, cancellationToken);
        snapshot.EnsureVersion(expectedVersion);
        if (approve) snapshot.Approve(new(RequireActorId()), clock.UtcNow);
        else snapshot.RejectReview(new(RequireActorId()), clock.UtcNow);
        await PersistMutationAsync(snapshot.DomainEvents, approve ? "knowledge.approved" : "knowledge.rejected", snapshotId, cancellationToken);
        return Map(snapshot);
    }

    public async Task<CurrentPublicationDto> PublishAsync(KnowledgeScope scope, Guid snapshotId, long snapshotVersion, long pointerVersion, CancellationToken cancellationToken)
    {
        await AuthorizeAsync("knowledge.publish", scope, cancellationToken);
        var snapshot = await RequireSnapshotAsync(scope, snapshotId, cancellationToken);
        snapshot.EnsureVersion(snapshotVersion);
        snapshot.Publish(clock.UtcNow);
        var pointer = await pointers.GetOrCreateAsync(new(scope.VersionId), scope.ToAccessScope(), cancellationToken);
        pointer.MoveTo(snapshot, pointerVersion, clock.UtcNow);
        await PersistMutationAsync(snapshot.DomainEvents.Concat(pointer.DomainEvents).ToArray(), "knowledge.published", snapshotId, cancellationToken);
        return new(scope.VersionId, snapshotId, pointer.Version);
    }

    public async Task<CurrentPublicationDto> RollbackAsync(KnowledgeScope scope, Guid targetSnapshotId, long targetVersion, long pointerVersion, CancellationToken cancellationToken)
    {
        await AuthorizeAsync("knowledge.rollback", scope, cancellationToken);
        var target = await RequireSnapshotAsync(scope, targetSnapshotId, cancellationToken);
        target.EnsureVersion(targetVersion);
        if (target.State == KnowledgeSnapshotState.Retired) target.RestorePublication(clock.UtcNow);
        var pointer = await pointers.GetOrCreateAsync(new(scope.VersionId), scope.ToAccessScope(), cancellationToken);
        pointer.MoveTo(target, pointerVersion, clock.UtcNow);
        await PersistMutationAsync(target.DomainEvents.Concat(pointer.DomainEvents).ToArray(), "knowledge.rolled_back", targetSnapshotId, cancellationToken);
        return new(scope.VersionId, targetSnapshotId, pointer.Version);
    }

    public async Task<PageResult<KnowledgeFileProjection>> ListFilesAsync(KnowledgeScope scope, Guid snapshotId, PageRequest page, string? folder, CancellationToken cancellationToken)
    {
        await AuthorizeAsync("knowledge.read", scope, cancellationToken);
        return await files.ListAsync(new(snapshotId), scope.ToAccessScope(), page, folder, cancellationToken);
    }

    public async Task<IReadOnlyCollection<KnowledgeDiffProjection>> DiffAsync(KnowledgeScope scope, Guid leftId, Guid rightId, CancellationToken cancellationToken)
    {
        await AuthorizeAsync("knowledge.read", scope, cancellationToken);
        return await files.DiffAsync(new(leftId), new(rightId), scope.ToAccessScope(), cancellationToken);
    }

    private async IAsyncEnumerable<ValidatedUpload> ExpandAndValidateAsync(UploadKnowledgeFile upload, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var logicalPath = FileIdentity.NormalizeLogicalPath(Path.GetFileName(upload.FileName));
        var extension = Path.GetExtension(logicalPath).ToLowerInvariant();
        if (!_options.AllowedExtensions.Contains(extension, StringComparer.OrdinalIgnoreCase)) throw Validation("files", "پسوند فایل مجاز نیست.");
        var bounded = await ReadBoundedAsync(upload.Content, _options.MaxFileSizeBytes, cancellationToken);
        if (extension == ".zip")
        {
            await foreach (var entry in ExpandArchiveAsync(bounded, cancellationToken)) yield return entry;
            yield break;
        }
        var mediaType = DetectMediaType(extension, bounded);
        bounded.Position = 0;
        var scan = await scanner.ScanAsync(bounded, logicalPath, cancellationToken);
        if (!scan.IsClean) throw Validation("files", "فایل در بررسی امنیتی رد شد.");
        bounded.Position = 0;
        yield return new(logicalPath, mediaType, bounded);
    }

    private async IAsyncEnumerable<ValidatedUpload> ExpandArchiveAsync(MemoryStream archiveContent, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken)
    {
        using var archive = new ZipArchive(archiveContent, ZipArchiveMode.Read, leaveOpen: true);
        if (archive.Entries.Count > _options.MaxArchiveEntries) throw Validation("files", "تعداد ورودی‌های آرشیو بیش از حد مجاز است.");
        long expanded = 0;
        var paths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var entry in archive.Entries.Where(item => !string.IsNullOrEmpty(item.Name)))
        {
            cancellationToken.ThrowIfCancellationRequested();
            var path = FileIdentity.NormalizeLogicalPath(entry.FullName);
            if (!paths.Add(path)) throw Validation("files", "مسیر تکراری پس از نرمال‌سازی در آرشیو وجود دارد.");
            if (Path.GetExtension(path).Equals(".zip", StringComparison.OrdinalIgnoreCase)) throw Validation("files", "آرشیو تو در تو مجاز نیست.");
            expanded += entry.Length;
            if (expanded > _options.MaxArchiveExpandedBytes || entry.Length > _options.MaxFileSizeBytes) throw Validation("files", "حجم بازشده آرشیو بیش از حد مجاز است.");
            if (entry.CompressedLength > 0 && entry.Length / (double)entry.CompressedLength > _options.MaxCompressionRatio) throw Validation("files", "نسبت فشرده‌سازی آرشیو غیرمجاز است.");
            var extension = Path.GetExtension(path).ToLowerInvariant();
            if (!_options.AllowedExtensions.Where(item => item != ".zip").Contains(extension, StringComparer.OrdinalIgnoreCase)) throw Validation("files", "پسوند یکی از فایل‌های آرشیو مجاز نیست.");
            await using var source = entry.Open();
            var content = await ReadBoundedAsync(source, _options.MaxFileSizeBytes, cancellationToken);
            var mediaType = DetectMediaType(extension, content);
            content.Position = 0;
            var scan = await scanner.ScanAsync(content, path, cancellationToken);
            if (!scan.IsClean) throw Validation("files", "یکی از فایل‌های آرشیو در بررسی امنیتی رد شد.");
            content.Position = 0;
            yield return new(path, mediaType, content);
        }
    }

    private static async Task<MemoryStream> ReadBoundedAsync(Stream source, long limit, CancellationToken cancellationToken)
    {
        var output = new MemoryStream();
        var buffer = new byte[81920];
        long total = 0;
        while (true)
        {
            var read = await source.ReadAsync(buffer, cancellationToken);
            if (read == 0) break;
            total += read;
            if (total > limit) { await output.DisposeAsync(); throw Validation("files", "حجم فایل بیش از حد مجاز است."); }
            await output.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
        }
        output.Position = 0;
        return output;
    }

    private static string DetectMediaType(string extension, Stream content)
    {
        Span<byte> signature = stackalloc byte[8];
        var read = content.Read(signature);
        content.Position = 0;
        if (extension == ".pdf" && (read < 5 || !signature[..5].SequenceEqual("%PDF-"u8))) throw Validation("files", "امضای فایل PDF معتبر نیست.");
        return extension switch { ".sql" => "application/sql", ".md" => "text/markdown", ".txt" => "text/plain", ".json" => "application/json", ".yaml" or ".yml" => "application/yaml", ".csv" => "text/csv", ".pdf" => "application/pdf", _ => "application/octet-stream" };
    }

    private static string ComputeManifestHash(IEnumerable<KnowledgeFileProjection> artifacts)
    {
        var canonical = string.Join('\n', artifacts.OrderBy(item => item.Path, StringComparer.Ordinal).Select(item => $"{item.Path}\t{item.ContentHash}\t{item.SizeBytes}\t{item.IsActive}"));
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical))).ToLowerInvariant();
    }

    private async Task<KnowledgeSnapshot> RequireSnapshotAsync(KnowledgeScope scope, Guid snapshotId, CancellationToken cancellationToken) =>
        await snapshots.FindAsync(new(snapshotId), scope.ToAccessScope(), cancellationToken) ?? throw new ApplicationValidationException(new Dictionary<string, string[]> { ["snapshotId"] = ["نسخه دانش یافت نشد."] });

    private async Task AuthorizeAsync(string permission, KnowledgeScope scope, CancellationToken cancellationToken)
    {
        if (!await authorization.IsAuthorizedAsync(new(permission, scope.ToAccessScope()), cancellationToken)) throw new ApplicationAuthorizationException("knowledge.scope.forbidden", "دسترسی به محدوده دانش مجاز نیست.");
    }

    private Guid RequireActorId() => Guid.TryParse(actor.ActorId, out var id) ? id : throw new ApplicationAuthenticationException("auth.actor.invalid", "شناسه کاربر معتبر نیست.");

    private async Task PersistMutationAsync(IReadOnlyCollection<IDomainEvent> events, string eventCode, Guid snapshotId, CancellationToken cancellationToken, IReadOnlyDictionary<string, string>? metadata = null)
    {
        await outbox.EnqueueAsync(events, cancellationToken);
        var safe = new Dictionary<string, string>(metadata ?? new Dictionary<string, string>()) { ["snapshotId"] = snapshotId.ToString() };
        await audit.WriteAsync(new(eventCode, Guid.NewGuid().ToString("N"), actor.ActorId, clock.UtcNow, safe), cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private static ApplicationValidationException Validation(string field, string message) => new(new Dictionary<string, string[]> { [field] = [message] });
    private static SnapshotDto Map(KnowledgeSnapshot snapshot) => new(snapshot.Id.Value, snapshot.SoftwareVersionId.Value, snapshot.State.ToString(), snapshot.ManifestHash?.Value, snapshot.IngestedHash?.Value, snapshot.ApprovedBy?.Value, snapshot.Version);
    private static KnowledgeJobResult Map(IngestionJobProjection job) => new(job.Id, job.SnapshotId, job.State, job.Progress, job.AttemptCount, job.MaxAttempts, job.LastErrorCode, job.Version);
    private sealed record ValidatedUpload(string Path, string MediaType, MemoryStream Content);
}
