namespace MarcacionAPI.DTOs;

public class AsistenciaConCompensacionDto
{
    public DateTime Fecha { get; set; }
    public string DiaSemana { get; set; }

    // Horario esperado
    public TimeSpan HoraEntradaEsperada { get; set; }

    public TimeSpan HoraSalidaEsperada { get; set; }

    // Marcaciones reales
    public TimeSpan? HoraEntradaReal { get; set; }

    public TimeSpan? HoraSalidaReal { get; set; }

    // Cálculos
    public TimeSpan MinutosTarde { get; set; }

    public TimeSpan MinutosExtra { get; set; }
    public TimeSpan HorasTrabajadas { get; set; }
    public TimeSpan HorasEsperadas { get; set; }
    public TimeSpan DiferenciaHoras { get; set; }

    // Compensación
    public bool PermiteCompensacion { get; set; }

    public bool TardanzaCompensada { get; set; }
    public TimeSpan TardanzaNeta { get; set; }  // Tardanza después de compensar
    public TimeSpan TiempoExtraNeto { get; set; }  // Extra después de compensar

    // Estado final
    public string Estado { get; set; }  // "PUNTUAL", "TARDE", "COMPENSADO"

    public string Mensaje { get; set; }
}