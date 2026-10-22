using AiQuery.Application.Common.Interfaces;
using AiQuery.Application.Common;
using AiQuery.Application.Common.Messaging;
using AiQuery.Domain.Common;

namespace AiQuery.Application.Features.VersionedKnowledge.Commands.PublishKnowledgeSnapshot;

public sealed class PublishKnowledgeSnapshotHandler(IKnowledgeSnapshotStore snapshots, IPublicationPointerStore pointers, IUnitOfWork unitOfWork, IOutbox outbox, IAuditSink audit, IClock clock) : ICommandHandler<PublishKnowledgeSnapshotCommand, Result<PublishKnowledgeSnapshotResult>>
{
    public async Task<Result<PublishKnowledgeSnapshotResult>> Handle(PublishKnowledgeSnapshotCommand command, CancellationToken cancellationToken)
    {
        var snapshot = await snapshots.FindAsync(new KnowledgeSnapshotId(command.SnapshotId), command.Authorization.Scope, cancellationToken);
        if (snapshot is null) return Result<PublishKnowledgeSnapshotResult>.Failure(new Error("snapshot.not_found", "Snapshot was not found.", ErrorType.NotFound));
        try
        {
            snapshot.EnsureVersion(command.ExpectedSnapshotVersion);
            snapshot.Publish(clock.UtcNow);
            var pointer = await pointers.GetOrCreateAsync(new SoftwareVersionId(command.SoftwareVersionId), command.Authorization.Scope, cancellationToken);
            pointer.MoveTo(snapshot, command.ExpectedPointerVersion, clock.UtcNow);
            await outbox.EnqueueAsync(snapshot.DomainEvents.Concat(pointer.DomainEvents).ToArray(), cancellationToken);
            await audit.WriteAsync(new AuditRecord("knowledge.published", command.CorrelationId, null, clock.UtcNow, new Dictionary<string, string> { ["snapshotId"] = command.SnapshotId.ToString() }), cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);
            return Result<PublishKnowledgeSnapshotResult>.Success(new(snapshot.Id.Value, snapshot.SoftwareVersionId.Value, snapshot.Version, pointer.Version));
        }
        catch (DomainRuleException exception) when (exception.Code == "domain.concurrency")
        {
            return Result<PublishKnowledgeSnapshotResult>.Failure(new Error(exception.Code, exception.Message, ErrorType.Concurrency));
        }
        catch (DomainRuleException exception)
        {
            return Result<PublishKnowledgeSnapshotResult>.Failure(new Error(exception.Code, exception.Message, ErrorType.Conflict));
        }
    }
}
