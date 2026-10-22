using Microsoft.AspNetCore.Identity;

namespace AiQuery.Infrastructure.Identity;

internal sealed class IdentityAccount : IdentityUser<Guid>
{
    public bool IsActive { get; set; } = true;
}
