using AiQuery.Application.Common.Interfaces;
using AiQuery.Application.Common;
using AiQuery.Application.Common.Messaging;
using AiQuery.Domain.Common;

namespace AiQuery.Application.Features.SoftwareCatalog.Queries.ListSoftwareProducts;

public sealed record ListSoftwareProductsQuery(PageRequest Page, AccessScope Scope) : IQuery<PageResult<SoftwareProductListItem>>, IAuthorizedRequest
{
    public AuthorizationRequirement Authorization => new("software.read", Scope);
}

public sealed class ListSoftwareProductsHandler(ISoftwareCatalogReadStore readStore) : IQueryHandler<ListSoftwareProductsQuery, PageResult<SoftwareProductListItem>>
{
    public async Task<PageResult<SoftwareProductListItem>> Handle(ListSoftwareProductsQuery query, CancellationToken cancellationToken) => await readStore.ListAsync(query.Page, query.Scope, cancellationToken);
}

public sealed class ListSoftwareProductsValidator : IValidator<ListSoftwareProductsQuery>
{
    private static readonly HashSet<string> SortFields = ["code", "name", "versionCount", "updatedAt"];
    public IReadOnlyCollection<ValidationFailure> Validate(ListSoftwareProductsQuery value) =>
        SortFields.Contains(value.Page.SortBy)
            ? []
            : [new ValidationFailure("sortBy", "paging.sort.invalid", "Unsupported sort field.")];
}
