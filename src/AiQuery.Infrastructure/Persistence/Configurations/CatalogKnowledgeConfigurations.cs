using AiQuery.Infrastructure.Persistence.Records;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiQuery.Infrastructure.Persistence.Configurations;

internal sealed class OrganizationConfiguration : IEntityTypeConfiguration<OrganizationRecord>
{
    public void Configure(EntityTypeBuilder<OrganizationRecord> b)
    {
        b.ToTable("organizations"); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Code).HasMaxLength(50); b.Property(x => x.Name).HasMaxLength(200); b.Property(x => x.Version).IsConcurrencyToken();
        b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
    }
}

internal sealed class SoftwareProductConfiguration : IEntityTypeConfiguration<SoftwareProductRecord>
{
    public void Configure(EntityTypeBuilder<SoftwareProductRecord> b)
    {
        b.ToTable("software_products", table => table.HasCheckConstraint("ck_software_products_version", "version >= 0")); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Code).HasMaxLength(50); b.Property(x => x.Name).HasMaxLength(200); b.Property(x => x.Status).HasMaxLength(20).HasDefaultValue("Active"); b.Property(x => x.Version).IsConcurrencyToken();
        b.HasIndex(x => new { x.TenantId, x.OwnerOrganizationId, x.Code }).IsUnique(); b.HasIndex(x => new { x.TenantId, x.IsDeleted, x.Name });
        b.HasOne(x => x.OwnerOrganization).WithMany().HasForeignKey(x => x.OwnerOrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

internal sealed class SoftwareDatabaseConfiguration : IEntityTypeConfiguration<SoftwareDatabaseRecord>
{
    public void Configure(EntityTypeBuilder<SoftwareDatabaseRecord> b)
    {
        b.ToTable("software_databases"); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.Code).HasMaxLength(100); b.Property(x => x.Name).HasMaxLength(150); b.Property(x => x.Dialect).HasMaxLength(40); b.Property(x => x.Version).IsConcurrencyToken();
        b.HasIndex(x => new { x.SoftwareProductId, x.Code }).IsUnique(); b.HasOne(x => x.SoftwareProduct).WithMany().HasForeignKey(x => x.SoftwareProductId).OnDelete(DeleteBehavior.Restrict); b.HasOne<SoftwareVersionRecord>().WithMany().HasForeignKey(x => x.IntroducedVersionId).OnDelete(DeleteBehavior.Restrict); b.HasOne<SoftwareVersionRecord>().WithMany().HasForeignKey(x => x.RemovedVersionId).OnDelete(DeleteBehavior.Restrict); b.HasQueryFilter(x => !x.SoftwareProduct!.IsDeleted);
    }
}

internal sealed class SoftwareVersionConfiguration : IEntityTypeConfiguration<SoftwareVersionRecord>
{
    public void Configure(EntityTypeBuilder<SoftwareVersionRecord> b)
    {
        b.ToTable("software_versions", table => table.HasCheckConstraint("ck_software_versions_version", "version >= 0")); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.Label).HasMaxLength(64); b.Property(x => x.Status).HasMaxLength(20).HasDefaultValue("Active"); b.Property(x => x.Version).IsConcurrencyToken();
        b.HasIndex(x => new { x.SoftwareProductId, x.Label }).IsUnique(); b.HasOne(x => x.SoftwareProduct).WithMany(x => x.Versions).HasForeignKey(x => x.SoftwareProductId).OnDelete(DeleteBehavior.Restrict);
        b.HasQueryFilter(x => !x.SoftwareProduct!.IsDeleted);
    }
}

internal sealed class VersionDependencyConfiguration : IEntityTypeConfiguration<VersionDependencyRecord>
{
    public void Configure(EntityTypeBuilder<VersionDependencyRecord> b)
    {
        b.ToTable("version_dependencies", table => table.HasCheckConstraint("ck_version_dependencies_not_self", "software_version_id <> dependency_version_id")); b.HasKey(x => new { x.SoftwareVersionId, x.DependencyVersionId });
        b.HasOne(x => x.SoftwareVersion).WithMany(x => x.Dependencies).HasForeignKey(x => x.SoftwareVersionId).OnDelete(DeleteBehavior.Cascade); b.HasOne(x => x.DependencyVersion).WithMany().HasForeignKey(x => x.DependencyVersionId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_version_dependency_target"); b.HasQueryFilter(x => !x.SoftwareVersion!.SoftwareProduct!.IsDeleted && !x.DependencyVersion!.SoftwareProduct!.IsDeleted);
    }
}

internal sealed class KnowledgeSnapshotConfiguration : IEntityTypeConfiguration<KnowledgeSnapshotRecord>
{
    public void Configure(EntityTypeBuilder<KnowledgeSnapshotRecord> b)
    {
        b.ToTable("knowledge_snapshots", table => { table.HasCheckConstraint("ck_knowledge_snapshots_version", "version >= 0"); table.HasCheckConstraint("ck_knowledge_snapshots_state", "state IN ('Draft','Uploading','PendingProcessing','Processing','ReadyForReview','Failed','Approved','Published','Retired')"); });
        b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.State).HasMaxLength(32); b.Property(x => x.ManifestHash).HasMaxLength(64); b.Property(x => x.IngestedHash).HasMaxLength(64); b.Property(x => x.Version).IsConcurrencyToken();
        b.HasIndex(x => new { x.SoftwareVersionId, x.State }); b.HasIndex(x => new { x.SoftwareVersionId, x.CreatedAtUtc }); b.HasOne(x => x.SoftwareVersion).WithMany().HasForeignKey(x => x.SoftwareVersionId).OnDelete(DeleteBehavior.Restrict);
        b.HasQueryFilter(x => !x.SoftwareVersion!.SoftwareProduct!.IsDeleted);
    }
}

