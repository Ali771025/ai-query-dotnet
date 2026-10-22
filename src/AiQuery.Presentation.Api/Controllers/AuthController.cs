using System.Security.Claims;
using AiQuery.Application.Common;
using AiQuery.Application.Features.IdentityAccess.Services;
using AiQuery.Presentation.Api.Models.Identity;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiQuery.Presentation.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public sealed class AuthController(IdentityAccessUseCases useCases, IAntiforgery antiforgery) : ControllerBase
{
    private const string Scheme = "aiquery.session";

    [AllowAnonymous]
    [HttpGet("csrf")]
    public IActionResult GetCsrfToken()
    {
        var tokens = antiforgery.GetAndStoreTokens(HttpContext);
        return Ok(new { token = tokens.RequestToken });
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(HttpContext);
        var result = await useCases.LoginAsync(new(request.Username, request.Password, HttpContext.TraceIdentifier), cancellationToken);
        if (!result.IsSuccess) return Failure(result.Error!);
        await SignInAsync(result.Value!.Me.UserId, result.Value.SessionId, result.Value.ExpiresAtUtc);
        return Ok(result.Value.Me);
    }

    [Authorize]
    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh(CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(HttpContext);
        var result = await useCases.RefreshAsync(new(HttpContext.TraceIdentifier), cancellationToken);
        if (!result.IsSuccess) return Failure(result.Error!);
        var sessionId = Guid.Parse(User.FindFirstValue("sid")!);
        await SignInAsync(result.Value!.UserId, sessionId, DateTimeOffset.UtcNow.AddHours(8));
        return Ok(result.Value);
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(HttpContext);
        await useCases.LogoutAsync(new(HttpContext.TraceIdentifier), cancellationToken);
        await HttpContext.SignOutAsync(Scheme);
        return NoContent();
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken cancellationToken) => ToResult(await useCases.GetMeAsync(cancellationToken));

    [Authorize]
    [HttpPut("persona")]
    public async Task<IActionResult> SelectPersona(SelectPersonaRequest request, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(HttpContext);
        return ToResult(await useCases.SelectPersonaAsync(new(request.Persona, request.TenantId, request.OrganizationId, request.SoftwareId, HttpContext.TraceIdentifier), cancellationToken));
    }

    [Authorize]
    [HttpPut("active-software")]
    public async Task<IActionResult> SwitchSoftware(SwitchSoftwareRequest request, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(HttpContext);
        return ToResult(await useCases.SwitchSoftwareAsync(new(request.SoftwareId, HttpContext.TraceIdentifier), cancellationToken));
    }

    [AllowAnonymous]
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(HttpContext);
        await useCases.RequestPasswordResetAsync(new(request.Identity, HttpContext.TraceIdentifier), cancellationToken);
        return Accepted(value: new { message = "اگر حساب معتبر باشد، راهنمای بازنشانی ارسال می‌شود." });
    }

    [AllowAnonymous]
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(HttpContext);
        return ToResult(await useCases.ResetPasswordAsync(new(request.UserId, request.Token, request.NewPassword, HttpContext.TraceIdentifier), cancellationToken));
    }

    private Task SignInAsync(Guid userId, Guid sessionId, DateTimeOffset expiresAtUtc) =>
        HttpContext.SignInAsync(
            Scheme,
            new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, userId.ToString()), new Claim("sid", sessionId.ToString())],
                Scheme)),
            new AuthenticationProperties { IsPersistent = false, ExpiresUtc = expiresAtUtc, AllowRefresh = false });

    private IActionResult ToResult<T>(Result<T> result) => result.IsSuccess ? Ok(result.Value) : Failure(result.Error!);

    private ObjectResult Failure(Error error)
    {
        var status = error.Type == ErrorType.Unauthorized
            ? StatusCodes.Status401Unauthorized
            : error.Type == ErrorType.Forbidden
                ? StatusCodes.Status403Forbidden
                : StatusCodes.Status422UnprocessableEntity;
        var details = new ProblemDetails { Status = status, Title = error.Description };
        details.Extensions["code"] = error.Code;
        return new ObjectResult(details) { StatusCode = status };
    }
}
