namespace AiQuery.Infrastructure.Persistence.Records;

internal sealed class AiProviderPolicyRecord
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid? SoftwareProductId { get; set; }
    public required string ProviderCode { get; set; }
    public required string ModelRoute { get; set; }
    public required string SecretReference { get; set; }
    public required string PolicyHash { get; set; }
    public bool AllowsCloudEgress { get; set; }
    public bool IsActive { get; set; }
    public long Version { get; set; }
}

internal sealed class ApiClientRecord
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid OrganizationId { get; set; }
    public required string Name { get; set; }
    public bool IsActive { get; set; } = true;
    public long Version { get; set; }
}

internal sealed class ApiKeyRecord
{
    public Guid Id { get; set; }
    public Guid ApiClientId { get; set; }
    public required string Prefix { get; set; }
    public required string SecretDigest { get; set; }
    public required string State { get; set; }
    public DateTimeOffset? ExpiresAtUtc { get; set; }
    public DateTimeOffset? RevokedAtUtc { get; set; }
    public long Version { get; set; }
}

internal sealed class ApiKeyScopeRecord { public Guid ApiKeyId { get; set; } public required string Scope { get; set; } }
internal sealed class ApiIpRestrictionRecord { public Guid Id { get; set; } public Guid ApiClientId { get; set; } public required string Cidr { get; set; } }
internal sealed class QuotaRecord { public Guid Id { get; set; } public Guid TenantId { get; set; } public Guid? ApiClientId { get; set; } public decimal Limit { get; set; } public required string Period { get; set; } public long Version { get; set; } }

internal sealed class WalletRecord { public Guid Id { get; set; } public Guid TenantId { get; set; } public Guid OwnerId { get; set; } public decimal Balance { get; set; } public long Version { get; set; } }
internal sealed class LedgerEntryRecord { public Guid Id { get; set; } public Guid WalletId { get; set; } public required string Kind { get; set; } public decimal Amount { get; set; } public Guid? ReservationId { get; set; } public DateTimeOffset OccurredAtUtc { get; set; } public required string IdempotencyKey { get; set; } }
internal sealed class ReservationRecord { public Guid Id { get; set; } public Guid WalletId { get; set; } public decimal Amount { get; set; } public required string State { get; set; } public DateTimeOffset CreatedAtUtc { get; set; } public long Version { get; set; } }
internal sealed class SettlementRecord { public Guid Id { get; set; } public Guid ReservationId { get; set; } public decimal ActualAmount { get; set; } public DateTimeOffset SettledAtUtc { get; set; } public required string IdempotencyKey { get; set; } }
internal sealed class TariffRuleRecord { public Guid Id { get; set; } public Guid TenantId { get; set; } public required string Code { get; set; } public decimal UnitPrice { get; set; } public string Currency { get; set; } = "CRD"; public DateTimeOffset EffectiveFromUtc { get; set; } public DateTimeOffset? EffectiveToUtc { get; set; } public long Version { get; set; } }
