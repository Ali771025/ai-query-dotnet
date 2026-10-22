using AiQuery.Infrastructure.Persistence.Records;
using AiQuery.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace AiQuery.Infrastructure.Persistence;

internal sealed class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<IdentityAccount, IdentityRole<Guid>, Guid>(options)
{
    internal DbSet<SoftwareProductRecord> SoftwareProducts => Set<SoftwareProductRecord>();
    internal DbSet<SoftwareVersionRecord> SoftwareVersions => Set<SoftwareVersionRecord>();
    internal DbSet<SoftwareDatabaseRecord> SoftwareDatabases => Set<SoftwareDatabaseRecord>();
    internal DbSet<VersionDependencyRecord> VersionDependencies => Set<VersionDependencyRecord>();
    internal DbSet<KnowledgeSnapshotRecord> KnowledgeSnapshots => Set<KnowledgeSnapshotRecord>();
    internal DbSet<PublicationPointerRecord> PublicationPointers => Set<PublicationPointerRecord>();
    internal DbSet<OutboxMessageRecord> OutboxMessages => Set<OutboxMessageRecord>();
    internal DbSet<IdempotencyRecord> IdempotencyRecords => Set<IdempotencyRecord>();
    internal DbSet<QueryResultRecord> QueryResults => Set<QueryResultRecord>();
    internal DbSet<FeedbackEntryRecord> FeedbackEntries => Set<FeedbackEntryRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.HasDefaultSchema("app");
        ConfigureIdentityTables(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
        ApplySnakeCaseNames(modelBuilder);
    }

    private static void ConfigureIdentityTables(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<IdentityAccount>().ToTable("identity_accounts");
        modelBuilder.Entity<IdentityRole<Guid>>().ToTable("identity_provider_roles");
        modelBuilder.Entity<IdentityUserRole<Guid>>().ToTable("identity_account_roles");
        modelBuilder.Entity<IdentityUserClaim<Guid>>().ToTable("identity_account_claims");
        modelBuilder.Entity<IdentityUserLogin<Guid>>().ToTable("identity_account_logins");
        modelBuilder.Entity<IdentityRoleClaim<Guid>>().ToTable("identity_provider_role_claims");
        modelBuilder.Entity<IdentityUserToken<Guid>>().ToTable("identity_account_tokens");
    }

    private static void ApplySnakeCaseNames(ModelBuilder modelBuilder)
    {
        foreach (var entity in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entity.GetProperties()) property.SetColumnName(ToSnakeCase(property.GetColumnName()));
            foreach (var key in entity.GetKeys()) if (key.GetName() is { } keyName) key.SetName(ToSnakeCase(keyName));
            foreach (var foreignKey in entity.GetForeignKeys()) if (foreignKey.GetConstraintName() is { } constraintName) foreignKey.SetConstraintName(ToSnakeCase(constraintName));
            foreach (var index in entity.GetIndexes()) if (index.GetDatabaseName() is { } indexName) index.SetDatabaseName(ToSnakeCase(indexName));
        }
    }

    private static string ToSnakeCase(string value) => string.Concat(value.Select((character, index) => char.IsUpper(character) && index > 0 ? $"_{char.ToLowerInvariant(character)}" : char.ToLowerInvariant(character).ToString()));
}
