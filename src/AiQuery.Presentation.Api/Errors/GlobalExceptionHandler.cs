using AiQuery.Application.Common;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace AiQuery.Presentation.Api.Errors;

public sealed class GlobalExceptionHandler(
    IProblemDetailsService problemDetailsService,
    ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var (status, code, title, detail, errors) = exception switch
        {
            ApplicationAuthenticationException authentication => (
                StatusCodes.Status401Unauthorized,
                authentication.Code,
                "احراز هویت نامعتبر است",
                "نشست یا اطلاعات احراز هویت معتبر نیست.",
                null),
            ApplicationAuthorizationException authorization => (
                StatusCodes.Status403Forbidden,
                authorization.Code,
                "دسترسی مجاز نیست",
                "کاربر در پرسونای فعال مجوز انجام این عملیات را ندارد.",
                null),
            ApplicationConcurrencyException => (
                StatusCodes.Status409Conflict,
                "CONCURRENCY_CONFLICT",
                "تعارض هم‌زمانی",
                "رکورد پس از بارگذاری تغییر کرده است.",
                null),
            ApplicationValidationException validation => (
                StatusCodes.Status422UnprocessableEntity,
                "VALIDATION_FAILED",
                "درخواست معتبر نیست",
                "یک یا چند ورودی نیاز به اصلاح دارد.",
                validation.Errors),
            OperationCanceledException => (
                StatusCodes.Status408RequestTimeout,
                "REQUEST_CANCELLED",
                "زمان درخواست پایان یافت",
                "درخواست لغو شد یا از مهلت مجاز عبور کرد.",
                null),
            _ => (
                StatusCodes.Status500InternalServerError,
                "UNEXPECTED_ERROR",
                "خطای داخلی سامانه",
                "خطای غیرمنتظره رخ داد. شناسه پیگیری را به پشتیبانی اعلام کنید.",
                null)
        };

        logger.Log(
            status >= 500 ? LogLevel.Error : LogLevel.Information,
            exception,
            "Request failed with code {ErrorCode} and correlation {CorrelationId}",
            code,
            httpContext.TraceIdentifier);

        httpContext.Response.StatusCode = status;
        var problem = new ProblemDetails
        {
            Status = status,
            Title = title,
            Detail = detail,
            Type = $"https://errors.aiquery.local/v1/{code.ToLowerInvariant()}",
            Instance = httpContext.Request.Path
        };
        problem.Extensions["code"] = code;
        problem.Extensions["correlationId"] = httpContext.TraceIdentifier;
        problem.Extensions["retryable"] = status >= 500;
        if (errors is not null)
        {
            problem.Extensions["errors"] = errors;
        }

        await problemDetailsService.WriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problem
        });
        return true;
    }
}
