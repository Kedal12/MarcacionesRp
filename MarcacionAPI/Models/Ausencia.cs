using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MarcacionAPI.Models;

public class Ausencia
{
	[Key]
	public int Id { get; set; }

	[Required]
	public int IdUsuario { get; set; }

	[Required]
	[MaxLength(30)]
	public string Tipo { get; set; } = string.Empty;

	[Required]
	public DateOnly Desde { get; set; }

	[Required]
	public DateOnly Hasta { get; set; }

	[MaxLength(500)]
	public string? Observacion { get; set; }

	[Required]
	[MaxLength(20)]
	public string Estado { get; set; } = "pendiente";

	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

	public int? CreatedBy { get; set; }

	public DateTimeOffset? ApprovedAt { get; set; }

	public int? ApprovedBy { get; set; }

	[ForeignKey("IdUsuario")]
	public virtual Usuario? Usuario { get; set; }
}
