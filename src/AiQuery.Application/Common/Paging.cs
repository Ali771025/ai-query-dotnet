namespace AiQuery.Application.Common;

public enum SortDirection { Ascending, Descending }
public sealed record PageRequest(int PageNumber, int PageSize, string? Filter, string SortBy, SortDirection Direction)
{
    public static PageRequest Create(int pageNumber, int pageSize, string? filter, string sortBy, SortDirection direction)
    {
        if (pageNumber < 1 || pageSize is < 1 or > 200 || string.IsNullOrWhiteSpace(sortBy)) throw new ArgumentOutOfRangeException(nameof(pageNumber), "Page number, size and sort field are invalid.");
        return new PageRequest(pageNumber, pageSize, filter?.Trim(), sortBy.Trim(), direction);
    }
}
public sealed record PageResult<T>(IReadOnlyList<T> Items, int PageNumber, int PageSize, long TotalCount);
