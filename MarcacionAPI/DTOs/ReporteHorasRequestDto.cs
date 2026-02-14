using System;

namespace MarcacionAPI.DTOs;

public class ReporteHorasRequestDto
{
	public int? IdUsuario { get; set; }

	public int? IdSede { get; set; }

	public DateTimeOffset? Desde { get; set; }

	public DateTimeOffset? Hasta { get; set; }

	public string? NumeroDocumento { get; set; }
}
