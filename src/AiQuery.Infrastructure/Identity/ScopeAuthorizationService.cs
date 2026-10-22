using AiQuery.Application.Common.Interfaces;
using AiQuery.Application.Common;
using AiQuery.Application.Features.IdentityAccess.Interfaces;

namespace AiQuery.Infrastructure.Identity;

internal sealed class ScopeAuthorizationService(
    ICurrentActor currentActor,
    IIdentityAccessStore store,
    IClock clock) : IAuthorizationService
{
    public ValueTask<bool> IsAuthorizedAsync(AuthorizationRequirement requirement, CancellationToken cancellationToken)
    {
        if (!currentActor.IsAuthenticated || !Guid.TryParse(currentActor.SessionId, out var sessionId))
        {
            return ValueTask.FromResult(false);
        }

        return store.IsAuthorizedAsync(sessionId, requirement.Permission, requirement.Scope, clock.UtcNow, cancellationToken);
    }
}
