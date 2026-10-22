using AiQuery.Application.Common;
using AiQuery.Application.Common.Messaging;
using AiQuery.Domain.Common;

namespace AiQuery.Application.Features.VersionedKnowledge.Commands.CreateKnowledgeSnapshot;

public sealed record CreateKnowledgeSnapshotCommand(Guid SnapshotId, Guid SoftwareVersionId, Guid CreatorId, Guid TenantId, Guid OrganizationId, Guid SoftwareId, string CorrelationId) : ICommand<Result<CreateKnowledgeSnapshotResult>>, IAuthorizedRequest, ITransactionalRequest
{
    public AuthorizationRequirement Authorization => new("knowledge.create", new AccessScope(new TenantId(TenantId), new OrganizationId(OrganizationId), new SoftwareProductId(SoftwareId), new SoftwareVersionId(SoftwareVersionId)));
    public TransactionIntent TransactionIntent => TransactionIntent.Required;
}
public sealed record CreateKnowledgeSnapshotResult(Guid SnapshotId, string State, long Version);
