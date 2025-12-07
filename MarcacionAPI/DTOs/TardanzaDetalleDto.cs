using System;

namespace MarcacionAPI.DTOs;

/// <summary>
/// DTO para representar una tardanza específica.
/// </summary>
public class TardanzaDetalleDto
{
    public DateTime Fecha { get; set; }
    public string DiaSemana { get; set; } = string.Empty;
    public TimeSpan HoraEsperada { get; set; }
    public TimeSpan HoraLlegada { get; set; }
    public TimeSpan MinutosTarde { get; set; }
    public bool Compensada { get; set; }
}