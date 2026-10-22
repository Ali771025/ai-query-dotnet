using AiQuery.Application.Features.VersionedKnowledge.Services;

namespace AiQuery.Worker.Services;

public sealed class IngestionWorkerService(
    IServiceScopeFactory scopeFactory,
    ILogger<IngestionWorkerService> logger) : BackgroundService
{
    private readonly string _workerId = $"{Environment.MachineName}:{Environment.ProcessId}:{Guid.NewGuid():N}";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Durable ingestion worker {WorkerId} started", _workerId);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var processor = scope.ServiceProvider.GetRequiredService<IngestionJobProcessor>();
                var processed = await processor.ProcessNextAsync(_workerId, stoppingToken);
                if (!processed) await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Ingestion worker loop failed; polling will resume");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }
}
