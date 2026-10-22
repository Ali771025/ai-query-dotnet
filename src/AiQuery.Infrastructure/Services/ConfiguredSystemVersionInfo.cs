using AiQuery.Application.Common.Interfaces;
using AiQuery.Infrastructure.Configuration;
using Microsoft.Extensions.Options;

namespace AiQuery.Infrastructure.Services;

public sealed class ConfiguredSystemVersionInfo(IOptions<PlatformOptions> options) : ISystemVersionInfo
{
    private readonly PlatformOptions _options = options.Value;
    public string ServiceName => _options.ServiceName;
    public string Version => _options.Version;
}
