namespace AiQuery.Infrastructure.Configuration;

public sealed class DatabaseOptions
{
    public const string SectionName = "Database";
    public string ConnectionString { get; init; } = string.Empty;
    public int CommandTimeoutSeconds { get; init; } = 30;
}
