using AiQuery.Domain.Common;

namespace AiQuery.Application.Common.Interfaces;

public interface IIdempotencyStore
{
    ValueTask<T?> GetAsync<T>(string key, CancellationToken cancellationToken) where T : class;
    ValueTask StoreAsync<T>(string key, T value, CancellationToken cancellationToken) where T : class;
}
public interface IOutbox { ValueTask EnqueueAsync(IReadOnlyCollection<IDomainEvent> events, CancellationToken cancellationToken); }
public interface ISecretProvider { ValueTask<string> GetSecretAsync(string secretReference, CancellationToken cancellationToken); }
public interface IUsagePolicy { ValueTask<bool> CanReserveAsync(AccessScope scope, CreditAmount amount, CancellationToken cancellationToken); }
public interface IQuerySigner { ValueTask<string> SignAsync(string canonicalQueryPlan, PolicyHash policyHash, CancellationToken cancellationToken); }
