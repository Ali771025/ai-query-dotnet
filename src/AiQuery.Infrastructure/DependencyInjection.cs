using AiQuery.Application.Common.Interfaces;
using AiQuery.Application.Common.Messaging;
using AiQuery.Application.Features.AuditQuality.Commands.SubmitQueryFeedback;
using AiQuery.Application.Features.IdentityAccess.Interfaces;
using AiQuery.Application.Features.IdentityAccess.Services;
using AiQuery.Infrastructure.Configuration;
using AiQuery.Infrastructure.Messaging;
using AiQuery.Infrastructure.Identity;
using AiQuery.Infrastructure.Persistence;
using AiQuery.Infrastructure.Repositories;
using AiQuery.Infrastructure.Services;
using AiQuery.Infrastructure.Storage;
using AiQuery.Infrastructure.Ai;
using AiQuery.Application.Features.VersionedKnowledge.Interfaces;
using AiQuery.Application.Features.VersionedKnowledge.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Identity;

namespace AiQuery.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<PlatformOptions>()
            .Bind(configuration.GetRequiredSection(PlatformOptions.SectionName))
            .Validate(options => !string.IsNullOrWhiteSpace(options.ServiceName), "Platform:ServiceName is required.")
            .Validate(options => !string.IsNullOrWhiteSpace(options.Version), "Platform:Version is required.")
            .Validate(options => options.RequestTimeoutSeconds is >= 1 and <= 300, "Platform:RequestTimeoutSeconds must be between 1 and 300.")
            .ValidateOnStart();

        services.AddOptions<KnowledgeStorageOptions>()
            .Bind(configuration.GetSection(KnowledgeStorageOptions.SectionName))
            .Validate(options => !string.IsNullOrWhiteSpace(options.RootPath), "KnowledgeStorage:RootPath is required.")
            .ValidateOnStart();
        services.AddOptions<KnowledgeLifecycleOptions>()
            .Bind(configuration.GetSection(KnowledgeLifecycleOptions.SectionName))
            .Validate(options => options.MaxFileSizeBytes > 0 && options.MaxFilesPerUpload > 0, "Knowledge upload limits must be positive.")
            .ValidateOnStart();
        services.AddSingleton(provider => provider.GetRequiredService<Microsoft.Extensions.Options.IOptions<KnowledgeLifecycleOptions>>().Value);

        var databaseOptions = configuration.GetRequiredSection(DatabaseOptions.SectionName).Get<DatabaseOptions>()
            ?? throw new InvalidOperationException("Database configuration is required.");
        if (string.IsNullOrWhiteSpace(databaseOptions.ConnectionString)) throw new InvalidOperationException("Database:ConnectionString is required.");
        if (databaseOptions.CommandTimeoutSeconds is < 1 or > 300) throw new InvalidOperationException("Database command timeout must be between 1 and 300 seconds.");

        services.AddDbContext<AppDbContext>(options => options.UseNpgsql(
            databaseOptions.ConnectionString,
            npgsql =>
            {
                npgsql.CommandTimeout(databaseOptions.CommandTimeoutSeconds);
                npgsql.MigrationsHistoryTable("__ef_migrations_history", "app");
                npgsql.EnableRetryOnFailure(3, TimeSpan.FromSeconds(2), null);
            }));

        services.AddIdentityCore<IdentityAccount>(options =>
            {
                options.Password.RequiredLength = 12;
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireNonAlphanumeric = true;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
                options.User.RequireUniqueEmail = false;
            })
            .AddRoles<IdentityRole<Guid>>()
            .AddEntityFrameworkStores<AppDbContext>()
            .AddDefaultTokenProviders();

        services.AddSingleton<IClock, SystemClock>();
        services.AddSingleton<IIdGenerator, GuidIdGenerator>();
        services.AddSingleton<ISystemVersionInfo, ConfiguredSystemVersionInfo>();
        services.AddScoped<IRequestDispatcher, RequestDispatcher>();
        services.AddScoped<EfPersistenceSession>();
        services.AddScoped<ISoftwareProductStore>(provider => provider.GetRequiredService<EfPersistenceSession>());
        services.AddScoped<ISoftwareCatalogReadStore>(provider => provider.GetRequiredService<EfPersistenceSession>());
        services.AddScoped<IKnowledgeSnapshotStore>(provider => provider.GetRequiredService<EfPersistenceSession>());
        services.AddScoped<IKnowledgeFileStore>(provider => provider.GetRequiredService<EfPersistenceSession>());
        services.AddScoped<IPublicationPointerStore>(provider => provider.GetRequiredService<EfPersistenceSession>());
        services.AddScoped<IQueryResultReadStore>(provider => provider.GetRequiredService<EfPersistenceSession>());
        services.AddScoped<IQueryFeedbackStore>(provider => provider.GetRequiredService<EfPersistenceSession>());
        services.AddScoped<IIdempotencyStore>(provider => provider.GetRequiredService<EfPersistenceSession>());
        services.AddScoped<IUnitOfWork>(provider => provider.GetRequiredService<EfPersistenceSession>());
        services.AddScoped<IOutbox>(provider => provider.GetRequiredService<EfPersistenceSession>());
        services.AddScoped<IAuditSink>(provider => provider.GetRequiredService<EfPersistenceSession>());
        services.AddScoped<AiQuery.Application.Features.SoftwareCatalog.ICatalogStore, EfCatalogStore>();
        services.AddScoped<IIdentityProvider, AspNetCoreIdentityProvider>();
        services.AddScoped<IIdentityAccessStore, EfIdentityAccessStore>();
        services.AddScoped<IAuthorizationService, ScopeAuthorizationService>();
        services.AddScoped<IIngestionJobStore, EfIngestionJobStore>();
        services.AddSingleton<IFileObjectStore, FileSystemObjectStore>();
        services.AddScoped<IUploadSecurityScanner, DevelopmentUploadSecurityScanner>();
        services.AddScoped<IAiCoreGateway, DevelopmentAiCoreGateway>();
        services.AddHostedService<AiGatewayStartupValidator>();
        return services;
    }
}
