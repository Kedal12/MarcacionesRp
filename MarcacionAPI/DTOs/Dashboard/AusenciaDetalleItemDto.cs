namespace MarcacionAPI.DTOs.Dashboard;

public class AusenciaDetalleItemDto
{
    public int Id { get; set; }
    public string Tipo { get; set; } = "";
    public string Desde { get; set; } = ""; // "yyyy-MM-dd"
    public string Hasta { get; set; } = ""; // "yyyy-MM-dd"
    public string? Observacion { get; set; }
}