using System.ComponentModel.DataAnnotations;

namespace MarcacionAPI.DTOs;

public class UsuarioCrearDto
{
    [Required, StringLength(150)] public string NombreCompleto { get; set; } = string.Empty;
    [Required, EmailAddress] public string Email { get; set; } = string.Empty;
    [Required, MinLength(6)] public string Password { get; set; } = string.Empty;
    [Required, RegularExpression("^(empleado|admin)$")] public string Rol { get; set; } = "empleado"; // empleado | admin
    [Range(1, int.MaxValue)] public int IdSede { get; set; }
}