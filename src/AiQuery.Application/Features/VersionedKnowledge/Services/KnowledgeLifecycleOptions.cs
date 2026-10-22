namespace AiQuery.Application.Features.VersionedKnowledge.Services;

public sealed class KnowledgeLifecycleOptions
{
    public const string SectionName = "Knowledge";
    public long MaxFileSizeBytes { get; init; } = 25 * 1024 * 1024;
    public int MaxFilesPerUpload { get; init; } = 100;
    public long MaxArchiveExpandedBytes { get; init; } = 100 * 1024 * 1024;
    public int MaxArchiveEntries { get; init; } = 500;
    public double MaxCompressionRatio { get; init; } = 100;
    public IReadOnlyCollection<string> AllowedExtensions { get; init; } = [".sql", ".md", ".txt", ".json", ".yaml", ".yml", ".csv", ".pdf", ".zip"];
}

