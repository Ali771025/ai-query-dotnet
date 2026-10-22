using AiQuery.Application.Common.Interfaces;
using AiQuery.Application.Common;

namespace AiQuery.Infrastructure.Services;

public sealed class DenyByDefaultAuthorizationService : IAuthorizationService
{
    public ValueTask<bool> IsAuthorizedAsync(AuthorizationRequirement requirement, CancellationToken cancellationToken) => ValueTask.FromResult(false);
}
