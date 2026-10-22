namespace AiQuery.Domain.Common;

public interface IDomainEvent
{
    DateTimeOffset OccurredAtUtc { get; }
}
