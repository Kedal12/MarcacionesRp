using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MarcacionAPI.Models;

public class Correccion
{
	[Key]
	public int Id { get; set; }

	[Required]
	public int IdUsuario { get; set; }

	[Required]
	public DateOnly Fecha { get; set; }

	[Required]
	[MaxLength(10)]
	public string Tipo { get; set; } = string.Empty;

	[Required]
	[Column(TypeName = "time")]
	public TimeSpan HoraSolicitada { get; set; }

	[Required]
	[MaxLength(500)]
	public string Motivo { get; set; } = string.Empty;

	[Required]
	[MaxLength(20)]
	public string Estado { get; set; } = "pendiente";

	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

	public int? CreatedBy { get; set; }

	public DateTimeOffset? ReviewedAt { get; set; }

	public int? ReviewedBy { get; set; }

	[ForeignKey("IdUsuario")]
	public virtual Usuario? Usuario { get; set; }
}
