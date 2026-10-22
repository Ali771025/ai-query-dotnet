using AiQuery.Application.Common.Interfaces;
using AiQuery.Application.Common;
using AiQuery.Domain.Common;
using AiQuery.Domain.IdentityAccess;
using AiQuery.Application.Features.IdentityAccess.Commands;
using AiQuery.Application.Features.IdentityAccess.DTOs;
using AiQuery.Application.Features.IdentityAccess.Interfaces;
using AiQuery.Application.Features.IdentityAccess.Policies;
using AiQuery.Application.Features.IdentityAccess.Queries;

namespace AiQuery.Application.Features.IdentityAccess.Services;

public sealed class IdentityAccessUseCases(
    IIdentityProvider identityProvider,
    IIdentityAccessStore store,
    ICurrentActor currentActor,
    IClock clock,
    IAuditSink audit,
    IUnitOfWork unitOfWork)
{
    public async Task<Result<LoginResult>> LoginAsync(LoginCommand command, CancellationToken cancellationToken)
    {
        var credential = await identityProvider.AuthenticateAsync(command.Username, command.Password, cancellationToken);
        if (credential is null)
        {
            await AuditAsync("auth.login.failed", command.CorrelationId, null, new Dictionary<string, string> { ["reason"] = "invalid_credentials" }, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);
            return Result<LoginResult>.Failure(new Error("auth.invalid_credentials", "نام کاربری یا رمز عبور نادرست است.", ErrorType.Unauthorized));
        }

        var userId = await store.FindProfileIdBySubjectAsync(credential.ProviderSubject, cancellationToken);
        if (userId is null)
        {
            await AuditAsync("auth.login.failed", command.CorrelationId, null, new Dictionary<string, string> { ["reason"] = "profile_not_provisioned" }, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);
            return Result<LoginResult>.Failure(new Error("auth.profile_not_provisioned", "حساب برای این سامانه فعال نشده است.", ErrorType.Unauthorized));
        }

        var expiresAt = clock.UtcNow.AddHours(8);
        var session = await store.CreateSessionAsync(userId.Value, expiresAt, cancellationToken);
        var me = await store.ResolveMeAsync(session.SessionId, clock.UtcNow, cancellationToken);
        if (me is null)
        {
            return Result<LoginResult>.Failure(new Error("auth.user_inactive", "حساب کاربری غیرفعال است.", ErrorType.Unauthorized));
        }

        await AuditAsync("auth.login.succeeded", command.CorrelationId, userId.Value.ToString(), new Dictionary<string, string> { ["sessionId"] = session.SessionId.ToString() }, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Result<LoginResult>.Success(new LoginResult(session.SessionId, expiresAt, me));
    }

    public async Task<Result<MeResult>> GetMeAsync(CancellationToken cancellationToken)
    {
        var sessionId = RequireSession();
        var me = await store.ResolveMeAsync(sessionId, clock.UtcNow, cancellationToken);
        return me is null
            ? Result<MeResult>.Failure(new Error("auth.session_invalid", "نشست معتبر نیست.", ErrorType.Unauthorized))
            : Result<MeResult>.Success(me);
    }

    public async Task<Result<MeResult>> RefreshAsync(RefreshSessionCommand command, CancellationToken cancellationToken)
    {
        var result = await GetMeAsync(cancellationToken);
        if (result.IsSuccess)
        {
            await AuditAsync("auth.session.refreshed", command.CorrelationId, currentActor.ActorId, EmptyMetadata, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return result;
    }

    public async Task<Result<MeResult>> SelectPersonaAsync(SelectPersonaCommand command, CancellationToken cancellationToken)
    {
        var sessionId = RequireSession();
        var scope = new AccessScope(new(command.TenantId), command.OrganizationId is null ? null : new(command.OrganizationId.Value), command.SoftwareId is null ? null : new(command.SoftwareId.Value));
        if (!await store.SelectPersonaAsync(sessionId, command.Persona, scope, clock.UtcNow, cancellationToken))
        {
            return Result<MeResult>.Failure(new Error("auth.persona_forbidden", "این پرسونا یا محدوده برای کاربر مجاز نیست.", ErrorType.Forbidden));
        }

        await AuditAsync("auth.persona.switched", command.CorrelationId, currentActor.ActorId, new Dictionary<string, string> { ["persona"] = command.Persona }, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return await GetMeAsync(cancellationToken);
    }

    public async Task<Result<MeResult>> SwitchSoftwareAsync(SwitchSoftwareCommand command, CancellationToken cancellationToken)
    {
        var sessionId = RequireSession();
        if (!await store.SwitchSoftwareAsync(sessionId, command.SoftwareId, clock.UtcNow, cancellationToken))
        {
            return Result<MeResult>.Failure(new Error("auth.software_forbidden", "نرم‌افزار خارج از محدوده مجاز است.", ErrorType.Forbidden));
        }

        await AuditAsync("auth.software.switched", command.CorrelationId, currentActor.ActorId, new Dictionary<string, string> { ["softwareId"] = command.SoftwareId?.ToString() ?? string.Empty }, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return await GetMeAsync(cancellationToken);
    }

    public async Task LogoutAsync(LogoutCommand command, CancellationToken cancellationToken)
    {
        var sessionId = RequireSession();
        await store.RevokeSessionAsync(sessionId, cancellationToken);
        await AuditAsync("auth.logout", command.CorrelationId, currentActor.ActorId, EmptyMetadata, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task RequestPasswordResetAsync(RequestPasswordResetCommand command, CancellationToken cancellationToken)
    {
        _ = await identityProvider.CreatePasswordResetTokenAsync(command.Identity, cancellationToken);
        await AuditAsync("auth.password_reset.requested", command.CorrelationId, null, EmptyMetadata, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task<Result<bool>> ResetPasswordAsync(ResetPasswordCommand command, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(command.UserId, out var providerSubject))
        {
            return Result<bool>.Failure(new Error("auth.reset.invalid", "درخواست بازنشانی معتبر نیست.", ErrorType.Validation));
        }

        var reset = await identityProvider.ResetPasswordAsync(providerSubject, command.Token, command.NewPassword, cancellationToken);
        await AuditAsync(reset ? "auth.password_reset.succeeded" : "auth.password_reset.failed", command.CorrelationId, null, EmptyMetadata, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return reset
            ? Result<bool>.Success(true)
            : Result<bool>.Failure(new Error("auth.reset.invalid", "درخواست بازنشانی معتبر یا منقضی نشده است.", ErrorType.Validation));
    }

    public Task<IdentityPage<IdentityUserRow>> ListUsersAsync(ListIdentityUsersQuery query, CancellationToken cancellationToken) =>
        store.ListUsersAsync(query, RequireSession(), clock.UtcNow, cancellationToken).AsTask();

    public async Task<IdentityUserRow> UpsertUserAsync(UpsertIdentityUserCommand command, CancellationToken cancellationToken)
    {
        Guid? providerSubject = null;
        if (command.UserId is null)
        {
            if (string.IsNullOrWhiteSpace(command.InitialPassword))
            {
                throw new ApplicationValidationException(new Dictionary<string, string[]> { ["initialPassword"] = ["رمز اولیه برای کاربر جدید الزامی است."] });
            }

            providerSubject = await identityProvider.CreateAccountAsync(command.Username, command.Email, command.Mobile, command.InitialPassword, cancellationToken);
        }

        var row = await store.UpsertUserAsync(command, providerSubject, RequireSession(), clock.UtcNow, cancellationToken);
        if (command.UserId is not null)
        {
            var existingSubject = await store.FindProviderSubjectAsync(row.Id, cancellationToken)
                ?? throw new InvalidOperationException("Identity subject mapping is missing.");
            await identityProvider.UpdateAccountAsync(existingSubject, command.Username, command.Email, command.Mobile, command.IsActive, cancellationToken);
        }

        await AuditAsync(command.UserId is null ? "identity.user.created" : "identity.user.updated", command.CorrelationId, currentActor.ActorId, new Dictionary<string, string> { ["targetUserId"] = row.Id.ToString() }, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return row;
    }

    public async Task DeactivateUserAsync(DeactivateIdentityUserCommand command, CancellationToken cancellationToken)
    {
        await store.DeactivateUserAsync(command.UserId, command.Version, RequireSession(), clock.UtcNow, cancellationToken);
        await AuditAsync("identity.user.deactivated", command.CorrelationId, currentActor.ActorId, new Dictionary<string, string> { ["targetUserId"] = command.UserId.ToString() }, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task TransferOwnershipAsync(TransferPlatformOwnershipCommand command, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(currentActor.ActorId, out var actorId))
        {
            throw new ApplicationAuthenticationException("auth.reauthentication_failed", "Re-authentication failed.");
        }

        var providerSubject = await store.FindProviderSubjectAsync(actorId, cancellationToken);
        if (providerSubject is null || !await identityProvider.VerifyPasswordAsync(providerSubject.Value, command.CurrentPassword, cancellationToken))
        {
            throw new ApplicationAuthenticationException("auth.reauthentication_failed", "Re-authentication failed.");
        }

        await store.TransferPlatformOwnershipAsync(command.TargetUserId, RequireSession(), clock.UtcNow, cancellationToken);
        await AuditAsync("identity.platform_ownership.transferred", command.CorrelationId, currentActor.ActorId, new Dictionary<string, string> { ["targetUserId"] = command.TargetUserId.ToString() }, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public Task<IdentityPage<IdentityRoleRow>> ListRolesAsync(ListRolesQuery query, CancellationToken cancellationToken) =>
        store.ListRolesAsync(query, RequireSession(), clock.UtcNow, cancellationToken).AsTask();

    public async Task<IdentityRoleRow> UpsertRoleAsync(UpsertRoleCommand command, CancellationToken cancellationToken)
    {
        if (command.Permissions.Any(permission => !PersonaPermissionMatrix.IsWithinEnvelope(command.Persona, permission)))
        {
            throw new ApplicationAuthorizationException("role.permission.escalation", "Role permissions exceed the persona envelope.");
        }

        var role = await store.UpsertRoleAsync(command, RequireSession(), clock.UtcNow, cancellationToken);
        await AuditAsync(command.RoleId is null ? "identity.role.created" : "identity.role.updated", command.CorrelationId, currentActor.ActorId, new Dictionary<string, string> { ["roleId"] = role.Id.ToString() }, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return role;
    }

    public async Task DeleteRoleAsync(DeleteRoleCommand command, CancellationToken cancellationToken)
    {
        await store.DeleteRoleAsync(command.RoleId, command.Version, RequireSession(), clock.UtcNow, cancellationToken);
        await AuditAsync("identity.role.deleted", command.CorrelationId, currentActor.ActorId, new Dictionary<string, string> { ["roleId"] = command.RoleId.ToString() }, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private Guid RequireSession()
    {
        if (!currentActor.IsAuthenticated || !Guid.TryParse(currentActor.SessionId, out var sessionId))
        {
            throw new ApplicationAuthenticationException("auth.session_required", "An authenticated session is required.");
        }

        return sessionId;
    }

    private ValueTask AuditAsync(string eventCode, string correlationId, string? actorId, IReadOnlyDictionary<string, string> metadata, CancellationToken cancellationToken) =>
        audit.WriteAsync(new AuditRecord(eventCode, correlationId, actorId, clock.UtcNow, metadata), cancellationToken);

    private static readonly IReadOnlyDictionary<string, string> EmptyMetadata = new Dictionary<string, string>();
}
