using AiQuery.Domain.Common;

namespace AiQuery.Domain.IdentityAccess;

public enum PersonaCode
{
    Platform,
    SoftwareOwner,
    Company,
    Support,
    Tenant
}

public sealed record PermissionCode
{
    private PermissionCode(string value) => Value = value;
    public string Value { get; }

    public static PermissionCode Create(string value)
    {
        var normalized = value?.Trim().ToLowerInvariant() ?? string.Empty;
        if (normalized.Length is < 3 or > 150 || normalized.Any(character =>
                !(char.IsAsciiLetterOrDigit(character) || character is '.' or '-' or '_')))
        {
            throw new DomainRuleException("permission.code.invalid", "Permission code is invalid.");
        }

        return new PermissionCode(normalized);
    }
}

public sealed record ScopedRoleAssignment(
    RoleId RoleId,
    PersonaCode Persona,
    AccessScope Scope,
    string? RegionCode,
    DateTimeOffset? ExpiresAtUtc);

public sealed class OrganizationMembership : AggregateRoot<UserId>
{
    private readonly List<ScopedRoleAssignment> _assignments = [];

    public OrganizationMembership(UserId userId, AccessScope membershipScope)
        : base(userId)
    {
        if (userId.Value == Guid.Empty)
        {
            throw new DomainRuleException("membership.user.invalid", "User is required.");
        }

        MembershipScope = membershipScope;
    }

    public AccessScope MembershipScope { get; }
    public bool IsActive { get; private set; } = true;
    public IReadOnlyList<ScopedRoleAssignment> Assignments => _assignments.AsReadOnly();

    public void AssignRole(
        RoleId roleId,
        PersonaCode persona,
        AccessScope scope,
        string? regionCode = null,
        DateTimeOffset? expiresAtUtc = null)
    {
        if (!IsActive)
        {
            throw new DomainRuleException("membership.inactive", "Cannot assign a role to an inactive membership.");
        }

        if (roleId.Value == Guid.Empty)
        {
            throw new DomainRuleException("role.invalid", "Role is required.");
        }

        if (!MembershipScope.Contains(scope))
        {
            throw new DomainRuleException("role.scope.invalid", "Role scope must be within membership scope.");
        }

        var normalizedRegion = string.IsNullOrWhiteSpace(regionCode) ? null : regionCode.Trim().ToUpperInvariant();
        if (normalizedRegion is { Length: > 32 })
        {
            throw new DomainRuleException("role.region.invalid", "Region scope is invalid.");
        }

        if (_assignments.Any(item =>
                item.RoleId == roleId &&
                item.Persona == persona &&
                item.Scope == scope &&
                item.RegionCode == normalizedRegion))
        {
            return;
        }

        _assignments.Add(new ScopedRoleAssignment(roleId, persona, scope, normalizedRegion, expiresAtUtc));
    }

    public void AssignRole(string role, AccessScope scope)
    {
        if (string.IsNullOrWhiteSpace(role))
        {
            throw new DomainRuleException("role.invalid", "Role is required.");
        }

        AssignRole(new RoleId(DeterministicRoleId(role)), PersonaCode.Support, scope);
    }

    public void RevokeRole(RoleId roleId, PersonaCode persona, AccessScope scope) =>
        _assignments.RemoveAll(item => item.RoleId == roleId && item.Persona == persona && item.Scope == scope);

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;

    private static Guid DeterministicRoleId(string value)
    {
        var bytes = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(value.Trim().ToLowerInvariant()));
        return new Guid(bytes.AsSpan(0, 16));
    }
}

public sealed class RoleDefinition : AggregateRoot<RoleId>
{
    private readonly HashSet<PermissionCode> _permissions = [];

    private RoleDefinition(
        RoleId id,
        TenantId tenantId,
        string code,
        string name,
        PersonaCode persona,
        bool isSystem)
        : base(id)
    {
        TenantId = tenantId;
        Code = code;
        Name = name;
        Persona = persona;
        IsSystem = isSystem;
    }