internal sealed class KnowledgeFileConfiguration : IEntityTypeConfiguration<KnowledgeFileRecord>
{
    public void Configure(EntityTypeBuilder<KnowledgeFileRecord> b)
    {
        b.ToTable("knowledge_files"); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.LogicalName).HasMaxLength(500); b.Property(x => x.Version).IsConcurrencyToken(); b.HasIndex(x => new { x.TenantId, x.SoftwareProductId, x.LogicalName }).IsUnique();
    }
}

internal sealed class FileRevisionConfiguration : IEntityTypeConfiguration<FileRevisionRecord>
{
    public void Configure(EntityTypeBuilder<FileRevisionRecord> b)
    {
        b.ToTable("file_revisions", table => { table.HasCheckConstraint("ck_file_revisions_number", "revision_number > 0"); table.HasCheckConstraint("ck_file_revisions_size", "size_bytes >= 0"); }); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.ContentHash).HasMaxLength(64); b.Property(x => x.ObjectReference).HasMaxLength(1000); b.Property(x => x.MediaType).HasMaxLength(200); b.HasIndex(x => new { x.FileIdentityId, x.RevisionNumber }).IsUnique(); b.HasIndex(x => new { x.ContentHash, x.SizeBytes }); b.HasOne<KnowledgeFileRecord>().WithMany(x => x.Revisions).HasForeignKey(x => x.FileIdentityId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class SnapshotFileConfiguration : IEntityTypeConfiguration<SnapshotFileRecord>
{
    public void Configure(EntityTypeBuilder<SnapshotFileRecord> b) { b.ToTable("snapshot_files"); b.HasKey(x => new { x.KnowledgeSnapshotId, x.FileRevisionId }); b.HasOne(x => x.KnowledgeSnapshot).WithMany(x => x.Files).HasForeignKey(x => x.KnowledgeSnapshotId).OnDelete(DeleteBehavior.Cascade); b.HasOne<FileRevisionRecord>().WithMany().HasForeignKey(x => x.FileRevisionId).OnDelete(DeleteBehavior.Restrict); b.HasQueryFilter(x => !x.KnowledgeSnapshot!.SoftwareVersion!.SoftwareProduct!.IsDeleted); }
}

internal sealed class SnapshotApprovalConfiguration : IEntityTypeConfiguration<SnapshotApprovalRecord>
{
    public void Configure(EntityTypeBuilder<SnapshotApprovalRecord> b) { b.ToTable("snapshot_approvals"); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.Decision).HasMaxLength(32); b.HasIndex(x => new { x.KnowledgeSnapshotId, x.ApproverId }).IsUnique(); b.HasOne(x => x.KnowledgeSnapshot).WithMany().HasForeignKey(x => x.KnowledgeSnapshotId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_snapshot_approval_snapshot"); b.HasQueryFilter(x => !x.KnowledgeSnapshot!.SoftwareVersion!.SoftwareProduct!.IsDeleted); }
}

internal sealed class PublicationPointerConfiguration : IEntityTypeConfiguration<PublicationPointerRecord>
{
    public void Configure(EntityTypeBuilder<PublicationPointerRecord> b) { b.ToTable("publication_pointers", table => table.HasCheckConstraint("ck_publication_pointers_version", "version >= 0")); b.HasKey(x => x.SoftwareVersionId); b.Property(x => x.Version).IsConcurrencyToken(); b.HasOne(x => x.SoftwareVersion).WithOne().HasForeignKey<PublicationPointerRecord>(x => x.SoftwareVersionId).OnDelete(DeleteBehavior.Restrict); b.HasOne<KnowledgeSnapshotRecord>().WithMany().HasForeignKey(x => x.ActiveSnapshotId).OnDelete(DeleteBehavior.Restrict); b.HasQueryFilter(x => !x.SoftwareVersion!.SoftwareProduct!.IsDeleted); }
}

internal sealed class IngestionJobConfiguration : IEntityTypeConfiguration<IngestionJobRecord>
{
    public void Configure(EntityTypeBuilder<IngestionJobRecord> b) { b.ToTable("ingestion_jobs", table => { table.HasCheckConstraint("ck_ingestion_jobs_attempts", "attempt_count >= 0 AND max_attempts > 0 AND attempt_count <= max_attempts"); table.HasCheckConstraint("ck_ingestion_jobs_progress", "progress >= 0 AND progress <= 100"); table.HasCheckConstraint("ck_ingestion_jobs_version", "version >= 0"); table.HasCheckConstraint("ck_ingestion_jobs_state", "state IN ('Pending','Processing','RetryScheduled','Completed','Failed','Cancelled')"); }); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.IdempotencyKey).HasMaxLength(200); b.Property(x => x.State).HasMaxLength(32); b.Property(x => x.LeaseOwner).HasMaxLength(200); b.Property(x => x.LastErrorCode).HasMaxLength(200); b.Property(x => x.ResultHash).HasMaxLength(64); b.Property(x => x.Version).IsConcurrencyToken(); b.HasIndex(x => new { x.TenantId, x.IdempotencyKey }).IsUnique(); b.HasIndex(x => new { x.State, x.NextAttemptAtUtc, x.LeaseExpiresAtUtc }); b.HasOne(x => x.KnowledgeSnapshot).WithMany().HasForeignKey(x => x.KnowledgeSnapshotId).OnDelete(DeleteBehavior.Restrict); b.HasQueryFilter(x => !x.KnowledgeSnapshot!.SoftwareVersion!.SoftwareProduct!.IsDeleted); }
}
