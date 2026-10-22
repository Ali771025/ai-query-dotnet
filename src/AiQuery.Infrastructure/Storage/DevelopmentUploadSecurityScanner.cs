using AiQuery.Application.Features.VersionedKnowledge.Interfaces;
using Microsoft.Extensions.Hosting;

namespace AiQuery.Infrastructure.Storage;

internal sealed class DevelopmentUploadSecurityScanner(IHostEnvironment environment) : IUploadSecurityScanner
{
    public ValueTask<UploadScanResult> ScanAsync(Stream content, string logicalPath, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!environment.IsDevelopment() && !environment.IsEnvironment("Test")) throw new InvalidOperationException("A production antivirus scanner must be configured.");
        return ValueTask.FromResult(new UploadScanResult(true, "development-scanner.clean"));
    }
}
