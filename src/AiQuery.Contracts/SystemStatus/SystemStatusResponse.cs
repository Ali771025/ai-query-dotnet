namespace AiQuery.Contracts.SystemStatus;

public sealed record SystemStatusResponse(string Service, string Version, DateTimeOffset UtcNow);
