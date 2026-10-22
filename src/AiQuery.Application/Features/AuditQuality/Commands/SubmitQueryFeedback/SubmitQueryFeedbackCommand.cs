using AiQuery.Application.Common.Interfaces;
using AiQuery.Application.Common;
using AiQuery.Application.Common.Messaging;
using AiQuery.Domain.Common;
using AiQuery.Domain.QueryGeneration;

namespace AiQuery.Application.Features.AuditQuality.Commands.SubmitQueryFeedback;

public sealed record SubmitQueryFeedbackCommand(Guid FeedbackId, Guid QueryResultId, Guid ActorId, AccessScope Scope, bool Helpful, string? Comment, string CorrelationId) : ICommand<Result<SubmitQueryFeedbackResult>>, IAuthorizedRequest, ITransactionalRequest
{
    public AuthorizationRequirement Authorization => new("query.feedback.create", Scope);
    public TransactionIntent TransactionIntent => TransactionIntent.Required;
}
public sealed record SubmitQueryFeedbackResult(Guid FeedbackId);
public interface IQueryFeedbackStore { ValueTask AddAsync(QueryFeedback feedback, CancellationToken cancellationToken); }

public sealed class SubmitQueryFeedbackValidator : IValidator<SubmitQueryFeedbackCommand>
{
    public IReadOnlyCollection<ValidationFailure> Validate(SubmitQueryFeedbackCommand value)
    {
        var failures = new List<ValidationFailure>();
        if (value.FeedbackId == Guid.Empty) failures.Add(new("feedbackId", "feedback.id.required", "Feedback identifier is required."));
        if (value.QueryResultId == Guid.Empty) failures.Add(new("queryResultId", "query.result.required", "Query result identifier is required."));
        if (value.ActorId == Guid.Empty) failures.Add(new("actorId", "actor.required", "Actor identifier is required."));
        if (value.Comment?.Length > 2000) failures.Add(new("comment", "feedback.comment.too_long", "Feedback comment cannot exceed 2000 characters."));
        return failures;
    }
}

public sealed class SubmitQueryFeedbackHandler(IQueryResultReadStore results, IQueryFeedbackStore feedbackStore, IUnitOfWork unitOfWork, IAuditSink audit, IClock clock) : ICommandHandler<SubmitQueryFeedbackCommand, Result<SubmitQueryFeedbackResult>>
{
    public async Task<Result<SubmitQueryFeedbackResult>> Handle(SubmitQueryFeedbackCommand command, CancellationToken cancellationToken)
    {
        var resultId = new QueryResultId(command.QueryResultId);
        var actorId = new UserId(command.ActorId);
        if (!await results.ExistsForActorAsync(resultId, actorId, cancellationToken)) return Result<SubmitQueryFeedbackResult>.Failure(new Error("feedback.result.not_found_or_forbidden", "Query result is not available to the actor.", ErrorType.NotFound));
        var feedback = QueryFeedback.Create(new(command.FeedbackId), resultId, actorId, command.Helpful, command.Comment);
        await feedbackStore.AddAsync(feedback, cancellationToken);
        await audit.WriteAsync(new AuditRecord("query.feedback.submitted", command.CorrelationId, command.ActorId.ToString(), clock.UtcNow, new Dictionary<string, string> { ["resultId"] = command.QueryResultId.ToString() }), cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Result<SubmitQueryFeedbackResult>.Success(new(command.FeedbackId));
    }
}
