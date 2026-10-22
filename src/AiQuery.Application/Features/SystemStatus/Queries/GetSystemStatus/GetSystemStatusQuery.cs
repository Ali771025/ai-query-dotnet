using AiQuery.Application.Common.Messaging;

namespace AiQuery.Application.Features.SystemStatus.Queries.GetSystemStatus;

public sealed record GetSystemStatusQuery : IQuery<SystemStatusResult>;
public sealed record SystemStatusResult(string Service, string Version, DateTimeOffset UtcNow);
