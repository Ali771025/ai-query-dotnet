using System.Security.Claims;
using AiQuery.Application.Common.Interfaces;

namespace AiQuery.Presentation.Api.Authentication;

internal sealed class HttpCurrentActor(IHttpContextAccessor accessor) : ICurrentActor
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;
    public string? ActorId => Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
    public string? SessionId => Principal?.FindFirstValue("sid");
    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;
}
