namespace MarcacionAPI.DTOs.Dashboard;

public class AusenciaDetalleItemDto
{
	public int Id { get; set; }

	public string Tipo { get; set; } = "";

	public string Desde { get; set; } = "";

	public string Hasta { get; set; } = "";

	public string? Observacion { get; set; }
}
