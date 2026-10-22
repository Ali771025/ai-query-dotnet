namespace AiQuery.Application.Features.IdentityAccess.DTOs;

public sealed record PersonaOption(string Code, string Label, Guid TenantId, Guid? OrganizationId, Guid? SoftwareId, IReadOnlyCollection<Guid> AccessibleSoftwareIds);
public sealed record MeResult(Guid UserId, string Username, string DisplayName, string? Email, string? Mobile, string? ActivePersona, Guid? ActiveTenantId, Guid? ActiveOrganizationId, Guid? ActiveSoftwareId, IReadOnlyCollection<string> Permissions, IReadOnlyCollection<PersonaOption> AvailablePersonas, IReadOnlyCollection<Guid> AccessibleSoftwareIds);
public sealed record LoginResult(Guid SessionId, DateTimeOffset ExpiresAtUtc, MeResult Me);
public sealed record IdentityCredential(Guid ProviderSubject, string Username);
public sealed record SessionRecord(Guid SessionId, Guid UserId, DateTimeOffset ExpiresAtUtc, bool IsRevoked);
public sealed record IdentityUserRow(Guid Id, Guid TenantId, string Username, string DisplayName, string? Email, string? Mobile, bool IsActive, IReadOnlyCollection<Guid> RoleIds, long Version);
public sealed record IdentityRoleRow(Guid Id, Guid TenantId, string Code, string Name, string Persona, bool IsSystem, IReadOnlyCollection<string> Permissions, long Version);
public sealed record IdentityPage<T>(IReadOnlyCollection<T> Items, int PageNumber, int PageSize, long TotalCount);
