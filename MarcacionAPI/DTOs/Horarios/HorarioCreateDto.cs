using System.ComponentModel.DataAnnotations;

namespace MarcacionAPI.DTOs.Horarios;

public class HorarioCreateDto
{
	[Required(ErrorMessage = "El nombre es obligatorio.")]
	[MaxLength(100)]
	public string Nombre { get; set; } = string.Empty;

	public bool Activo { get; set; } = true;

	public bool PermitirCompensacion { get; set; } = true;

	public int? IdSede { get; set; }

	[RegularExpression("^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$", ErrorMessage = "Formato de hora inválido. Use HH:mm")]
	public string? HoraEntradaDefault { get; set; }

	[RegularExpression("^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$", ErrorMessage = "Formato de hora inválido. Use HH:mm")]
	public string? HoraSalidaDefault { get; set; }

	public int ToleranciaMinDefault { get; set; } = 5;

	public int DescansoMinDefault { get; set; } = 60;
}
