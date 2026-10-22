namespace AiQuery.Application.Common.Interfaces;

public interface IAuditSink
{
    ValueTask WriteAsync(AuditRecord record, CancellationToken cancellationToken = default);
}

public sealed record AuditRecord(
    string EventCode,
    string CorrelationId,
    string? ActorId,
    DateTimeOffset OccurredAtUtc,
    IReadOnlyDictionary<string, string> SafeMetadata);
