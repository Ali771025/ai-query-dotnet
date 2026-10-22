namespace AiQuery.Application.Common;

public enum ErrorType
{
    Validation,
    Unauthorized,
    Forbidden,
    NotFound,
    Conflict,
    Concurrency,
    Quota,
    PolicyRejected,
    TransientDependency,
    Timeout,
    Internal
}

public sealed record Error(string Code, string Description, ErrorType Type);
