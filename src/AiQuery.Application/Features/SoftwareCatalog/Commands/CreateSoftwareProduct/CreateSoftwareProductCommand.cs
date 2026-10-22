using AiQuery.Application.Common;
using AiQuery.Application.Common.Messaging;
using AiQuery.Domain.Common;

namespace AiQuery.Application.Features.SoftwareCatalog.Commands.CreateSoftwareProduct;

public sealed record CreateSoftwareProductCommand(
    Guid ProductId,
    Guid OwnerOrganizationId,
    Guid TenantId,
    string Code,
    string Name,
    string IdempotencyKey,
    string CorrelationId) : ICommand<Result<CreateSoftwareProductResult>>, IAuthorizedRequest, ITransactionalRequest, IIdempotentRequest
{
    public AuthorizationRequirement Authorization => new("software.create", new AccessScope(new TenantId(TenantId), new OrganizationId(OwnerOrganizationId)));
    public TransactionIntent TransactionIntent => TransactionIntent.Required;
}
public sealed record CreateSoftwareProductResult(Guid ProductId, string Code, string Name, long Version);
