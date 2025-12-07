namespace MarcacionAPI.DTOs;

public class UsuarioActualizarDto
{
    public string NombreCompleto { get; set; } = string.Empty;
    public string Rol { get; set; } = "empleado";
    public int IdSede { get; set; }
    public bool Activo { get; set; } = true;
}