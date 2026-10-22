namespace AiQuery.Application.Common;

public sealed class ApplicationAuthenticationException(string code, string message) : UnauthorizedAccessException(message)
{
    public string Code { get; } = code;
}
