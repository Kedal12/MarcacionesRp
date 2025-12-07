namespace MarcacionAPI.DTOs.Sedes;

public class SedeCreateDto
{
    public string Nombre { get; set; } = string.Empty;
    public decimal? Lat { get; set; }
    public decimal? Lon { get; set; }
}