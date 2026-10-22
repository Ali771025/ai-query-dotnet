using AiQuery.Application.Features.IdentityAccess.Commands;

namespace AiQuery.Presentation.Api.Models.Identity;

public sealed record LoginRequest(string Username, string Password);
public sealed record SelectPersonaRequest(string Persona, Guid TenantId, Guid? OrganizationId, Guid? SoftwareId);
public sealed record SwitchSoftwareRequest(Guid? SoftwareId);
public sealed record ForgotPasswordRequest(string Identity);
public sealed record ResetPasswordRequest(string UserId, string Token, string NewPassword);
public sealed record TransferOwnershipRequest(Guid TargetUserId, string CurrentPassword);

public sealed record UserWriteRequest(
    Guid TenantId,
    Guid OrganizationId,
    string Username,
    string DisplayName,
    string? Email,
    string? Mobile,
    string? InitialPassword,
    bool IsActive,
    IReadOnlyCollection<Guid> RoleIds,
    string Persona,
    Guid? SoftwareId)
{
    public UpsertIdentityUserCommand ToCommand(Guid? id, string correlationId) =>
        new(id, TenantId, OrganizationId, Username, DisplayName, Email, Mobile, InitialPassword, IsActive, RoleIds, Persona, SoftwareId, correlationId);
}

public sealed record RoleWriteRequest(string Code, string Name, string Persona, IReadOnlyCollection<string> Permissions, long? Version)
{
    public UpsertRoleCommand ToCommand(Guid? id, string correlationId) =>
        new(id, Code, Name, Persona, Permissions, Version, correlationId);
}
