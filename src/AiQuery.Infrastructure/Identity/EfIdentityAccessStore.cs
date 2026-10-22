using AiQuery.Application.Common;
using AiQuery.Application.Features.IdentityAccess.Commands;
using AiQuery.Application.Features.IdentityAccess.DTOs;
using AiQuery.Application.Features.IdentityAccess.Interfaces;
using AiQuery.Application.Features.IdentityAccess.Policies;
using AiQuery.Application.Features.IdentityAccess.Queries;
using AiQuery.Domain.Common;
using AiQuery.Infrastructure.Persistence;
using AiQuery.Infrastructure.Persistence.Records;
using Microsoft.EntityFrameworkCore;

namespace AiQuery.Infrastructure.Identity;

internal sealed class EfIdentityAccessStore(AppDbContext dbContext) : IIdentityAccessStore
{
    public async ValueTask<Guid?> FindProfileIdBySubjectAsync(Guid providerSubject, CancellationToken cancellationToken) =>
        await dbContext.Set<UserProfileRecord>().Where(user => user.ExternalSubject == providerSubject.ToString()).Select(user => (Guid?)user.Id).SingleOrDefaultAsync(cancellationToken);

    public async ValueTask<Guid?> FindProviderSubjectAsync(Guid userId, CancellationToken cancellationToken)
    {
        var subject = await dbContext.Set<UserProfileRecord>().Where(user => user.Id == userId).Select(user => user.ExternalSubject).SingleOrDefaultAsync(cancellationToken);
        return Guid.TryParse(subject, out var value) ? value : null;
    }

