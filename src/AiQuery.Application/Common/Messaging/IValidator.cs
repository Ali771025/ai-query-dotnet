namespace AiQuery.Application.Common.Messaging;

public interface IValidator<in TRequest>
{
    IReadOnlyCollection<ValidationFailure> Validate(TRequest request);
}

public sealed record ValidationFailure(string Field, string Code, string Message);
