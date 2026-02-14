using System.ComponentModel.DataAnnotations;

namespace MarcacionAPI.DTOs.Horarios;

public class HorarioUpdateDto
{
	[Required(ErrorMessage = "El nombre es obligatorio.")]
	[MaxLength(100)]
	public string Nombre { get; set; } = string.Empty;

	public bool Activo { get; set; } = true;

	public bool PermitirCompensacion { get; set; }

	public int? IdSede { get; set; }
}
