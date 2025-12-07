using System.Security.Claims;

namespace MarcacionAPI.Utils;

// Define los roles exactos que usas en tu base de datos
public static class Roles
{
    public const string SuperAdmin = "superadmin";
    public const string Admin = "admin";
    public const string Empleado = "empleado";
}

public static class ClaimsPrincipalExtensions
{
    /// <summary>
    /// Comprueba si el usuario tiene el rol de SuperAdmin.
    /// </summary>
    public static bool IsSuperAdmin(this ClaimsPrincipal user)
    {
        return user.IsInRole(Roles.SuperAdmin);
    }

    /// <summary>
    /// Obtiene el IdSede guardado en el claim "sede" del token JWT.
    /// </summary>
    public static int? GetSedeId(this ClaimsPrincipal user)
    {
        // Asegúrate que el nombre del Claim ("sede") coincida con el que pones en AuthController
        var sedeIdClaim = user.FindFirst("sede");
        if (sedeIdClaim != null && int.TryParse(sedeIdClaim.Value, out var sedeId))
        {
            return sedeId;
        }
        return null; // No se encontró o es inválido
    }

    /// <summary>
    /// Obtiene el Id (numérico) del usuario del token.
    /// </summary>
    public static int? GetUserId(this ClaimsPrincipal user)
    {
        var idClaim = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (idClaim != null && int.TryParse(idClaim, out var id))
        {
            return id;
        }
        return null;
    }
}