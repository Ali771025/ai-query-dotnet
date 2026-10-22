using FluentValidation;

namespace AiQuery.Application.Features.SoftwareCatalog;

public sealed class CreateSoftwareValidator : AbstractValidator<CreateSoftware>
{
    public CreateSoftwareValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.OwnerOrganizationId).NotEmpty();
        RuleFor(x => x.Code).NotEmpty().MaximumLength(50).Matches("^[a-zA-Z0-9._-]+$");
        RuleFor(x => x.Name).NotEmpty().Length(2, 200);
    }
}

public sealed class CreateDatabaseValidator : AbstractValidator<CreateDatabase>
{
    public CreateDatabaseValidator()
    {
        RuleFor(x => x.Code).NotEmpty().MaximumLength(100).Matches("^[a-zA-Z0-9._-]+$");
        RuleFor(x => x.Name).NotEmpty().Length(2, 150);
        RuleFor(x => x.Dialect).NotEmpty().MaximumLength(40);
    }
}

public sealed class CreateVersionValidator : AbstractValidator<CreateVersion>
{
    public CreateVersionValidator() => RuleFor(x => x.Label).NotEmpty().MaximumLength(64);
}
