using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace AiQuery.Infrastructure.Persistence;

internal sealed class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("AIQUERY_MIGRATION_CONNECTION")
            ?? "Host=localhost;Port=5432;Database=aiquery_design;Username=aiquery_migrator";
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable("__ef_migrations_history", "app"))
            .Options;
        return new AppDbContext(options);
    }
}
