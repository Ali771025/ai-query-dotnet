namespace AiQuery.Application.Features.IdentityAccess.Commands;

public sealed record LoginCommand(string Username, string Password, string CorrelationId);
public sealed record RefreshSessionCommand(string CorrelationId);
public sealed record LogoutCommand(string CorrelationId);
public sealed record SelectPersonaCommand(string Persona, Guid TenantId, Guid? OrganizationId, Guid? SoftwareId, string CorrelationId);
public sealed record SwitchSoftwareCommand(Guid? SoftwareId, string CorrelationId);
public sealed record RequestPasswordResetCommand(string Identity, string CorrelationId);
public sealed record ResetPasswordCommand(string UserId, string Token, string NewPassword, string CorrelationId);
public sealed record UpsertIdentityUserCommand(Guid? UserId, Guid TenantId, Guid OrganizationId, string Username, string DisplayName, string? Email, string? Mobile, string? InitialPassword, bool IsActive, IReadOnlyCollection<Guid> RoleIds, string Persona, Guid? SoftwareId, string CorrelationId);
public sealed record DeactivateIdentityUserCommand(Guid UserId, long Version, string CorrelationId);
public sealed record TransferPlatformOwnershipCommand(Guid TargetUserId, string CurrentPassword, string CorrelationId);
public sealed record UpsertRoleCommand(Guid? RoleId, string Code, string Name, string Persona, IReadOnlyCollection<string> Permissions, long? Version, string CorrelationId);
public sealed record DeleteRoleCommand(Guid RoleId, long Version, string CorrelationId);
