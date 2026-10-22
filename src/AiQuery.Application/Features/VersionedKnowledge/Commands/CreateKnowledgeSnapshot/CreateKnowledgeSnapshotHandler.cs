using AiQuery.Application.Common.Interfaces;
using AiQuery.Application.Common;
using AiQuery.Application.Common.Messaging;
using AiQuery.Domain.Common;
using AiQuery.Domain.VersionedKnowledge;

namespace AiQuery.Application.Features.VersionedKnowledge.Commands.CreateKnowledgeSnapshot;

public sealed class CreateKnowledgeSnapshotHandler(IKnowledgeSnapshotStore store, IUnitOfWork unitOfWork, IOutbox outbox, IClock clock) : ICommandHandler<CreateKnowledgeSnapshotCommand, Result<CreateKnowledgeSnapshotResult>>
{
    public async Task<Result<CreateKnowledgeSnapshotResult>> Handle(CreateKnowledgeSnapshotCommand command, CancellationToken cancellationToken)
    {
        if (await store.FindAsync(new KnowledgeSnapshotId(command.SnapshotId), command.Authorization.Scope, cancellationToken) is not null) return Result<CreateKnowledgeSnapshotResult>.Failure(new Error("snapshot.conflict", "Snapshot already exists.", ErrorType.Conflict));
        var snapshot = KnowledgeSnapshot.Create(new KnowledgeSnapshotId(command.SnapshotId), new SoftwareVersionId(command.SoftwareVersionId), new UserId(command.CreatorId), clock.UtcNow);
        await store.AddAsync(snapshot, command.Authorization.Scope, cancellationToken);
        await outbox.EnqueueAsync(snapshot.DomainEvents, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Result<CreateKnowledgeSnapshotResult>.Success(new(snapshot.Id.Value, snapshot.State.ToString(), snapshot.Version));
    }
}
