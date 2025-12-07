using System.ComponentModel.DataAnnotations;

namespace MarcacionAPI.Models;

public class Sede
{
    [Key]
    public int Id { get; set; }

    public string Nombre { get; set; } = string.Empty;

    // Coordenadas opcionales de la sede
    public decimal? Lat { get; set; }     // DECIMAL(10,6) recomendado

    public decimal? Lon { get; set; }     // DECIMAL(10,6) recomendado
}