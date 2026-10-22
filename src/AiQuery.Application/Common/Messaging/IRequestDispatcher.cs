namespace AiQuery.Application.Common.Messaging;

public interface IRequestDispatcher
{
    Task<TResult> DispatchCommand<TCommand, TResult>(TCommand command, CancellationToken cancellationToken = default)
        where TCommand : ICommand<TResult>;

    Task<TResult> DispatchQuery<TQuery, TResult>(TQuery query, CancellationToken cancellationToken = default)
        where TQuery : IQuery<TResult>;
}
