namespace MarcacionAPI.DTOs;

public record UsuarioMobileDto(
    int Id,
    string NombreCompleto,
    string Email,
    string Rol,
    string NumeroDocumento,
    string? SedeNombre,
    bool BiometriaHabilitada  // ✅ Agregar aquí
);