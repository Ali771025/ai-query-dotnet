using AiQuery.Application;
using AiQuery.Infrastructure;
using AiQuery.Presentation.Api.Extensions;
using AiQuery.Presentation.Api.Middlewares;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddApplication()
    .AddInfrastructure(builder.Configuration)
    .AddPresentation(builder.Configuration);

var app = builder.Build();

app.UseExceptionHandler();
app.UseMiddleware<CorrelationIdMiddleware>();
app.UseRequestTimeouts();
app.UseAuthentication();
app.UseAuthorization();
app.UseSwagger(options => options.RouteTemplate = "openapi/{documentName}.json");

app.MapPlatformHealthChecks();
app.MapControllers();

app.Run();

public partial class Program;
