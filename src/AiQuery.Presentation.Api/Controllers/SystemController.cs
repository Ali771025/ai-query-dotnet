using AiQuery.Application.Common.Messaging;
using AiQuery.Application.Features.SystemStatus.Queries.GetSystemStatus;
using AiQuery.Contracts.SystemStatus;
using Microsoft.AspNetCore.Mvc;

namespace AiQuery.Presentation.Api.Controllers;

[ApiController]
[Route("api/v1/system")]
public sealed class SystemController(IRequestDispatcher dispatcher) : ControllerBase
{
    [HttpGet("status")]
    [ProducesResponseType<SystemStatusResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<SystemStatusResponse>> GetStatus(CancellationToken cancellationToken)
    {
        var result = await dispatcher.DispatchQuery<GetSystemStatusQuery, SystemStatusResult>(new(), cancellationToken);
        return Ok(new SystemStatusResponse(result.Service, result.Version, result.UtcNow));
    }
}
