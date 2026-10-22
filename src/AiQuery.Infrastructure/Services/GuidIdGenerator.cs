using AiQuery.Application.Common.Interfaces;

namespace AiQuery.Infrastructure.Services;

public sealed class GuidIdGenerator : IIdGenerator
{
    public Guid NewId() => Guid.NewGuid();
}
