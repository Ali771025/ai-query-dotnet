namespace AiQuery.Infrastructure.Configuration;

public sealed class PlatformOptions
{
    public const string SectionName = "Platform";

    public string ServiceName { get; init; } = string.Empty;

    public string Version { get; init; } = string.Empty;

    public int RequestTimeoutSeconds { get; init; }
}
