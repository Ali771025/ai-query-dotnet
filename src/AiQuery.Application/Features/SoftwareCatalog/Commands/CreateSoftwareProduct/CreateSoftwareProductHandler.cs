using AiQuery.Application.Common.Interfaces;
using AiQuery.Application.Common;
using AiQuery.Application.Common.Messaging;
using AiQuery.Domain.Common;
using AiQuery.Domain.SoftwareCatalog;

namespace AiQuery.Application.Features.SoftwareCatalog.Commands.CreateSoftwareProduct;

public sealed class CreateSoftwareProductHandler(ISoftwareProductStore store, IIdempotencyStore idempotency, IUnitOfWork unitOfWork, IOutbox outbox, IAuditSink audit, IClock clock) : ICommandHandler<CreateSoftwareProductCommand, Result<CreateSoftwareProductResult>>
{
    public async Task<Result<CreateSoftwareProductResult>> Handle(CreateSoftwareProductCommand command, CancellationToken cancellationToken)
    {
        var cached = await idempotency.GetAsync<CreateSoftwareProductResult>(command.IdempotencyKey, cancellationToken);
        if (cached is not null) return Result<CreateSoftwareProductResult>.Success(cached);
        var code = SoftwareCode.Create(command.Code);
        var ownerId = new OrganizationId(command.OwnerOrganizationId);
        if (await store.CodeExistsAsync(new TenantId(command.TenantId), ownerId, code, cancellationToken)) return Result<CreateSoftwareProductResult>.Failure(new Error("software.code.conflict", "Software code already exists in the organization.", ErrorType.Conflict));
        var product = SoftwareProduct.Create(new SoftwareProductId(command.ProductId), ownerId, code, command.Name, clock.UtcNow);
        await store.AddAsync(product, command.Authorization.Scope, cancellationToken);
        await outbox.EnqueueAsync(product.DomainEvents, cancellationToken);
        var result = new CreateSoftwareProductResult(product.Id.Value, product.Code.Value, product.Name, product.Version);
        await idempotency.StoreAsync(command.IdempotencyKey, result, cancellationToken);
        await audit.WriteAsync(new AuditRecord("software.created", command.CorrelationId, null, clock.UtcNow, new Dictionary<string, string> { ["softwareId"] = product.Id.Value.ToString() }), cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Result<CreateSoftwareProductResult>.Success(result);
    }
}
