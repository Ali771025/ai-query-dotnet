namespace AiQuery.Domain.Common;

public abstract class AggregateRoot<TId>(TId id) : Entity<TId>(id)
    where TId : notnull
{
    public long Version { get; private set; }

    protected void RecordEvent(IDomainEvent domainEvent)
    {
        Version++;
        Raise(domainEvent);
    }

    public void EnsureVersion(long expectedVersion)
    {
        if (Version != expectedVersion)
        {
            throw new DomainRuleException("domain.concurrency", $"Expected version {expectedVersion}, but aggregate version is {Version}.");
        }
    }

    protected void RestoreVersion(long version)
    {
        if (version < 0) throw new DomainRuleException("domain.version.invalid", "Aggregate version cannot be negative.");
        Version = version;
    }

    protected void IncrementVersion() => Version++;
}
