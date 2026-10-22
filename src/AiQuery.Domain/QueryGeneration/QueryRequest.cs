using AiQuery.Domain.Common;

namespace AiQuery.Domain.QueryGeneration;

public enum QueryRequestState { Received, Processing, NeedsClarification, Rejected, Succeeded, Failed }
public enum QueryAttemptState { Running, Succeeded, Failed }

public sealed class QueryAttempt : Entity<QueryAttemptId>
{
    public QueryAttempt(QueryAttemptId id, DateTimeOffset startedAtUtc) : base(id) => StartedAtUtc = startedAtUtc;
    public DateTimeOffset StartedAtUtc { get; }
    public QueryAttemptState State { get; private set; } = QueryAttemptState.Running;
    public string? FailureCode { get; private set; }
    internal void Succeed() { RequireRunning(); State = QueryAttemptState.Succeeded; }
    internal void Fail(string code) { RequireRunning(); FailureCode = code; State = QueryAttemptState.Failed; }
    private void RequireRunning() { if (State != QueryAttemptState.Running) throw new DomainRuleException("query.attempt.closed", "Query attempt is already closed."); }
}

public sealed class QueryResult : Entity<QueryResultId>
{
    public QueryResult(QueryResultId id, QueryAttemptId attemptId, string sql, IReadOnlyList<QueryParameter> parameters, PolicyHash policyHash) : base(id)
    {
        if (string.IsNullOrWhiteSpace(sql)) throw new DomainRuleException("query.sql.empty", "Generated SQL is required.");
        AttemptId = attemptId;
        Sql = sql;
        Parameters = parameters;
        PolicyHash = policyHash;
    }
    public QueryAttemptId AttemptId { get; }
    public string Sql { get; }
    public IReadOnlyList<QueryParameter> Parameters { get; }
    public PolicyHash PolicyHash { get; }
}

public sealed class QueryRequest : AggregateRoot<QueryRequestId>
{
    private readonly List<QueryAttempt> _attempts = [];
    private QueryRequest(QueryRequestId id, UserId actorId, AccessScope scope, string question) : base(id)
    {
        ActorId = actorId;
        Scope = scope;
        Question = question;
    }
    public UserId ActorId { get; }
    public AccessScope Scope { get; }
    public string Question { get; }
    public QueryRequestState State { get; private set; } = QueryRequestState.Received;
    public string? ClarificationPrompt { get; private set; }
    public string? RejectionCode { get; private set; }
    public QueryResult? Result { get; private set; }
    public IReadOnlyList<QueryAttempt> Attempts => _attempts.AsReadOnly();

    public static QueryRequest Create(QueryRequestId id, UserId actorId, AccessScope scope, string question)
    {
        var normalized = question?.Trim() ?? string.Empty;
        if (id.Value == Guid.Empty || actorId.Value == Guid.Empty || normalized.Length is < 2 or > 4000) throw new DomainRuleException("query.request.invalid", "Query request identity, actor and question are required.");
        return new QueryRequest(id, actorId, scope, normalized);
    }
    public QueryAttempt BeginAttempt(QueryAttemptId id, DateTimeOffset atUtc)
    {
        if (State is not (QueryRequestState.Received or QueryRequestState.Failed)) throw new DomainRuleException("query.request.state.invalid", "A new attempt cannot start from the current state.");
        if (_attempts.Any(item => item.Id == id)) throw new DomainRuleException("query.attempt.duplicate", "Attempt identifier must be unique.");
        var attempt = new QueryAttempt(id, atUtc);
        _attempts.Add(attempt);
        State = QueryRequestState.Processing;
        return attempt;
    }
    public void NeedClarification(QueryAttemptId attemptId, string prompt)
    {
        RequiredRunning(attemptId).Fail("clarification_required");
        ClarificationPrompt = string.IsNullOrWhiteSpace(prompt) ? throw new DomainRuleException("query.clarification.empty", "Clarification prompt is required.") : prompt.Trim();
        State = QueryRequestState.NeedsClarification;
    }
    public void Reject(QueryAttemptId attemptId, string code) { RequiredRunning(attemptId).Fail(code); RejectionCode = code; State = QueryRequestState.Rejected; }
    public void Fail(QueryAttemptId attemptId, string code) { RequiredRunning(attemptId).Fail(code); State = QueryRequestState.Failed; }
    public void Succeed(QueryAttemptId attemptId, QueryResult result)
    {
        var attempt = RequiredRunning(attemptId);
        if (result.AttemptId != attemptId) throw new DomainRuleException("query.result.attempt_mismatch", "Result must belong to the running attempt.");
        attempt.Succeed();
        Result = result;
        State = QueryRequestState.Succeeded;
    }
    private QueryAttempt RequiredRunning(QueryAttemptId id) => _attempts.SingleOrDefault(item => item.Id == id && item.State == QueryAttemptState.Running) ?? throw new DomainRuleException("query.attempt.not_running", "Running attempt was not found.");
}

public sealed class QueryFeedback : Entity<FeedbackId>
{
    private QueryFeedback(FeedbackId id, QueryResultId resultId, UserId actorId, bool helpful, string? comment) : base(id)
    { ResultId = resultId; ActorId = actorId; Helpful = helpful; Comment = comment; }
    public QueryResultId ResultId { get; }
    public UserId ActorId { get; }
    public bool Helpful { get; }
    public string? Comment { get; }
    public static QueryFeedback Create(FeedbackId id, QueryResultId existingResultId, UserId authorizedActorId, bool helpful, string? comment)
    {
        if (id.Value == Guid.Empty || existingResultId.Value == Guid.Empty || authorizedActorId.Value == Guid.Empty) throw new DomainRuleException("feedback.reference.invalid", "Feedback requires an existing result and authorized actor.");
        if (comment?.Length > 2000) throw new DomainRuleException("feedback.comment.too_long", "Feedback comment is too long.");
        return new QueryFeedback(id, existingResultId, authorizedActorId, helpful, comment?.Trim());
    }
}
