using AiQuery.Application.Common.Interfaces;

namespace AiQuery.Infrastructure.Services;

public sealed class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}
