namespace AiQuery.Application.Features.IdentityAccess.Policies;

public static class PersonaPermissionMatrix
{
    private static readonly string[] PlatformPrefixes = ["users.", "roles.", "tokens.", "rules.", "payments.", "reports-", "logs-", "ai-providers.", "owner-apikeys.", "ai-model-test.", "knowledge."];
    private static readonly string[] SoftwareOwnerPrefixes = ["software.", "versions.", "databases.", "appusers.", "appusers-", "apikeys.", "sw-reports-", "ai-model-test.", "owner-apikeys.", "knowledge."];
    private static readonly string[] CompanyPrefixes = ["software.", "versions.", "databases.", "appusers.", "appusers-", "company-roles.", "apikeys.", "requests.", "prompts.", "accuracy.", "mgmt-reports.", "ai-model-test.", "knowledge."];
    private static readonly string[] SupportPrefixes = ["software.", "versions.", "databases.", "appusers.", "appusers-", "apikeys.", "requests.", "prompts.", "accuracy.", "mgmt-reports.", "knowledge.read", "knowledge.edit", "knowledge.ingest", "knowledge.review"];
    private static readonly string[] TenantPrefixes = ["my-wallet.", "org-members.", "my-apikeys.", "my-apikey-reports."];

    public static bool IsWithinEnvelope(string persona, string permission) =>
        Prefixes(persona).Any(prefix => permission.StartsWith(prefix, StringComparison.Ordinal));

    public static IReadOnlyCollection<string> Clamp(string persona, IEnumerable<string> permissions) =>
        permissions.Where(permission => IsWithinEnvelope(persona, permission)).Distinct(StringComparer.Ordinal).ToArray();

    private static IReadOnlyCollection<string> Prefixes(string persona) => persona switch
    {
        "platform" => PlatformPrefixes,
        "software_owner" => SoftwareOwnerPrefixes,
        "company" => CompanyPrefixes,
        "support" => SupportPrefixes,
        "tenant" => TenantPrefixes,
        _ => []
    };
}
