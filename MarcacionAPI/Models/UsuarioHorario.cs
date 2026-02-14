using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MarcacionAPI.Models;

public class UsuarioHorario
{
	[Key]
	public int Id { get; set; }

	[ForeignKey("Usuario")]
	public int IdUsuario { get; set; }

	public Usuario Usuario { get; set; }

	[ForeignKey("Horario")]
	public int IdHorario { get; set; }

	public Horario Horario { get; set; }

	public DateOnly Desde { get; set; }

	public DateOnly? Hasta { get; set; }
}
