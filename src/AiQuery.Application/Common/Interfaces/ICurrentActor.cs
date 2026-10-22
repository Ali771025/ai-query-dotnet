namespace AiQuery.Application.Common.Interfaces;

public interface ICurrentActor
{
    string? ActorId { get; }
    string? SessionId { get; }
    bool IsAuthenticated { get; }
}
