namespace AiQuery.Application.Features.IdentityAccess.Queries;

public sealed record GetMeQuery;
public sealed record ListIdentityUsersQuery(int PageNumber, int PageSize, string? Filter, string SortBy, string Direction);
public sealed record ListRolesQuery(int PageNumber, int PageSize, string? Filter, string SortBy, string Direction);
