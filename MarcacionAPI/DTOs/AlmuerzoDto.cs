using System.ComponentModel.DataAnnotations;

namespace MarcacionAPI.DTOs;

/// <summary>
/// DTO para marcar inicio o fin de almuerzo
/// </summary>
public class AlmuerzoDto
{
    [Range(-90, 90)]
    public decimal Latitud { get; set; }

    [Range(-180, 180)]
    public decimal Longitud { get; set; }
}