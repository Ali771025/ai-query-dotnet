using AiQuery.Application.Features.IdentityAccess.DTOs;
using AiQuery.Application.Features.IdentityAccess.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace AiQuery.Infrastructure.Identity;

internal sealed class AspNetCoreIdentityProvider(UserManager<IdentityAccount> userManager) : IIdentityProvider
{
    public async ValueTask<IdentityCredential?> AuthenticateAsync(string username, string password, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var normalized = username?.Trim() ?? string.Empty;
        var account = await userManager.FindByNameAsync(normalized);
        if (account is null || !account.IsActive || account.LockoutEnd > DateTimeOffset.UtcNow)
        {
            return null;
        }

        var valid = await userManager.CheckPasswordAsync(account, password ?? string.Empty);
        if (!valid)
        {
            await userManager.AccessFailedAsync(account);
            return null;
        }

        await userManager.ResetAccessFailedCountAsync(account);
        return new IdentityCredential(account.Id, account.UserName ?? normalized);
    }

    public async ValueTask<Guid> CreateAccountAsync(string username, string? email, string? mobile, string initialPassword, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var account = new IdentityAccount
        {
            Id = Guid.NewGuid(),
            UserName = username.Trim(),
            Email = string.IsNullOrWhiteSpace(email) ? null : email.Trim(),
            PhoneNumber = string.IsNullOrWhiteSpace(mobile) ? null : mobile.Trim(),
            EmailConfirmed = false,
            PhoneNumberConfirmed = false,
            LockoutEnabled = true,
            IsActive = true,
            SecurityStamp = Guid.NewGuid().ToString("N")
        };
        var result = await userManager.CreateAsync(account, initialPassword);
        EnsureSucceeded(result, "identity.account.create_failed");
        return account.Id;
    }

    public async ValueTask UpdateAccountAsync(Guid providerSubject, string username, string? email, string? mobile, bool isActive, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var account = await userManager.FindByIdAsync(providerSubject.ToString())
            ?? throw new InvalidOperationException("Identity account does not exist.");
        account.UserName = username.Trim();
        account.Email = string.IsNullOrWhiteSpace(email) ? null : email.Trim();
        account.PhoneNumber = string.IsNullOrWhiteSpace(mobile) ? null : mobile.Trim();
        account.IsActive = isActive;
        var result = await userManager.UpdateAsync(account);
        EnsureSucceeded(result, "identity.account.update_failed");
        if (!isActive)
        {
            await userManager.UpdateSecurityStampAsync(account);
        }
    }

    public async ValueTask<bool> VerifyPasswordAsync(Guid providerSubject, string password, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var account = await userManager.FindByIdAsync(providerSubject.ToString());
        return account is { IsActive: true } && await userManager.CheckPasswordAsync(account, password ?? string.Empty);
    }

    public async ValueTask<string?> CreatePasswordResetTokenAsync(string identity, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var normalized = identity?.Trim() ?? string.Empty;
        var account = await userManager.FindByNameAsync(normalized) ?? await userManager.FindByEmailAsync(normalized);
        return account is { IsActive: true } ? await userManager.GeneratePasswordResetTokenAsync(account) : null;
    }

    public async ValueTask<bool> ResetPasswordAsync(Guid providerSubject, string token, string newPassword, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var account = await userManager.FindByIdAsync(providerSubject.ToString());
        if (account is null || !account.IsActive)
        {
            return false;
        }

        var result = await userManager.ResetPasswordAsync(account, token, newPassword);
        return result.Succeeded;
    }

    private static void EnsureSucceeded(IdentityResult result, string code)
    {
        if (result.Succeeded)
        {
            return;
        }

        throw new InvalidOperationException($"{code}: {string.Join(',', result.Errors.Select(error => error.Code))}");
    }
}
