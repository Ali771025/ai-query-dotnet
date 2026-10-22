using AiQuery.Application.Features.IdentityAccess.DTOs;

namespace AiQuery.Application.Features.IdentityAccess.Interfaces;

public interface IIdentityProvider
{
    ValueTask<IdentityCredential?> AuthenticateAsync(string username, string password, CancellationToken cancellationToken);
    ValueTask<Guid> CreateAccountAsync(string username, string? email, string? mobile, string initialPassword, CancellationToken cancellationToken);
    ValueTask UpdateAccountAsync(Guid providerSubject, string username, string? email, string? mobile, bool isActive, CancellationToken cancellationToken);
    ValueTask<bool> VerifyPasswordAsync(Guid providerSubject, string password, CancellationToken cancellationToken);
    ValueTask<string?> CreatePasswordResetTokenAsync(string identity, CancellationToken cancellationToken);
    ValueTask<bool> ResetPasswordAsync(Guid providerSubject, string token, string newPassword, CancellationToken cancellationToken);
}
