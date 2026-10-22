using AiQuery.Application.Common;

namespace AiQuery.Application.Common.Interfaces;

public interface IAuthorizationService
{
    ValueTask<bool> IsAuthorizedAsync(AuthorizationRequirement requirement, CancellationToken cancellationToken);
}
