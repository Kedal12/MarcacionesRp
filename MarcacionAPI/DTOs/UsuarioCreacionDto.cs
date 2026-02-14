using System.ComponentModel.DataAnnotations;

namespace MarcacionAPI.DTOs;

public class UsuarioCreacionDto
{
	[Required]
	[MaxLength(200)]
	public string NombreCompleto { get; set; } = string.Empty;

	[Required]
	[EmailAddress]
	[MaxLength(200)]
	public string Email { get; set; } = string.Empty;

	[Required]
	[MinLength(6)]
	public string Password { get; set; } = string.Empty;

	[MaxLength(50)]
	public string Rol { get; set; } = "Empleado";

	public int IdSede { get; set; }

	[Required]
	public string TipoDocumento { get; set; }

	[Required]
	public string NumeroDocumento { get; set; }
}
