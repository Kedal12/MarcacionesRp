using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MarcacionAPI.Models;

public class HorarioDetalle
{
	[Key]
	public int Id { get; set; }

	[ForeignKey("Horario")]
	public int IdHorario { get; set; }

	public virtual Horario Horario { get; set; }

	[Range(1, 7)]
	public int DiaSemana { get; set; }

	public TimeSpan? HoraEntrada { get; set; }

	public TimeSpan? HoraSalida { get; set; }

	public bool Laborable { get; set; } = true;

	public int? ToleranciaMin { get; set; }

	public bool? PermitirCompensacion { get; set; }

	public int RedondeoMin { get; set; }

	public int DescansoMin { get; set; }
}
