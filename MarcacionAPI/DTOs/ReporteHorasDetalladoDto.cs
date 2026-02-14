namespace MarcacionAPI.DTOs;

public class ReporteHorasDetalladoDto
{
    public int IdUsuario { get; set; }
    public string Nombre { get; set; } = "";
    public DateOnly Dia { get; set; }
    public string? NotaDia { get; set; }
    public DateTimeOffset? PrimeraEntrada { get; set; }
    public DateTimeOffset? UltimaSalida { get; set; }
    public double Horas { get; set; } // Horas Netas
    public int MarcacionesIncompletas { get; set; }
    public double TardanzaMin { get; set; }
    public double SalidaAnticipadaMin { get; set; }

    // Campos para Colombia
    public double HorasExtraDiurnas { get; set; } // HED

    public double HorasExtraNocturnas { get; set; } // HEN
    public double HorasRecargoNocturnoOrdinario { get; set; } // RNO
}