using System;
using System.ComponentModel.DataAnnotations;

namespace MarcacionAPI.DTOs.Ausencias;

public class AusenciaCrearDto
{
	public int? IdUsuario { get; set; }

	[Required(ErrorMessage = "El tipo de ausencia es requerido.")]
	public string Tipo { get; set; } = string.Empty;

	[Required(ErrorMessage = "La fecha 'Desde' es requerida.")]
	public DateOnly Desde { get; set; }

	[Required(ErrorMessage = "La fecha 'Hasta' es requerida.")]
	public DateOnly Hasta { get; set; }

	public string? Observacion { get; set; }
}
