using AiQuery.Application.Features.IdentityAccess.Commands;
using AiQuery.Application.Features.IdentityAccess.DTOs;
using AiQuery.Application.Features.IdentityAccess.Queries;
using AiQuery.Domain.Common;

namespace AiQuery.Application.Features.IdentityAccess.Interfaces;

public interface IIdentityAccessStore
{
    ValueTask<Guid?> FindProfileIdBySubjectAsync(Guid providerSubject, CancellationToken cancellationToken);
    ValueTask<Guid?> FindProviderSubjectAsync(Guid userId, CancellationToken cancellationToken);
    ValueTask<SessionRecord> CreateSessionAsync(Guid userId, DateTimeOffset expiresAtUtc, CancellationToken cancellationToken);
    ValueTask<SessionRecord?> FindSessionAsync(Guid sessionId, DateTimeOffset now, CancellationToken cancellationToken);
    ValueTask RevokeSessionAsync(Guid sessionId, CancellationToken cancellationToken);
    ValueTask<MeResult?> ResolveMeAsync(Guid sessionId, DateTimeOffset now, CancellationToken cancellationToken);
    ValueTask<bool> SelectPersonaAsync(Guid sessionId, string persona, AccessScope scope, DateTimeOffset now, CancellationToken cancellationToken);
    ValueTask<bool> SwitchSoftwareAsync(Guid sessionId, Guid? softwareId, DateTimeOffset now, CancellationToken cancellationToken);
    ValueTask<bool> IsAuthorizedAsync(Guid sessionId, string permission, AccessScope requestedScope, DateTimeOffset now, CancellationToken cancellationToken);
    ValueTask<IdentityPage<IdentityUserRow>> ListUsersAsync(ListIdentityUsersQuery query, Guid sessionId, DateTimeOffset now, CancellationToken cancellationToken);
    ValueTask<IdentityUserRow> UpsertUserAsync(UpsertIdentityUserCommand command, Guid? providerSubject, Guid sessionId, DateTimeOffset now, CancellationToken cancellationToken);
    ValueTask DeactivateUserAsync(Guid userId, long version, Guid sessionId, DateTimeOffset now, CancellationToken cancellationToken);
    ValueTask TransferPlatformOwnershipAsync(Guid targetUserId, Guid sessionId, DateTimeOffset now, CancellationToken cancellationToken);
    ValueTask<IdentityPage<IdentityRoleRow>> ListRolesAsync(ListRolesQuery query, Guid sessionId, DateTimeOffset now, CancellationToken cancellationToken);
    ValueTask<IdentityRoleRow> UpsertRoleAsync(UpsertRoleCommand command, Guid sessionId, DateTimeOffset now, CancellationToken cancellationToken);
    ValueTask DeleteRoleAsync(Guid roleId, long version, Guid sessionId, DateTimeOffset now, CancellationToken cancellationToken);
}
