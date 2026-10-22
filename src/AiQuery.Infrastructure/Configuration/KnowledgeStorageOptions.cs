namespace AiQuery.Infrastructure.Configuration;

public sealed class KnowledgeStorageOptions
{
    public const string SectionName = "KnowledgeStorage";
    public string RootPath { get; init; } = "./data/knowledge-objects";
    public string AiGatewayMode { get; init; } = "DevelopmentStub";
}

