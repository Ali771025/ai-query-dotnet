namespace AiQuery.Application.Common;

public sealed class ApplicationAuthorizationException(string code, string message) : UnauthorizedAccessException(message)
{
    public string Code { get; } = code;
}
