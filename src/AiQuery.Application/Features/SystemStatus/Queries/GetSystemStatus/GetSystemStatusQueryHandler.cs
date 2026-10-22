using AiQuery.Application.Common.Interfaces;
using AiQuery.Application.Common.Messaging;

namespace AiQuery.Application.Features.SystemStatus.Queries.GetSystemStatus;

public sealed class GetSystemStatusQueryHandler(IClock clock, ISystemVersionInfo versionInfo)
    : IQueryHandler<GetSystemStatusQuery, SystemStatusResult>
{
    public Task<SystemStatusResult> Handle(GetSystemStatusQuery query, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return Task.FromResult(new SystemStatusResult(versionInfo.ServiceName, versionInfo.Version, clock.UtcNow));
    }
}
