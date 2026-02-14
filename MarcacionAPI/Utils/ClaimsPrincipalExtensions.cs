using System.Security.Claims;

namespace MarcacionAPI.Utils;

public static class ClaimsPrincipalExtensions
{
    public static bool IsSuperAdmin(this ClaimsPrincipal user)
    {
        return user.IsInRole("superadmin");
    }

    public static int? GetSedeId(this ClaimsPrincipal user)
    {
        // Cambia "sede" por "SedeId" para que coincida con AuthController
        Claim claim = user.FindFirst("SedeId");
        if (claim != null && int.TryParse(claim.Value, out var result))
        {
            return result;
        }
        return null;
    }

    public static int? GetUserId(this ClaimsPrincipal user)
    {
        string text = user.FindFirstValue("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
        if (text != null && int.TryParse(text, out var result))
        {
            return result;
        }
        return null;
    }
}