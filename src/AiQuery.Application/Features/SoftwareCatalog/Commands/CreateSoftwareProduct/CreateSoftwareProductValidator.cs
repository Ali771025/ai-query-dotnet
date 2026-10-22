using AiQuery.Application.Common;
using AiQuery.Application.Common.Messaging;

namespace AiQuery.Application.Features.SoftwareCatalog.Commands.CreateSoftwareProduct;

public sealed class CreateSoftwareProductValidator : IValidator<CreateSoftwareProductCommand>
{
    public IReadOnlyCollection<ValidationFailure> Validate(CreateSoftwareProductCommand value)
    {
        var failures = new List<ValidationFailure>();
        if (value.ProductId == Guid.Empty) failures.Add(new(nameof(value.ProductId), "software.product_id.required", "Product identifier is required."));
        if (value.OwnerOrganizationId == Guid.Empty) failures.Add(new(nameof(value.OwnerOrganizationId), "software.owner.required", "Owner organization is required."));
        if (value.TenantId == Guid.Empty) failures.Add(new(nameof(value.TenantId), "tenant.required", "Tenant is required."));
        if (string.IsNullOrWhiteSpace(value.Code)) failures.Add(new(nameof(value.Code), "software.code.required", "Code is required."));
        if (string.IsNullOrWhiteSpace(value.Name)) failures.Add(new(nameof(value.Name), "software.name.required", "Name is required."));
        if (string.IsNullOrWhiteSpace(value.IdempotencyKey)) failures.Add(new(nameof(value.IdempotencyKey), "idempotency.required", "Idempotency key is required."));
        return failures;
    }
}
