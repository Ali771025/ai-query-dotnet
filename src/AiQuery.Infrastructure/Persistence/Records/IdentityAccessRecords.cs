namespace AiQuery.Infrastructure.Persistence.Records;

internal sealed class UserProfileRecord
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string ExternalSubject { get; set; }
    public required string Username { get; set; }
    public required string DisplayName { get; set; }
    public string? Email { get; set; }
    public string? Mobile { get; set; }
    public bool IsActive { get; set; } = true;
    public long Version { get; set; }
}

internal sealed class RoleRecord
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public required string Persona { get; set; }
    public bool IsSystem { get; set; }
    public long Version { get; set; }
}

internal sealed class PermissionRecord
{
    public required string Code { get; set; }
    public required string Description { get; set; }
    public int CatalogVersion { get; set; }
}

internal sealed class RolePermissionRecord
{
    public Guid RoleId { get; set; }
    public required string PermissionCode { get; set; }
}

internal sealed class MembershipRecord
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid UserId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset? ExpiresAtUtc { get; set; }
    public long Version { get; set; }
}

internal sealed class RoleAssignmentRecord
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid MembershipId { get; set; }
    public Guid RoleId { get; set; }
    public required string Persona { get; set; }
    public Guid? SoftwareProductId { get; set; }
    public Guid? SoftwareVersionId { get; set; }
    public string? RegionCode { get; set; }
    public DateTimeOffset? ExpiresAtUtc { get; set; }
}

internal sealed class UserSessionRecord
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset ExpiresAtUtc { get; set; }
    public DateTimeOffset? RevokedAtUtc { get; set; }
    public string? ActivePersona { get; set; }
    public Guid? ActiveTenantId { get; set; }
    public Guid? ActiveOrganizationId { get; set; }
    public Guid? ActiveSoftwareProductId { get; set; }
    public long Version { get; set; }
}