    public ValueTask<SessionRecord> CreateSessionAsync(Guid userId, DateTimeOffset expiresAtUtc, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var row = new UserSessionRecord
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            ExpiresAtUtc = expiresAtUtc,
            Version = 0
        };
        dbContext.Set<UserSessionRecord>().Add(row);
        return ValueTask.FromResult(new SessionRecord(row.Id, row.UserId, row.ExpiresAtUtc, false));
    }

    public async ValueTask<SessionRecord?> FindSessionAsync(Guid sessionId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var row = await FindSessionRowAsync(sessionId, cancellationToken);
        return row is null || row.RevokedAtUtc is not null || row.ExpiresAtUtc <= now
            ? null
            : new SessionRecord(row.Id, row.UserId, row.ExpiresAtUtc, false);
    }

    public async ValueTask RevokeSessionAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var row = await FindSessionRowAsync(sessionId, cancellationToken);
        if (row is not null && row.RevokedAtUtc is null)
        {
            row.RevokedAtUtc = DateTimeOffset.UtcNow;
            row.Version++;
        }
    }

    public async ValueTask<MeResult?> ResolveMeAsync(Guid sessionId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var session = await FindSessionRowAsync(sessionId, cancellationToken);
        if (session is null || session.RevokedAtUtc is not null || session.ExpiresAtUtc <= now)
        {
            return null;
        }

        var user = await dbContext.Set<UserProfileRecord>().AsNoTracking().SingleOrDefaultAsync(item => item.Id == session.UserId && item.IsActive, cancellationToken);
        if (user is null)
        {
            return null;
        }

        var assignments = await LoadAssignmentsAsync(user.Id, now, cancellationToken);
        var personaOptions = assignments
            .GroupBy(item => new { item.Persona, item.TenantId, item.OrganizationId, item.SoftwareProductId })
            .Select(group => new PersonaOption(
                group.Key.Persona,
                PersonaLabel(group.Key.Persona),
                group.Key.TenantId,
                group.Key.OrganizationId,
                group.Key.SoftwareProductId,
                assignments.Where(item => item.Persona == group.Key.Persona && item.SoftwareProductId != null).Select(item => item.SoftwareProductId!.Value).Distinct().ToArray()))
            .OrderBy(item => item.Code, StringComparer.Ordinal)
            .ToArray();

        var activeAssignments = session.ActivePersona is null
            ? []
            : assignments.Where(item =>
                    item.Persona == session.ActivePersona &&
                    item.TenantId == session.ActiveTenantId &&
                    (item.OrganizationId is null || item.OrganizationId == session.ActiveOrganizationId) &&
                    (item.SoftwareProductId is null || item.SoftwareProductId == session.ActiveSoftwareProductId))
                .ToArray();
        var roleIds = activeAssignments.Select(item => item.RoleId).Distinct().ToArray();
        var permissions = roleIds.Length == 0
            ? []
            : await dbContext.Set<RolePermissionRecord>().AsNoTracking()
                .Where(item => roleIds.Contains(item.RoleId))
                .Select(item => item.PermissionCode)
                .Distinct()
                .OrderBy(item => item)
                .ToArrayAsync(cancellationToken);
        var accessibleSoftware = assignments
            .Where(item => session.ActivePersona is null || item.Persona == session.ActivePersona)
            .Where(item => item.SoftwareProductId is not null)
            .Select(item => item.SoftwareProductId!.Value)
            .Distinct()
            .ToArray();

        return new MeResult(
            user.Id,
            user.Username,
            user.DisplayName,
            user.Email,
            user.Mobile,
            session.ActivePersona,
            session.ActiveTenantId,
            session.ActiveOrganizationId,
            session.ActiveSoftwareProductId,
            permissions,
            personaOptions,
            accessibleSoftware);
    }

    public async ValueTask<bool> SelectPersonaAsync(Guid sessionId, string persona, AccessScope scope, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var session = await FindSessionRowAsync(sessionId, cancellationToken);
        if (session is null || session.RevokedAtUtc is not null || session.ExpiresAtUtc <= now || !ValidPersona(persona))
        {
            return false;
        }

        var assignments = await LoadAssignmentsAsync(session.UserId, now, cancellationToken);
        var allowed = assignments.Any(item =>
            item.Persona == persona &&
            item.TenantId == scope.TenantId.Value &&
            (item.OrganizationId is null || item.OrganizationId == scope.OrganizationId?.Value) &&
            (item.SoftwareProductId is null || item.SoftwareProductId == scope.SoftwareId?.Value));
        if (!allowed)
        {
            return false;
        }

        session.ActivePersona = persona;
        session.ActiveTenantId = scope.TenantId.Value;
        session.ActiveOrganizationId = scope.OrganizationId?.Value;
        session.ActiveSoftwareProductId = scope.SoftwareId?.Value;
        session.Version++;
        return true;
    }

    public async ValueTask<bool> SwitchSoftwareAsync(Guid sessionId, Guid? softwareId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var session = await FindSessionRowAsync(sessionId, cancellationToken);
        if (session is null || session.ActivePersona is null || session.RevokedAtUtc is not null || session.ExpiresAtUtc <= now)
        {
            return false;
        }

        if (softwareId is not null)
        {
            var assignments = await LoadAssignmentsAsync(session.UserId, now, cancellationToken);
            var permitted = assignments.Any(item =>
                item.Persona == session.ActivePersona &&
                item.TenantId == session.ActiveTenantId &&
                (item.OrganizationId is null || item.OrganizationId == session.ActiveOrganizationId) &&
                (item.SoftwareProductId is null || item.SoftwareProductId == softwareId));
            if (!permitted)
            {
                return false;
            }
        }

        session.ActiveSoftwareProductId = softwareId;
        session.Version++;
        return true;
    }

    public async ValueTask<bool> IsAuthorizedAsync(Guid sessionId, string permission, AccessScope requestedScope, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var me = await ResolveMeAsync(sessionId, now, cancellationToken);
        if (me?.ActivePersona is null || !me.Permissions.Contains(permission, StringComparer.Ordinal) || me.ActiveTenantId != requestedScope.TenantId.Value)
        {
            return false;
        }

        return (me.ActiveOrganizationId is null || me.ActiveOrganizationId == requestedScope.OrganizationId?.Value) &&
               (me.ActiveSoftwareId is null || me.ActiveSoftwareId == requestedScope.SoftwareId?.Value);
    }

    public async ValueTask<IdentityPage<IdentityUserRow>> ListUsersAsync(ListIdentityUsersQuery query, Guid sessionId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var actor = await RequirePermissionAsync(sessionId, "users.view", now, cancellationToken);
        var source = dbContext.Set<UserProfileRecord>().AsNoTracking().Where(user => user.TenantId == actor.ActiveTenantId);
        if (!string.IsNullOrWhiteSpace(query.Filter))
        {
            source = source.Where(user => EF.Functions.ILike(user.Username, $"%{query.Filter}%") || EF.Functions.ILike(user.DisplayName, $"%{query.Filter}%"));
        }

        source = query.Direction.Equals("desc", StringComparison.OrdinalIgnoreCase)
            ? source.OrderByDescending(user => query.SortBy == "username" ? user.Username : user.DisplayName).ThenBy(user => user.Id)
            : source.OrderBy(user => query.SortBy == "username" ? user.Username : user.DisplayName).ThenBy(user => user.Id);
        var page = NormalizePage(query.PageNumber, query.PageSize);
        var total = await source.LongCountAsync(cancellationToken);
        var users = await source.Skip((page.Number - 1) * page.Size).Take(page.Size).ToArrayAsync(cancellationToken);
        var userIds = users.Select(user => user.Id).ToArray();
        var roleLookup = await (from membership in dbContext.Set<MembershipRecord>().AsNoTracking()
                                join assignment in dbContext.Set<RoleAssignmentRecord>().AsNoTracking() on membership.Id equals assignment.MembershipId
                                where userIds.Contains(membership.UserId)
                                select new { membership.UserId, assignment.RoleId })
            .ToListAsync(cancellationToken);
        var items = users.Select(user => new IdentityUserRow(user.Id, user.TenantId, user.Username, user.DisplayName, user.Email, user.Mobile, user.IsActive, roleLookup.Where(item => item.UserId == user.Id).Select(item => item.RoleId).Distinct().ToArray(), user.Version)).ToArray();
        return new IdentityPage<IdentityUserRow>(items, page.Number, page.Size, total);
    }

    public async ValueTask<IdentityUserRow> UpsertUserAsync(UpsertIdentityUserCommand command, Guid? providerSubject, Guid sessionId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var actor = await RequirePermissionAsync(sessionId, command.UserId is null ? "users.create" : "users.edit", now, cancellationToken);
        if (actor.ActiveTenantId != command.TenantId)
        {
            throw new ApplicationAuthorizationException("scope.tenant.forbidden", "Target tenant is outside the active scope.");
        }

        var selectedRoles = await dbContext.Set<RoleRecord>().Where(role => command.RoleIds.Contains(role.Id) && role.TenantId == command.TenantId).ToArrayAsync(cancellationToken);
        if (selectedRoles.Length != command.RoleIds.Count || selectedRoles.Any(role => role.Persona != command.Persona))
        {
            throw new ApplicationAuthorizationException("role.assignment.forbidden", "One or more roles are outside the persona or tenant scope.");
        }

        var grantable = actor.Permissions.ToHashSet(StringComparer.Ordinal);
        var selectedRoleIds = selectedRoles.Select(role => role.Id).ToArray();
        var requestedPermissions = await dbContext.Set<RolePermissionRecord>().Where(item => selectedRoleIds.Contains(item.RoleId)).Select(item => item.PermissionCode).Distinct().ToArrayAsync(cancellationToken);
        if (requestedPermissions.Any(permission => !grantable.Contains(permission)))
        {
            throw new ApplicationAuthorizationException("role.permission.escalation", "Cannot grant permissions the actor does not have.");
        }

        UserProfileRecord user;
        MembershipRecord membership;
        if (command.UserId is null)
        {
            if (providerSubject is null)
            {
                throw new InvalidOperationException("Provider subject is required for a new user.");
            }

            user = new UserProfileRecord { Id = Guid.NewGuid(), TenantId = command.TenantId, ExternalSubject = providerSubject.Value.ToString(), Username = command.Username.Trim(), DisplayName = command.DisplayName.Trim(), Email = command.Email?.Trim(), Mobile = command.Mobile?.Trim(), IsActive = true, Version = 0 };
            membership = new MembershipRecord { Id = Guid.NewGuid(), TenantId = command.TenantId, OrganizationId = command.OrganizationId, UserId = user.Id, IsActive = true, Version = 0 };
            dbContext.AddRange(user, membership);
        }
        else
        {
            user = await dbContext.Set<UserProfileRecord>().SingleOrDefaultAsync(item => item.Id == command.UserId && item.TenantId == actor.ActiveTenantId, cancellationToken)
                ?? throw new ApplicationAuthorizationException("identity.user.not_found", "User was not found in the active scope.");
            membership = await dbContext.Set<MembershipRecord>().SingleOrDefaultAsync(item => item.UserId == user.Id && item.OrganizationId == command.OrganizationId, cancellationToken)
                ?? throw new ApplicationAuthorizationException("identity.membership.not_found", "Membership was not found in the active scope.");
            user.Username = command.Username.Trim();
            user.DisplayName = command.DisplayName.Trim();
            user.Email = command.Email?.Trim();
            user.Mobile = command.Mobile?.Trim();
            user.IsActive = command.IsActive;
            user.Version++;
            var existingAssignments = await dbContext.Set<RoleAssignmentRecord>().Where(item => item.MembershipId == membership.Id && item.Persona == command.Persona).ToArrayAsync(cancellationToken);
            dbContext.RemoveRange(existingAssignments);
        }

        foreach (var role in selectedRoles)
        {
            dbContext.Set<RoleAssignmentRecord>().Add(new RoleAssignmentRecord { Id = Guid.NewGuid(), TenantId = command.TenantId, MembershipId = membership.Id, RoleId = role.Id, Persona = command.Persona, SoftwareProductId = command.SoftwareId });
        }

        return new IdentityUserRow(user.Id, user.TenantId, user.Username, user.DisplayName, user.Email, user.Mobile, user.IsActive, selectedRoleIds, user.Version);
    }

    public async ValueTask DeactivateUserAsync(Guid userId, long version, Guid sessionId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var actor = await RequirePermissionAsync(sessionId, "users.edit", now, cancellationToken);
        var user = await dbContext.Set<UserProfileRecord>().SingleOrDefaultAsync(item => item.Id == userId && item.TenantId == actor.ActiveTenantId, cancellationToken)
            ?? throw new ApplicationAuthorizationException("identity.user.not_found", "User was not found in the active scope.");
        if (user.Version != version)
        {
            throw new ApplicationConcurrencyException("User profile changed after it was loaded.");
        }

        var ownerRoleId = await dbContext.Set<RoleRecord>().Where(role => role.TenantId == actor.ActiveTenantId && role.Code == "platform_owner").Select(role => (Guid?)role.Id).SingleOrDefaultAsync(cancellationToken);
        if (ownerRoleId is not null)
        {
            var isOwner = await HasRoleAsync(user.Id, ownerRoleId.Value, cancellationToken);
            var ownerCount = await CountActiveOwnersAsync(ownerRoleId.Value, actor.ActiveTenantId!.Value, cancellationToken);
            if (isOwner && ownerCount <= 1)
            {
                throw new ApplicationAuthorizationException("user.last_platform_owner", "The last platform owner cannot be deactivated.");
            }
        }

        user.IsActive = false;
        user.Version++;
        var sessions = await dbContext.Set<UserSessionRecord>().Where(item => item.UserId == user.Id && item.RevokedAtUtc == null).ToArrayAsync(cancellationToken);
        foreach (var session in sessions) session.RevokedAtUtc = now;
    }

    public async ValueTask TransferPlatformOwnershipAsync(Guid targetUserId, Guid sessionId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var actor = await RequirePermissionAsync(sessionId, "users.edit", now, cancellationToken);
        var role = await dbContext.Set<RoleRecord>().SingleAsync(item => item.TenantId == actor.ActiveTenantId && item.Code == "platform_owner", cancellationToken);
        var actorId = actor.UserId;
        var source = await (from membership in dbContext.Set<MembershipRecord>() join assignment in dbContext.Set<RoleAssignmentRecord>() on membership.Id equals assignment.MembershipId where membership.UserId == actorId && assignment.RoleId == role.Id select assignment).SingleOrDefaultAsync(cancellationToken)
            ?? throw new ApplicationAuthorizationException("ownership.source_missing", "Current actor is not a platform owner.");
        var targetMembership = await dbContext.Set<MembershipRecord>().SingleOrDefaultAsync(item => item.UserId == targetUserId && item.TenantId == actor.ActiveTenantId && item.IsActive, cancellationToken)
            ?? throw new ApplicationAuthorizationException("ownership.target_forbidden", "Target user is outside the active tenant.");
        var exists = await dbContext.Set<RoleAssignmentRecord>().AnyAsync(item => item.MembershipId == targetMembership.Id && item.RoleId == role.Id, cancellationToken);
        if (!exists)
        {
            dbContext.Set<RoleAssignmentRecord>().Add(new RoleAssignmentRecord { Id = Guid.NewGuid(), TenantId = actor.ActiveTenantId!.Value, MembershipId = targetMembership.Id, RoleId = role.Id, Persona = "platform" });
        }

        dbContext.Remove(source);
    }

    public async ValueTask<IdentityPage<IdentityRoleRow>> ListRolesAsync(ListRolesQuery query, Guid sessionId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var actor = await RequirePermissionAsync(sessionId, "roles.view", now, cancellationToken);
        var source = dbContext.Set<RoleRecord>().AsNoTracking().Where(role => role.TenantId == actor.ActiveTenantId);
        if (!string.IsNullOrWhiteSpace(query.Filter)) source = source.Where(role => EF.Functions.ILike(role.Code, $"%{query.Filter}%") || EF.Functions.ILike(role.Name, $"%{query.Filter}%"));
        source = query.Direction.Equals("desc", StringComparison.OrdinalIgnoreCase) ? source.OrderByDescending(role => role.Name).ThenBy(role => role.Id) : source.OrderBy(role => role.Name).ThenBy(role => role.Id);
        var page = NormalizePage(query.PageNumber, query.PageSize);
        var total = await source.LongCountAsync(cancellationToken);
        var roles = await source.Skip((page.Number - 1) * page.Size).Take(page.Size).ToArrayAsync(cancellationToken);
        var roleIds = roles.Select(role => role.Id).ToArray();
        var permissions = await dbContext.Set<RolePermissionRecord>().AsNoTracking().Where(item => roleIds.Contains(item.RoleId)).ToArrayAsync(cancellationToken);
        return new IdentityPage<IdentityRoleRow>(roles.Select(role => new IdentityRoleRow(role.Id, role.TenantId, role.Code, role.Name, role.Persona, role.IsSystem, permissions.Where(item => item.RoleId == role.Id).Select(item => item.PermissionCode).OrderBy(item => item).ToArray(), role.Version)).ToArray(), page.Number, page.Size, total);
    }

    public async ValueTask<IdentityRoleRow> UpsertRoleAsync(UpsertRoleCommand command, Guid sessionId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var actor = await RequirePermissionAsync(sessionId, command.RoleId is null ? "roles.create" : "roles.edit", now, cancellationToken);
        if (command.Permissions.Any(permission => !actor.Permissions.Contains(permission, StringComparer.Ordinal)))
        {
            throw new ApplicationAuthorizationException("role.permission.escalation", "Cannot grant permissions the actor does not have.");
        }

        RoleRecord role;
        if (command.RoleId is null)
        {
            role = new RoleRecord { Id = Guid.NewGuid(), TenantId = actor.ActiveTenantId!.Value, Code = command.Code.Trim().ToLowerInvariant(), Name = command.Name.Trim(), Persona = command.Persona, IsSystem = false, Version = 0 };
            dbContext.Add(role);
        }
        else
        {
            role = await dbContext.Set<RoleRecord>().SingleOrDefaultAsync(item => item.Id == command.RoleId && item.TenantId == actor.ActiveTenantId, cancellationToken)
                ?? throw new ApplicationAuthorizationException("role.not_found", "Role was not found in the active tenant.");
            if (role.IsSystem) throw new ApplicationAuthorizationException("role.system.immutable", "System roles cannot be edited.");
            if (command.Version != role.Version) throw new ApplicationConcurrencyException("Role changed after it was loaded.");
            role.Name = command.Name.Trim();
            role.Version++;
            dbContext.RemoveRange(dbContext.Set<RolePermissionRecord>().Where(item => item.RoleId == role.Id));
        }

        foreach (var permission in command.Permissions.Distinct(StringComparer.Ordinal)) dbContext.Set<RolePermissionRecord>().Add(new RolePermissionRecord { RoleId = role.Id, PermissionCode = permission });
        return new IdentityRoleRow(role.Id, role.TenantId, role.Code, role.Name, role.Persona, role.IsSystem, command.Permissions, role.Version);
    }

    public async ValueTask DeleteRoleAsync(Guid roleId, long version, Guid sessionId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var actor = await RequirePermissionAsync(sessionId, "roles.delete", now, cancellationToken);
        var role = await dbContext.Set<RoleRecord>().SingleOrDefaultAsync(item => item.Id == roleId && item.TenantId == actor.ActiveTenantId, cancellationToken)
            ?? throw new ApplicationAuthorizationException("role.not_found", "Role was not found in the active tenant.");
        if (role.IsSystem) throw new ApplicationAuthorizationException("role.system.immutable", "System roles cannot be deleted.");
        if (role.Version != version) throw new ApplicationConcurrencyException("Role changed after it was loaded.");
        if (await dbContext.Set<RoleAssignmentRecord>().AnyAsync(item => item.RoleId == role.Id, cancellationToken)) throw new ApplicationAuthorizationException("role.in_use", "Role is assigned and cannot be deleted.");
        dbContext.Remove(role);
    }

    private async Task<MeResult> RequirePermissionAsync(Guid sessionId, string permission, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var actor = await ResolveMeAsync(sessionId, now, cancellationToken);
        if (actor?.ActiveTenantId is null || !actor.Permissions.Contains(permission, StringComparer.Ordinal))
        {
            throw new ApplicationAuthorizationException("authorization.forbidden", "Permission is not available in the active persona.");
        }

        return actor;
    }

    private async Task<UserSessionRecord?> FindSessionRowAsync(Guid sessionId, CancellationToken cancellationToken) =>
        dbContext.Set<UserSessionRecord>().Local.FirstOrDefault(item => item.Id == sessionId) ??
        await dbContext.Set<UserSessionRecord>().SingleOrDefaultAsync(item => item.Id == sessionId, cancellationToken);

    private async Task<AssignmentProjection[]> LoadAssignmentsAsync(Guid userId, DateTimeOffset now, CancellationToken cancellationToken) =>
        await (from membership in dbContext.Set<MembershipRecord>().AsNoTracking()
               join assignment in dbContext.Set<RoleAssignmentRecord>().AsNoTracking() on membership.Id equals assignment.MembershipId
               join role in dbContext.Set<RoleRecord>().AsNoTracking() on assignment.RoleId equals role.Id
               where membership.UserId == userId && membership.IsActive && (membership.ExpiresAtUtc == null || membership.ExpiresAtUtc > now) && (assignment.ExpiresAtUtc == null || assignment.ExpiresAtUtc > now)
               select new AssignmentProjection(role.Id, assignment.Persona, membership.TenantId, membership.OrganizationId, assignment.SoftwareProductId))
            .ToArrayAsync(cancellationToken);

    private async Task<bool> HasRoleAsync(Guid userId, Guid roleId, CancellationToken cancellationToken) =>
        await (from membership in dbContext.Set<MembershipRecord>() join assignment in dbContext.Set<RoleAssignmentRecord>() on membership.Id equals assignment.MembershipId where membership.UserId == userId && membership.IsActive && assignment.RoleId == roleId select assignment.Id).AnyAsync(cancellationToken);

    private async Task<int> CountActiveOwnersAsync(Guid roleId, Guid tenantId, CancellationToken cancellationToken) =>
        await (from user in dbContext.Set<UserProfileRecord>() join membership in dbContext.Set<MembershipRecord>() on user.Id equals membership.UserId join assignment in dbContext.Set<RoleAssignmentRecord>() on membership.Id equals assignment.MembershipId where user.TenantId == tenantId && user.IsActive && membership.IsActive && assignment.RoleId == roleId select user.Id).Distinct().CountAsync(cancellationToken);

    private static (int Number, int Size) NormalizePage(int number, int size) => (Math.Max(1, number), Math.Clamp(size, 1, 200));
    private static bool ValidPersona(string persona) => persona is "platform" or "software_owner" or "company" or "support" or "tenant";
    private static string PersonaLabel(string persona) => persona switch { "platform" => "پلتفرم", "software_owner" => "مالک نرم‌افزار", "company" => "شرکت نرم‌افزاری", "support" => "پشتیبان", "tenant" => "سازمان/کاربر نهایی", _ => persona };
    private sealed record AssignmentProjection(Guid RoleId, string Persona, Guid TenantId, Guid? OrganizationId, Guid? SoftwareProductId);
}
