namespace AiQuery.Application.Common;

public sealed class ApplicationValidationException(IReadOnlyDictionary<string, string[]> errors)
    : Exception("The application request failed validation.")
{
    public IReadOnlyDictionary<string, string[]> Errors { get; } = errors;
}
