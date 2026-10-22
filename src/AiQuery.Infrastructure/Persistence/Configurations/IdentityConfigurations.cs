using AiQuery.Infrastructure.Persistence.Records;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiQuery.Infrastructure.Persistence.Configurations;

internal sealed class UserProfileConfiguration : IEntityTypeConfiguration<UserProfileRecord>
{
    public void Configure(EntityTypeBuilder<UserProfileRecord> b) { b.ToTable("users"); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.ExternalSubject).HasMaxLength(300); b.Property(x => x.Username).HasMaxLength(100); b.Property(x => x.DisplayName).HasMaxLength(200); b.Property(x => x.Email).HasMaxLength(320); b.Property(x => x.Mobile).HasMaxLength(32); b.Property(x => x.Version).IsConcurrencyToken(); b.HasIndex(x => new { x.TenantId, x.ExternalSubject }).IsUnique(); b.HasIndex(x => new { x.TenantId, x.Username }).IsUnique(); }
}
internal sealed class RoleConfiguration : IEntityTypeConfiguration<RoleRecord>
{
    public void Configure(EntityTypeBuilder<RoleRecord> b) { b.ToTable("roles"); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.Code).HasMaxLength(100); b.Property(x => x.Name).HasMaxLength(200); b.Property(x => x.Persona).HasMaxLength(32); b.Property(x => x.Version).IsConcurrencyToken(); b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique(); }
}
internal sealed class PermissionConfiguration : IEntityTypeConfiguration<PermissionRecord>
{
    public void Configure(EntityTypeBuilder<PermissionRecord> b) { b.ToTable("permissions"); b.HasKey(x => x.Code); b.Property(x => x.Code).HasMaxLength(150); b.Property(x => x.Description).HasMaxLength(500); b.HasData(PermissionSeed.All); }
}
internal sealed class RolePermissionConfiguration : IEntityTypeConfiguration<RolePermissionRecord>
{
    public void Configure(EntityTypeBuilder<RolePermissionRecord> b) { b.ToTable("role_permissions"); b.HasKey(x => new { x.RoleId, x.PermissionCode }); b.HasOne<RoleRecord>().WithMany().HasForeignKey(x => x.RoleId).OnDelete(DeleteBehavior.Cascade); b.HasOne<PermissionRecord>().WithMany().HasForeignKey(x => x.PermissionCode).OnDelete(DeleteBehavior.Restrict); }
}
internal sealed class MembershipConfiguration : IEntityTypeConfiguration<MembershipRecord>
{
    public void Configure(EntityTypeBuilder<MembershipRecord> b) { b.ToTable("memberships"); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.Version).IsConcurrencyToken(); b.HasIndex(x => new { x.TenantId, x.OrganizationId, x.UserId }).IsUnique(); b.HasOne<OrganizationRecord>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict); b.HasOne<UserProfileRecord>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict); }
}
internal sealed class RoleAssignmentConfiguration : IEntityTypeConfiguration<RoleAssignmentRecord>
{
    public void Configure(EntityTypeBuilder<RoleAssignmentRecord> b) { b.ToTable("role_assignments"); b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever(); b.Property(x => x.Persona).HasMaxLength(32); b.Property(x => x.RegionCode).HasMaxLength(32); b.HasIndex(x => new { x.MembershipId, x.RoleId, x.Persona, x.SoftwareProductId, x.SoftwareVersionId }).IsUnique().HasDatabaseName("ix_role_assignment_scope"); b.HasOne<MembershipRecord>().WithMany().HasForeignKey(x => x.MembershipId).OnDelete(DeleteBehavior.Cascade); b.HasOne<RoleRecord>().WithMany().HasForeignKey(x => x.RoleId).OnDelete(DeleteBehavior.Restrict); b.HasOne<SoftwareProductRecord>().WithMany().HasForeignKey(x => x.SoftwareProductId).OnDelete(DeleteBehavior.Restrict); b.HasOne<SoftwareVersionRecord>().WithMany().HasForeignKey(x => x.SoftwareVersionId).OnDelete(DeleteBehavior.Restrict); }
}

internal sealed class UserSessionConfiguration : IEntityTypeConfiguration<UserSessionRecord>
{
    public void Configure(EntityTypeBuilder<UserSessionRecord> b)
    {
        b.ToTable("user_sessions");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.ActivePersona).HasMaxLength(32);
        b.Property(x => x.Version).IsConcurrencyToken();
        b.HasIndex(x => new { x.UserId, x.ExpiresAtUtc });
        b.HasIndex(x => new { x.RevokedAtUtc, x.ExpiresAtUtc });
        b.HasOne<UserProfileRecord>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal static class PermissionSeed
{
    internal static readonly PermissionRecord[] All =
    [
        new() { Code = "software.read", Description = "Read scoped software catalog", CatalogVersion = 1 },
        new() { Code = "software.create", Description = "Create scoped software products", CatalogVersion = 1 },
        new() { Code = "knowledge.create", Description = "Create knowledge snapshots", CatalogVersion = 1 },
        new() { Code = "knowledge.publish", Description = "Publish approved knowledge snapshots", CatalogVersion = 1 },
        new() { Code = "query.feedback.create", Description = "Submit scoped query feedback", CatalogVersion = 1 }
        ,new() { Code = "software.view", Description = "View scoped software", CatalogVersion = 1 }
        ,new() { Code = "software.edit", Description = "Edit scoped software", CatalogVersion = 1 }
        ,new() { Code = "software.delete", Description = "Delete scoped software", CatalogVersion = 1 }
        ,new() { Code = "databases.view", Description = "View database metadata", CatalogVersion = 1 }
        ,new() { Code = "databases.create", Description = "Create database metadata", CatalogVersion = 1 }
        ,new() { Code = "databases.edit", Description = "Edit database metadata", CatalogVersion = 1 }
        ,new() { Code = "databases.delete", Description = "Delete database metadata", CatalogVersion = 1 }
        ,new() { Code = "versions.view", Description = "View software versions", CatalogVersion = 1 }
        ,new() { Code = "versions.create", Description = "Create software versions", CatalogVersion = 1 }
        ,new() { Code = "versions.edit", Description = "Edit software versions", CatalogVersion = 1 }
    ];
}
