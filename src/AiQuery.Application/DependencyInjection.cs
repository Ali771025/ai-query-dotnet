using AiQuery.Application.Features.AuditQuality.Commands.SubmitQueryFeedback;
using AiQuery.Application.Common;
using AiQuery.Application.Features.IdentityAccess.Services;
using AiQuery.Application.Common.Messaging;
using AiQuery.Application.Common.Interfaces;
using AiQuery.Application.Features.SoftwareCatalog;
using AiQuery.Application.Features.SoftwareCatalog.Commands.CreateSoftwareProduct;
using AiQuery.Application.Features.SoftwareCatalog.Queries.ListSoftwareProducts;
using AiQuery.Application.Features.SystemStatus.Queries.GetSystemStatus;
using AiQuery.Application.Features.VersionedKnowledge.Commands.CreateKnowledgeSnapshot;
using AiQuery.Application.Features.VersionedKnowledge.Commands.PublishKnowledgeSnapshot;
using AiQuery.Application.Features.VersionedKnowledge.Services;
using Microsoft.Extensions.DependencyInjection;

namespace AiQuery.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IQueryHandler<GetSystemStatusQuery, SystemStatusResult>, GetSystemStatusQueryHandler>();
        services.AddScoped<IdentityAccessUseCases>();
        services.AddScoped<CatalogManagementUseCases>();
        services.AddScoped<ICommandHandler<CreateSoftwareProductCommand, Result<CreateSoftwareProductResult>>, CreateSoftwareProductHandler>();
        services.AddScoped<IValidator<CreateSoftwareProductCommand>, CreateSoftwareProductValidator>();
        services.AddScoped<IQueryHandler<ListSoftwareProductsQuery, PageResult<SoftwareProductListItem>>, ListSoftwareProductsHandler>();
        services.AddScoped<IValidator<ListSoftwareProductsQuery>, ListSoftwareProductsValidator>();
        services.AddScoped<ICommandHandler<CreateKnowledgeSnapshotCommand, Result<CreateKnowledgeSnapshotResult>>, CreateKnowledgeSnapshotHandler>();
        services.AddScoped<IValidator<CreateKnowledgeSnapshotCommand>, CreateKnowledgeSnapshotValidator>();
        services.AddScoped<ICommandHandler<PublishKnowledgeSnapshotCommand, Result<PublishKnowledgeSnapshotResult>>, PublishKnowledgeSnapshotHandler>();
        services.AddScoped<KnowledgeLifecycleUseCases>();
        services.AddScoped<IngestionJobProcessor>();
        services.AddScoped<ICommandHandler<SubmitQueryFeedbackCommand, Result<SubmitQueryFeedbackResult>>, SubmitQueryFeedbackHandler>();
        services.AddScoped<IValidator<SubmitQueryFeedbackCommand>, SubmitQueryFeedbackValidator>();
        return services;
    }
}
