using AiQuery.Application.Common;
using AiQuery.Application.Common.Messaging;
using Microsoft.Extensions.DependencyInjection;

namespace AiQuery.Infrastructure.Messaging;

public sealed class RequestDispatcher(IServiceProvider serviceProvider) : IRequestDispatcher
{
    public async Task<TResult> DispatchCommand<TCommand, TResult>(TCommand command, CancellationToken cancellationToken = default)
        where TCommand : ICommand<TResult>
    {
        Validate(command);
        await Authorize(command, cancellationToken);
        return await serviceProvider.GetRequiredService<ICommandHandler<TCommand, TResult>>().Handle(command, cancellationToken);
    }

    public async Task<TResult> DispatchQuery<TQuery, TResult>(TQuery query, CancellationToken cancellationToken = default)
        where TQuery : IQuery<TResult>
    {
        Validate(query);
        await Authorize(query, cancellationToken);
        return await serviceProvider.GetRequiredService<IQueryHandler<TQuery, TResult>>().Handle(query, cancellationToken);
    }

    private void Validate<TRequest>(TRequest request)
    {
        var failures = serviceProvider.GetServices<IValidator<TRequest>>()
            .SelectMany(validator => validator.Validate(request))
            .GroupBy(failure => failure.Field, StringComparer.Ordinal)
            .ToDictionary(
                group => group.Key,
                group => group.Select(failure => failure.Message).Distinct(StringComparer.Ordinal).ToArray(),
                StringComparer.Ordinal);

        if (failures.Count > 0)
        {
            throw new ApplicationValidationException(failures);
        }
    }

    private async ValueTask Authorize<TRequest>(TRequest request, CancellationToken cancellationToken)
    {
        if (request is not IAuthorizedRequest authorizedRequest) return;
        var authorization = serviceProvider.GetRequiredService<AiQuery.Application.Common.Interfaces.IAuthorizationService>();
        if (!await authorization.IsAuthorizedAsync(authorizedRequest.Authorization, cancellationToken))
        {
            throw new ApplicationAuthorizationException("authorization.forbidden", "The current actor is not permitted to perform this operation.");
        }
    }
}
