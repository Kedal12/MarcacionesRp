namespace MarcacionAPI.DTOs;

public class UsuarioListadoDto
{
    public int Id { get; set; }
    public string NombreCompleto { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Rol { get; set; } = string.Empty;
    public int IdSede { get; set; }
    public string? SedeNombre { get; set; }
    public bool Activo { get; set; }
}