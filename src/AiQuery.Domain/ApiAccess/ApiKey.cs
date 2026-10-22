using AiQuery.Domain.Common;

namespace AiQuery.Domain.ApiAccess;

public enum ApiKeyState { Active, Rotated, Revoked }

public sealed class ApiKey : AggregateRoot<ApiKeyId>
{
    private ApiKey(ApiKeyId id, string secretDigest, IReadOnlySet<string> scopes, DateTimeOffset? expiresAtUtc) : base(id)
    {
        SecretDigest = secretDigest;
        Scopes = scopes;
        ExpiresAtUtc = expiresAtUtc;
    }
    public string SecretDigest { get; }
    public IReadOnlySet<string> Scopes { get; }
    public DateTimeOffset? ExpiresAtUtc { get; }
    public ApiKeyState State { get; private set; } = ApiKeyState.Active;
    public static ApiKey Issue(ApiKeyId id, string secretDigest, IEnumerable<string> scopes, DateTimeOffset? expiresAtUtc)
    {
        var normalizedScopes = scopes.Where(item => !string.IsNullOrWhiteSpace(item)).Select(item => item.Trim()).ToHashSet(StringComparer.Ordinal);
        if (id.Value == Guid.Empty || string.IsNullOrWhiteSpace(secretDigest) || normalizedScopes.Count == 0) throw new DomainRuleException("api_key.invalid", "Key identifier, digest and at least one scope are required.");
        return new ApiKey(id, secretDigest, normalizedScopes, expiresAtUtc);
    }
    public bool IsUsable(DateTimeOffset nowUtc, string requiredScope) => State == ApiKeyState.Active && (ExpiresAtUtc is null || ExpiresAtUtc > nowUtc) && Scopes.Contains(requiredScope);
    public void MarkRotated() { RequireActive(); State = ApiKeyState.Rotated; }
    public void Revoke() { if (State == ApiKeyState.Revoked) return; State = ApiKeyState.Revoked; }
    private void RequireActive() { if (State != ApiKeyState.Active) throw new DomainRuleException("api_key.inactive", "Only an active key can be rotated."); }
}
