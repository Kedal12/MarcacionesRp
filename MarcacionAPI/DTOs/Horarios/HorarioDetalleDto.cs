using System;

namespace MarcacionAPI.DTOs.Horarios;

public class HorarioDetalleDto
{
	public int DiaSemana { get; set; }

	public bool Laborable { get; set; } = true;

	public TimeSpan? HoraEntrada { get; set; }

	public TimeSpan? HoraSalida { get; set; }

	public int? ToleranciaMin { get; set; }

	public int RedondeoMin { get; set; }

	public int DescansoMin { get; set; }

	public bool? PermitirCompensacion { get; set; }
}
