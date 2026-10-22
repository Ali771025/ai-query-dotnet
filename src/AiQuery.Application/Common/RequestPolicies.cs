using AiQuery.Domain.Common;

namespace AiQuery.Application.Common;

public sealed record AuthorizationRequirement(string Permission, AccessScope Scope);
public enum TransactionIntent { None, Required }
public interface IAuthorizedRequest { AuthorizationRequirement Authorization { get; } }
public interface ITransactionalRequest { TransactionIntent TransactionIntent { get; } }
public interface IIdempotentRequest { string IdempotencyKey { get; } }
