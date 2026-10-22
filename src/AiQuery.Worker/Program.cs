using AiQuery.Application;
using AiQuery.Infrastructure;
using AiQuery.Worker.Services;

var builder = Host.CreateApplicationBuilder(args);

builder.Services
    .AddApplication()
    .AddInfrastructure(builder.Configuration)
    .AddHostedService<IngestionWorkerService>();

var host = builder.Build();
await host.RunAsync();
