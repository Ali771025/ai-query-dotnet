using System.Globalization;
using System.Text.RegularExpressions;

namespace AiQuery.Domain.Common;

public sealed record Email
{
    private static readonly Regex Pattern = new("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", RegexOptions.CultureInvariant);
    private Email(string value) => Value = value;
    public string Value { get; }
    public static Email Create(string value)
    {
        var normalized = value?.Trim().ToLowerInvariant() ?? string.Empty;
        return Pattern.IsMatch(normalized)
            ? new Email(normalized)
            : throw new DomainRuleException("email.invalid", "Email address is invalid.");
    }
}

public sealed record SoftwareCode
{
    private SoftwareCode(string value) => Value = value;
    public string Value { get; }
    public static SoftwareCode Create(string value)
    {
        var normalized = value?.Trim().ToUpperInvariant() ?? string.Empty;
        if (normalized.Length is < 2 or > 50 || normalized.Any(ch => !(char.IsAsciiLetterOrDigit(ch) || ch is '-' or '_')))
        {
            throw new DomainRuleException("software.code.invalid", "Software code must be 2-50 ASCII letters, digits, hyphens or underscores.");
        }
        return new SoftwareCode(normalized);
    }
}

public sealed record VersionLabel
{
    private VersionLabel(string value) => Value = value;
    public string Value { get; }
    public static VersionLabel Create(string value)
    {
        var normalized = value?.Trim() ?? string.Empty;
        return normalized.Length is > 0 and <= 64
            ? new VersionLabel(normalized)
            : throw new DomainRuleException("version.label.invalid", "Version label must contain 1-64 characters.");
    }
}

public sealed record SnapshotHash
{
    private SnapshotHash(string value) => Value = value;
    public string Value { get; }
    public static SnapshotHash Create(string value) => CreateHash(value, "snapshot.hash.invalid", hash => new SnapshotHash(hash));
    private static T CreateHash<T>(string value, string code, Func<string, T> factory)
    {
        var normalized = value?.Trim().ToLowerInvariant() ?? string.Empty;
        if (normalized.Length != 64 || normalized.Any(ch => !Uri.IsHexDigit(ch))) throw new DomainRuleException(code, "Hash must be a 64-character SHA-256 hexadecimal value.");
        return factory(normalized);
    }
}

public sealed record PolicyHash
{
    private PolicyHash(string value) => Value = value;
    public string Value { get; }
    public static PolicyHash Create(string value)
    {
        var normalized = value?.Trim().ToLowerInvariant() ?? string.Empty;
        if (normalized.Length != 64 || normalized.Any(ch => !Uri.IsHexDigit(ch))) throw new DomainRuleException("policy.hash.invalid", "Hash must be a 64-character SHA-256 hexadecimal value.");
        return new PolicyHash(normalized);
    }
}

public readonly record struct CreditAmount
{
    public CreditAmount(decimal value)
    {
        if (value < 0) throw new DomainRuleException("credit.negative", "Credit cannot be negative.");
        Value = decimal.Round(value, 4, MidpointRounding.ToEven);
    }
    public decimal Value { get; }
}

public sealed record Money
{
    private Money(decimal amount, string currency) { Amount = amount; Currency = currency; }
    public decimal Amount { get; }
    public string Currency { get; }
    public static Money Create(decimal amount, string currency)
    {
        if (amount < 0) throw new DomainRuleException("money.negative", "Money cannot be negative.");
        var normalized = currency?.Trim().ToUpperInvariant() ?? string.Empty;
        if (normalized.Length != 3 || normalized.Any(ch => !char.IsAsciiLetter(ch))) throw new DomainRuleException("money.currency.invalid", "Currency must be an ISO-like three-letter code.");
        return new Money(decimal.Round(amount, 4, MidpointRounding.ToEven), normalized);
    }
}

public enum QueryParameterKind { Text, Integer, Decimal, Boolean, Date, DateTime, Identifier }
public sealed record QueryParameter
{
    private QueryParameter(string name, QueryParameterKind kind, string value) { Name = name; Kind = kind; Value = value; }
    public string Name { get; }
    public QueryParameterKind Kind { get; }
    public string Value { get; }
    public static QueryParameter Create(string name, QueryParameterKind kind, string value)
    {
        var normalizedName = name?.Trim() ?? string.Empty;
        if (normalizedName.Length is < 1 or > 64 || normalizedName.Any(ch => !(char.IsAsciiLetterOrDigit(ch) || ch == '_'))) throw new DomainRuleException("query.parameter.name.invalid", "Parameter name is invalid.");
        if (value is null || value.Length > 4000) throw new DomainRuleException("query.parameter.value.invalid", "Parameter value is invalid.");
        return new QueryParameter(normalizedName, kind, value);
    }
}

public sealed record AccessScope(TenantId TenantId, OrganizationId? OrganizationId = null, SoftwareProductId? SoftwareId = null, SoftwareVersionId? VersionId = null)
{
    public bool Contains(AccessScope requested) =>
        TenantId == requested.TenantId &&
        (OrganizationId is null || OrganizationId == requested.OrganizationId) &&
        (SoftwareId is null || SoftwareId == requested.SoftwareId) &&
        (VersionId is null || VersionId == requested.VersionId);
}

public sealed record AuditMetadata(UserId ActorId, DateTimeOffset OccurredAtUtc, string CorrelationId)
{
    public static AuditMetadata Create(UserId actorId, DateTimeOffset occurredAtUtc, string correlationId)
    {
        if (occurredAtUtc.Offset != TimeSpan.Zero) throw new DomainRuleException("audit.time.not_utc", "Audit time must be UTC.");
        if (string.IsNullOrWhiteSpace(correlationId) || correlationId.Length > 128) throw new DomainRuleException("audit.correlation.invalid", "Correlation identifier is required.");
        return new AuditMetadata(actorId, occurredAtUtc, correlationId.Trim());
    }
}
