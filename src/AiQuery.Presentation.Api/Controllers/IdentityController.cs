using AiQuery.Application.Features.IdentityAccess.DTOs;
using AiQuery.Application.Features.IdentityAccess.Services;
using AiQuery.Presentation.Api.Models.Identity;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiQuery.Presentation.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/identity")]
public sealed class IdentityController(IdentityAccessUseCases useCases, IAntiforgery antiforgery) : ControllerBase
{
    [HttpGet("users")]
    public async Task<IdentityPage<IdentityUserRow>> ListUsers(int page, int pageSize, string? filter, string? sortBy, string? direction, CancellationToken cancellationToken) =>
        await useCases.ListUsersAsync(new(page, pageSize, filter, sortBy ?? "displayName", direction ?? "asc"), cancellationToken);

    [HttpPost("users")]
    public async Task<IdentityUserRow> CreateUser(UserWriteRequest request, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(HttpContext);
        return await useCases.UpsertUserAsync(request.ToCommand(null, HttpContext.TraceIdentifier), cancellationToken);
    }

    [HttpPut("users/{id:guid}")]
    public async Task<IdentityUserRow> UpdateUser(Guid id, UserWriteRequest request, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(HttpContext);
        return await useCases.UpsertUserAsync(request.ToCommand(id, HttpContext.TraceIdentifier), cancellationToken);
    }

    [HttpDelete("users/{id:guid}")]
    public async Task<IActionResult> DeactivateUser(Guid id, long version, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(HttpContext);
        await useCases.DeactivateUserAsync(new(id, version, HttpContext.TraceIdentifier), cancellationToken);
        return NoContent();
    }

    [HttpPost("users/transfer-ownership")]
    public async Task<IActionResult> TransferOwnership(TransferOwnershipRequest request, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(HttpContext);
        await useCases.TransferOwnershipAsync(new(request.TargetUserId, request.CurrentPassword, HttpContext.TraceIdentifier), cancellationToken);
        return NoContent();
    }

    [HttpGet("roles")]
    public async Task<IdentityPage<IdentityRoleRow>> ListRoles(int page, int pageSize, string? filter, string? sortBy, string? direction, CancellationToken cancellationToken) =>
        await useCases.ListRolesAsync(new(page, pageSize, filter, sortBy ?? "name", direction ?? "asc"), cancellationToken);

    [HttpPost("roles")]
    public async Task<IdentityRoleRow> CreateRole(RoleWriteRequest request, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(HttpContext);
        return await useCases.UpsertRoleAsync(request.ToCommand(null, HttpContext.TraceIdentifier), cancellationToken);
    }

    [HttpPut("roles/{id:guid}")]
    public async Task<IdentityRoleRow> UpdateRole(Guid id, RoleWriteRequest request, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(HttpContext);
        return await useCases.UpsertRoleAsync(request.ToCommand(id, HttpContext.TraceIdentifier), cancellationToken);
    }

    [HttpDelete("roles/{id:guid}")]
    public async Task<IActionResult> DeleteRole(Guid id, long version, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(HttpContext);
        await useCases.DeleteRoleAsync(new(id, version, HttpContext.TraceIdentifier), cancellationToken);
        return NoContent();
    }
}
