using AiQuery.Infrastructure.Persistence.Records;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiQuery.Infrastructure.Persistence.Configurations;

internal sealed class AiProviderPolicyConfiguration : IEntityTypeConfiguration<AiProviderPolicyRecord>
{
    public void Configure(EntityTypeBuilder<AiProviderPolicyRecord> b) { b.ToTable("ai_provider_policies"); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.ProviderCode).HasMaxLength(80); b.Property(x => x.ModelRoute).HasMaxLength(200); b.Property(x => x.SecretReference).HasMaxLength(500); b.Property(x => x.PolicyHash).HasMaxLength(64); b.Property(x => x.Version).IsConcurrencyToken(); b.HasIndex(x => new { x.TenantId, x.SoftwareProductId, x.IsActive }).HasDatabaseName("ix_ai_provider_policy_scope"); b.HasOne<SoftwareProductRecord>().WithMany().HasForeignKey(x => x.SoftwareProductId).OnDelete(DeleteBehavior.Restrict); }
}
internal sealed class ApiClientConfiguration : IEntityTypeConfiguration<ApiClientRecord>
{
    public void Configure(EntityTypeBuilder<ApiClientRecord> b) { b.ToTable("api_clients"); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.Name).HasMaxLength(200); b.Property(x => x.Version).IsConcurrencyToken(); b.HasIndex(x => new { x.TenantId, x.OrganizationId, x.Name }).IsUnique(); b.HasOne<OrganizationRecord>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict); }
}
internal sealed class ApiKeyConfiguration : IEntityTypeConfiguration<ApiKeyRecord>
{
    public void Configure(EntityTypeBuilder<ApiKeyRecord> b) { b.ToTable("api_keys"); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.Prefix).HasMaxLength(24); b.Property(x => x.SecretDigest).HasMaxLength(200); b.Property(x => x.State).HasMaxLength(32); b.Property(x => x.Version).IsConcurrencyToken(); b.HasIndex(x => x.Prefix).IsUnique(); b.HasOne<ApiClientRecord>().WithMany().HasForeignKey(x => x.ApiClientId).OnDelete(DeleteBehavior.Restrict); }
}
internal sealed class ApiKeyScopeConfiguration : IEntityTypeConfiguration<ApiKeyScopeRecord>
{
    public void Configure(EntityTypeBuilder<ApiKeyScopeRecord> b) { b.ToTable("api_key_scopes"); b.HasKey(x => new { x.ApiKeyId, x.Scope }); b.Property(x => x.Scope).HasMaxLength(150); b.HasOne<ApiKeyRecord>().WithMany().HasForeignKey(x => x.ApiKeyId).OnDelete(DeleteBehavior.Cascade); }
}
internal sealed class ApiIpRestrictionConfiguration : IEntityTypeConfiguration<ApiIpRestrictionRecord>
{
    public void Configure(EntityTypeBuilder<ApiIpRestrictionRecord> b) { b.ToTable("api_ip_restrictions"); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.Cidr).HasMaxLength(64); b.HasIndex(x => new { x.ApiClientId, x.Cidr }).IsUnique(); b.HasOne<ApiClientRecord>().WithMany().HasForeignKey(x => x.ApiClientId).OnDelete(DeleteBehavior.Cascade); }
}
internal sealed class QuotaConfiguration : IEntityTypeConfiguration<QuotaRecord>
{
    public void Configure(EntityTypeBuilder<QuotaRecord> b) { b.ToTable("quotas", table => table.HasCheckConstraint("ck_quotas_limit", "\"limit\" >= 0")); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.Limit).HasPrecision(20, 4); b.Property(x => x.Period).HasMaxLength(32); b.Property(x => x.Version).IsConcurrencyToken(); b.HasIndex(x => new { x.TenantId, x.ApiClientId, x.Period }).IsUnique(); b.HasOne<ApiClientRecord>().WithMany().HasForeignKey(x => x.ApiClientId).OnDelete(DeleteBehavior.Restrict); }
}
internal sealed class WalletConfiguration : IEntityTypeConfiguration<WalletRecord>
{
    public void Configure(EntityTypeBuilder<WalletRecord> b) { b.ToTable("wallets", table => table.HasCheckConstraint("ck_wallets_balance", "balance >= 0")); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.Balance).HasPrecision(20, 4); b.Property(x => x.Version).IsConcurrencyToken(); b.HasIndex(x => new { x.TenantId, x.OwnerId }).IsUnique(); }
}
internal sealed class LedgerEntryConfiguration : IEntityTypeConfiguration<LedgerEntryRecord>
{
    public void Configure(EntityTypeBuilder<LedgerEntryRecord> b) { b.ToTable("ledger_entries", table => table.HasCheckConstraint("ck_ledger_entries_amount", "amount >= 0")); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.Kind).HasMaxLength(32); b.Property(x => x.Amount).HasPrecision(20, 4); b.Property(x => x.IdempotencyKey).HasMaxLength(200); b.HasIndex(x => new { x.WalletId, x.IdempotencyKey }).IsUnique(); b.HasIndex(x => new { x.WalletId, x.OccurredAtUtc }); b.HasOne<WalletRecord>().WithMany().HasForeignKey(x => x.WalletId).OnDelete(DeleteBehavior.Restrict); b.HasOne<ReservationRecord>().WithMany().HasForeignKey(x => x.ReservationId).OnDelete(DeleteBehavior.Restrict); }
}
internal sealed class ReservationConfiguration : IEntityTypeConfiguration<ReservationRecord>
{
    public void Configure(EntityTypeBuilder<ReservationRecord> b) { b.ToTable("reservations", table => table.HasCheckConstraint("ck_reservations_amount", "amount > 0")); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.Amount).HasPrecision(20, 4); b.Property(x => x.State).HasMaxLength(32); b.Property(x => x.Version).IsConcurrencyToken(); b.HasIndex(x => new { x.WalletId, x.State }); b.HasOne<WalletRecord>().WithMany().HasForeignKey(x => x.WalletId).OnDelete(DeleteBehavior.Restrict); }
}
internal sealed class SettlementConfiguration : IEntityTypeConfiguration<SettlementRecord>
{
    public void Configure(EntityTypeBuilder<SettlementRecord> b) { b.ToTable("settlements", table => table.HasCheckConstraint("ck_settlements_amount", "actual_amount >= 0")); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.ActualAmount).HasPrecision(20, 4); b.Property(x => x.IdempotencyKey).HasMaxLength(200); b.HasIndex(x => x.ReservationId).IsUnique(); b.HasIndex(x => x.IdempotencyKey).IsUnique(); b.HasOne<ReservationRecord>().WithOne().HasForeignKey<SettlementRecord>(x => x.ReservationId).OnDelete(DeleteBehavior.Restrict); }
}
internal sealed class TariffRuleConfiguration : IEntityTypeConfiguration<TariffRuleRecord>
{
    public void Configure(EntityTypeBuilder<TariffRuleRecord> b) { b.ToTable("tariff_rules", table => table.HasCheckConstraint("ck_tariff_rules_price", "unit_price >= 0")); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.Code).HasMaxLength(100); b.Property(x => x.UnitPrice).HasPrecision(20, 4); b.Property(x => x.Currency).HasMaxLength(3); b.Property(x => x.Version).IsConcurrencyToken(); b.HasIndex(x => new { x.TenantId, x.Code, x.EffectiveFromUtc }).IsUnique(); }
}
