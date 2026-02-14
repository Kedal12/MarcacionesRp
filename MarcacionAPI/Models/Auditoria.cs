using System;
using System.ComponentModel.DataAnnotations;

namespace MarcacionAPI.Models;

public class Auditoria
{
	[Key]
	public int Id { get; set; }

	[Required]
	public DateTimeOffset Fecha { get; set; }

	[Required]
	public int IdUsuarioAdmin { get; set; }

	[Required]
	[MaxLength(50)]
	public string Accion { get; set; } = string.Empty;

	[Required]
	[MaxLength(50)]
	public string Entidad { get; set; } = string.Empty;

	[Required]
	public int EntidadId { get; set; }

	public string? DataJson { get; set; }
}
