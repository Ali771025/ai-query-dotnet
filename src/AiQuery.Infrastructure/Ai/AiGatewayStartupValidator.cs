using AiQuery.Infrastructure.Configuration;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Hosting;

namespace AiQuery.Infrastructure.Ai;

internal sealed class AiGatewayStartupValidator(IHostEnvironment environment, IOptions<KnowledgeStorageOptions> options) : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        if (!environment.IsDevelopment() && !environment.IsEnvironment("Test") && options.Value.AiGatewayMode.Equals("DevelopmentStub", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("KnowledgeStorage:AiGatewayMode=DevelopmentStub is forbidden outside Development/Test.");
        }
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
