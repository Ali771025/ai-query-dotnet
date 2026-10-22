using System.Security.Cryptography;
using System.Text;
using AiQuery.Application.Common.Interfaces;
using Microsoft.Extensions.Hosting;

namespace AiQuery.Infrastructure.Ai;

internal sealed class DevelopmentAiCoreGateway(IHostEnvironment environment) : IAiCoreGateway
{
    public Task<AiCoreHealth> GetHealthAsync(CancellationToken cancellationToken = default)
    {
        EnsureAllowed();
        return Task.FromResult(new AiCoreHealth(true, "development-stub.ready"));
    }

    public Task<IngestionProcessingResult> ProcessSnapshotAsync(IngestionProcessingRequest request, CancellationToken cancellationToken = default)
    {
        EnsureAllowed();
        cancellationToken.ThrowIfCancellationRequested();
        var canonical = $"{request.SnapshotId:N}:{request.ManifestHash}:{string.Join(',', request.Artifacts.OrderBy(item => item.RevisionId).Select(item => item.Sha256))}";
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical))).ToLowerInvariant();
        return Task.FromResult(new IngestionProcessingResult(hash, request.Artifacts.Count));
    }

    private void EnsureAllowed()
    {
        if (!environment.IsDevelopment() && !environment.IsEnvironment("Test")) throw new InvalidOperationException("Development AI gateway cannot run outside Development/Test.");
    }
}
