using System;

namespace MarcacionAPI.DTOs;

public class AsistenciaConCompensacionDto
{
    public DateTime Fecha { get; set; }
    public string DiaSemana { get; set; } = string.Empty; // ✅ Valor por defecto
    public TimeSpan HoraEntradaEsperada { get; set; }
    public TimeSpan HoraSalidaEsperada { get; set; }
    public TimeSpan? HoraEntradaReal { get; set; }
    public TimeSpan? HoraSalidaReal { get; set; }
    public TimeSpan MinutosTarde { get; set; }
    public TimeSpan MinutosExtra { get; set; }
    public TimeSpan HorasTrabajadas { get; set; }
    public TimeSpan HorasEsperadas { get; set; }
    public TimeSpan DiferenciaHoras { get; set; }
    public bool PermiteCompensacion { get; set; }
    public bool TardanzaCompensada { get; set; }
    public TimeSpan TardanzaNeta { get; set; }
    public TimeSpan TiempoExtraNeto { get; set; }
    public string Estado { get; set; } = string.Empty; // ✅ Valor por defecto
    public string Mensaje { get; set; } = string.Empty; // ✅ Valor por defecto

    // Recargos según Ley 2466 de 2025
    public double HorasExtraDiurnas { get; set; }

    public double HorasExtraNocturnas { get; set; }
    public double HorasRecargoNocturnoOrdinario { get; set; }
    public double TotalRecargos => HorasExtraDiurnas + HorasExtraNocturnas + HorasRecargoNocturnoOrdinario;
}