    public TenantId TenantId { get; }
    public string Code { get; }
    public string Name { get; private set; }
    public PersonaCode Persona { get; }
    public bool IsSystem { get; }
    public IReadOnlyCollection<PermissionCode> Permissions => _permissions;

    public static RoleDefinition Create(
        RoleId id,
        TenantId tenantId,
        string code,
        string name,
        PersonaCode persona,
        bool isSystem,
        IEnumerable<PermissionCode> permissions)
    {
        var normalizedCode = code?.Trim().ToLowerInvariant() ?? string.Empty;
        var normalizedName = name?.Trim() ?? string.Empty;
        if (id.Value == Guid.Empty || tenantId.Value == Guid.Empty)
        {
            throw new DomainRuleException("role.identity.invalid", "Role identity and tenant are required.");
        }

        if (normalizedCode.Length is < 2 or > 100 || normalizedName.Length is < 2 or > 200)
        {
            throw new DomainRuleException("role.definition.invalid", "Role code or name is invalid.");
        }

        var role = new RoleDefinition(id, tenantId, normalizedCode, normalizedName, persona, isSystem);
        role.ReplacePermissions(permissions, permissions);
        return role;
    }

    public void Rename(string name)
    {
        if (IsSystem)
        {
            throw new DomainRuleException("role.system.immutable", "System roles cannot be renamed.");
        }

        var normalized = name?.Trim() ?? string.Empty;
        if (normalized.Length is < 2 or > 200)
        {
            throw new DomainRuleException("role.name.invalid", "Role name is invalid.");
        }

        Name = normalized;
        IncrementVersion();
    }

    public void ReplacePermissions(
        IEnumerable<PermissionCode> requested,
        IEnumerable<PermissionCode> grantEnvelope)
    {
        var requestedSet = requested.ToHashSet();
        var envelope = grantEnvelope.ToHashSet();
        if (!requestedSet.IsSubsetOf(envelope))
        {
            throw new DomainRuleException("role.permission.escalation", "Role permissions exceed the grant envelope.");
        }

        _permissions.Clear();
        _permissions.UnionWith(requestedSet);
        IncrementVersion();
    }
}

public sealed class UserProfile : AggregateRoot<UserId>
{
    private UserProfile(UserId id, TenantId tenantId, string externalSubject, string displayName, Email? email)
        : base(id)
    {
        TenantId = tenantId;
        ExternalSubject = externalSubject;
        DisplayName = displayName;
        Email = email;
    }

    public TenantId TenantId { get; }
    public string ExternalSubject { get; }
    public string DisplayName { get; private set; }
    public Email? Email { get; private set; }
    public bool IsActive { get; private set; } = true;

    public static UserProfile Create(UserId id, TenantId tenantId, string externalSubject, string displayName, Email? email)
    {
        var subject = externalSubject?.Trim() ?? string.Empty;
        var name = displayName?.Trim() ?? string.Empty;
        if (id.Value == Guid.Empty || tenantId.Value == Guid.Empty || subject.Length is < 1 or > 300 || name.Length is < 2 or > 200)
        {
            throw new DomainRuleException("user.profile.invalid", "User profile is invalid.");
        }

        return new UserProfile(id, tenantId, subject, name, email);
    }

    public void Update(string displayName, Email? email)
    {
        var name = displayName?.Trim() ?? string.Empty;
        if (name.Length is < 2 or > 200)
        {
            throw new DomainRuleException("user.name.invalid", "Display name is invalid.");
        }

        DisplayName = name;
        Email = email;
        IncrementVersion();
    }

    public void Deactivate(bool isLastPlatformOwner)
    {
        if (isLastPlatformOwner)
        {
            throw new DomainRuleException("user.last_platform_owner", "The last active platform owner cannot be deactivated.");
        }

        IsActive = false;
        IncrementVersion();
    }

    public void Activate()
    {
        IsActive = true;
        IncrementVersion();
    }
}
