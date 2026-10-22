using AiQuery.Application.Common.Messaging;

namespace AiQuery.Application.Features.VersionedKnowledge.Commands.CreateKnowledgeSnapshot;

public sealed class CreateKnowledgeSnapshotValidator : IValidator<CreateKnowledgeSnapshotCommand>
{
    public IReadOnlyCollection<ValidationFailure> Validate(CreateKnowledgeSnapshotCommand value) =>
        new Dictionary<string, Guid>
        {
            [nameof(value.SnapshotId)] = value.SnapshotId,
            [nameof(value.SoftwareVersionId)] = value.SoftwareVersionId,
            [nameof(value.CreatorId)] = value.CreatorId,
            [nameof(value.TenantId)] = value.TenantId,
            [nameof(value.OrganizationId)] = value.OrganizationId,
            [nameof(value.SoftwareId)] = value.SoftwareId
        }.Where(item => item.Value == Guid.Empty).Select(item => new ValidationFailure(item.Key, "identifier.required", $"{item.Key} is required.")).ToArray();
}
