using AiQuery.Application.Common;
using AiQuery.Application.Common.Messaging;
using AiQuery.Domain.Common;

namespace AiQuery.Application.Features.VersionedKnowledge.Commands.PublishKnowledgeSnapshot;

public sealed record PublishKnowledgeSnapshotCommand(Guid SnapshotId, Guid SoftwareVersionId, Guid TenantId, Guid OrganizationId, Guid SoftwareId, long ExpectedSnapshotVersion, long ExpectedPointerVersion, string CorrelationId) : ICommand<Result<PublishKnowledgeSnapshotResult>>, IAuthorizedRequest, ITransactionalRequest
{
    public AuthorizationRequirement Authorization => new("knowledge.publish", new AccessScope(new TenantId(TenantId), new OrganizationId(OrganizationId), new SoftwareProductId(SoftwareId), new SoftwareVersionId(SoftwareVersionId)));
    public TransactionIntent TransactionIntent => TransactionIntent.Required;
}
public sealed record PublishKnowledgeSnapshotResult(Guid SnapshotId, Guid SoftwareVersionId, long SnapshotVersion, long PointerVersion);
