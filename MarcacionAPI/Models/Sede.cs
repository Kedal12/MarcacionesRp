using System.ComponentModel.DataAnnotations;

namespace MarcacionAPI.Models;

public class Sede
{
	[Key]
	public int Id { get; set; }

	public string Nombre { get; set; } = string.Empty;

	public decimal? Lat { get; set; }

	public decimal? Lon { get; set; }
}
