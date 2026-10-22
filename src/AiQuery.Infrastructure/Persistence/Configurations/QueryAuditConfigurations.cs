using AiQuery.Infrastructure.Persistence.Records;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiQuery.Infrastructure.Persistence.Configurations;

internal sealed class QueryRequestConfiguration : IEntityTypeConfiguration<QueryRequestRecord>
{
    public void Configure(EntityTypeBuilder<QueryRequestRecord> b) { b.ToTable("query_requests"); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.Question).HasMaxLength(4000); b.Property(x => x.State).HasMaxLength(32); b.Property(x => x.Version).IsConcurrencyToken(); b.HasIndex(x => new { x.TenantId, x.ActorId, x.CreatedAtUtc }); b.HasIndex(x => new { x.SoftwareVersionId, x.State }); b.HasOne(x => x.SoftwareProduct).WithMany().HasForeignKey(x => x.SoftwareProductId).OnDelete(DeleteBehavior.Restrict); b.HasOne(x => x.SoftwareVersion).WithMany().HasForeignKey(x => x.SoftwareVersionId).OnDelete(DeleteBehavior.Restrict); b.HasOne<KnowledgeSnapshotRecord>().WithMany().HasForeignKey(x => x.SnapshotId).OnDelete(DeleteBehavior.Restrict); b.HasQueryFilter(x => !x.SoftwareProduct!.IsDeleted); }
}
internal sealed class QueryAttemptConfiguration : IEntityTypeConfiguration<QueryAttemptRecord>
{
    public void Configure(EntityTypeBuilder<QueryAttemptRecord> b) { b.ToTable("query_attempts", table => table.HasCheckConstraint("ck_query_attempts_number", "attempt_number > 0")); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.State).HasMaxLength(32); b.Property(x => x.ProviderCode).HasMaxLength(80); b.Property(x => x.FailureCode).HasMaxLength(120); b.HasIndex(x => new { x.QueryRequestId, x.AttemptNumber }).IsUnique(); b.HasOne<QueryRequestRecord>().WithMany().HasForeignKey(x => x.QueryRequestId).OnDelete(DeleteBehavior.Restrict); }
}
internal sealed class QueryResultConfiguration : IEntityTypeConfiguration<QueryResultRecord>
{
    public void Configure(EntityTypeBuilder<QueryResultRecord> b) { b.ToTable("query_results"); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.SqlText).HasMaxLength(20000); b.Property(x => x.ParametersJson).HasColumnType("jsonb"); b.Property(x => x.DisplaySpecJson).HasColumnType("jsonb"); b.Property(x => x.SnapshotHash).HasMaxLength(64); b.Property(x => x.PolicyHash).HasMaxLength(64); b.Property(x => x.Signature).HasMaxLength(1000); b.HasIndex(x => x.QueryAttemptId).IsUnique(); b.HasOne<QueryAttemptRecord>().WithMany().HasForeignKey(x => x.QueryAttemptId).OnDelete(DeleteBehavior.Restrict); }
}
internal sealed class QuerySourceConfiguration : IEntityTypeConfiguration<QuerySourceRecord>
{
    public void Configure(EntityTypeBuilder<QuerySourceRecord> b) { b.ToTable("query_sources", table => table.HasCheckConstraint("ck_query_sources_score", "score >= 0 AND score <= 1")); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.SourceType).HasMaxLength(50); b.Property(x => x.SourceReference).HasMaxLength(1000); b.Property(x => x.Score).HasPrecision(8, 6); b.HasIndex(x => x.QueryResultId); b.HasOne<QueryResultRecord>().WithMany().HasForeignKey(x => x.QueryResultId).OnDelete(DeleteBehavior.Restrict); }
}
internal sealed class PolicyDecisionConfiguration : IEntityTypeConfiguration<PolicyDecisionRecord>
{
    public void Configure(EntityTypeBuilder<PolicyDecisionRecord> b) { b.ToTable("policy_decisions"); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.PolicyCode).HasMaxLength(120); b.Property(x => x.Decision).HasMaxLength(32); b.Property(x => x.ReasonCode).HasMaxLength(120); b.HasIndex(x => x.QueryAttemptId); b.HasOne<QueryAttemptRecord>().WithMany().HasForeignKey(x => x.QueryAttemptId).OnDelete(DeleteBehavior.Restrict); }
}
internal sealed class ValidationFindingConfiguration : IEntityTypeConfiguration<ValidationFindingRecord>
{
    public void Configure(EntityTypeBuilder<ValidationFindingRecord> b) { b.ToTable("validation_findings"); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.Layer).HasMaxLength(50); b.Property(x => x.Severity).HasMaxLength(20); b.Property(x => x.Code).HasMaxLength(120); b.Property(x => x.SafeMessage).HasMaxLength(1000); b.HasIndex(x => new { x.QueryAttemptId, x.Layer, x.Severity }); b.HasOne<QueryAttemptRecord>().WithMany().HasForeignKey(x => x.QueryAttemptId).OnDelete(DeleteBehavior.Restrict); }
}
internal sealed class FeedbackEntryConfiguration : IEntityTypeConfiguration<FeedbackEntryRecord>
{
    public void Configure(EntityTypeBuilder<FeedbackEntryRecord> b) { b.ToTable("feedback_entries"); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.ActorType).HasMaxLength(32); b.Property(x => x.Comment).HasMaxLength(2000); b.HasIndex(x => new { x.QueryResultId, x.ActorId }).IsUnique(); b.HasOne<QueryResultRecord>().WithMany().HasForeignKey(x => x.QueryResultId).OnDelete(DeleteBehavior.Restrict); }
}
internal sealed class AuditEventConfiguration : IEntityTypeConfiguration<AuditEventRecord>
{
    public void Configure(EntityTypeBuilder<AuditEventRecord> b) { b.ToTable("audit_events"); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.EventCode).HasMaxLength(150); b.Property(x => x.CorrelationId).HasMaxLength(128); b.Property(x => x.ActorId).HasMaxLength(100); b.Property(x => x.SafeMetadataJson).HasColumnType("jsonb"); b.HasIndex(x => new { x.TenantId, x.OccurredAtUtc }); b.HasIndex(x => x.CorrelationId); }
}
internal sealed class SecurityEventConfiguration : IEntityTypeConfiguration<SecurityEventRecord>
{
    public void Configure(EntityTypeBuilder<SecurityEventRecord> b) { b.ToTable("security_events"); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.Code).HasMaxLength(150); b.Property(x => x.Severity).HasMaxLength(20); b.Property(x => x.CorrelationId).HasMaxLength(128); b.Property(x => x.SafeDetailsJson).HasColumnType("jsonb"); b.HasIndex(x => new { x.TenantId, x.OccurredAtUtc, x.Severity }); }
}
internal sealed class OutboxMessageConfiguration : IEntityTypeConfiguration<OutboxMessageRecord>
{
    public void Configure(EntityTypeBuilder<OutboxMessageRecord> b) { b.ToTable("outbox_messages"); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.Type).HasMaxLength(500); b.Property(x => x.PayloadJson).HasColumnType("jsonb"); b.HasIndex(x => new { x.ProcessedAtUtc, x.NextAttemptAtUtc }); }
}
internal sealed class InboxMessageConfiguration : IEntityTypeConfiguration<InboxMessageRecord>
{
    public void Configure(EntityTypeBuilder<InboxMessageRecord> b) { b.ToTable("inbox_messages"); b.HasKey(x => new { x.Id, x.Consumer }); b.Property(x => x.Consumer).HasMaxLength(150); b.HasIndex(x => x.ProcessedAtUtc); }
}
internal sealed class IdempotencyRecordConfiguration : IEntityTypeConfiguration<IdempotencyRecord>
{
    public void Configure(EntityTypeBuilder<IdempotencyRecord> b) { b.ToTable("idempotency_records"); b.HasKey(x => x.Key); b.Property(x => x.Key).HasMaxLength(200); b.Property(x => x.ResponseType).HasMaxLength(500); b.Property(x => x.ResponseJson).HasColumnType("jsonb"); b.HasIndex(x => x.ExpiresAtUtc); }
}
