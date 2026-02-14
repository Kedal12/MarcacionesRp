using System;
using System.ComponentModel.DataAnnotations;

namespace MarcacionAPI.Models;

public class Feriado
{
	[Key]
	public DateOnly Fecha { get; set; }

	[Required]
	[MaxLength(120)]
	public string Nombre { get; set; } = string.Empty;

	public bool Laborable { get; set; }
}
