using System;

namespace MarcacionAPI.DTOs;

public class ReporteHorasItemDto
{
	public int IdUsuario { get; set; }

	public string Nombre { get; set; } = "";

	public DateOnly Dia { get; set; }

	public DateTimeOffset? PrimeraEntrada { get; set; }

	public DateTimeOffset? UltimaSalida { get; set; }

	public double Horas { get; set; }

	public int MarcacionesIncompletas { get; set; }
}
