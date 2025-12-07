using System; // Añadido por si acaso, aunque ya estaba implícito por TimeSpan
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MarcacionAPI.Models;

public class HorarioDetalle
{
    [Key] public int Id { get; set; }

    [ForeignKey(nameof(Horario))]
    public int IdHorario { get; set; }

    // He añadido 'virtual' para consistencia con EF Core
    public virtual Horario Horario { get; set; } = null!;

    /// <summary>1=Lunes ... 7=Domingo</summary>
    [Range(1, 7)]
    public int DiaSemana { get; set; }

    /// <summary>Hora programada (local) de entrada/salida.
    /// Null = hereda del Horario principal.</summary>
    public TimeSpan? HoraEntrada { get; set; }

    public TimeSpan? HoraSalida { get; set; }

    /// <summary>Si es día no laborable, deja HoraEntrada/HoraSalida en null</summary>
    public bool Laborable { get; set; } = true;

    /// <summary>Minutos de tolerancia.
    /// CAMBIO: Ahora es nullable (para heredar del Horario). </summary>
    public int? ToleranciaMin { get; set; } // Modificado de 'int' a 'int?'

    // NUEVO CAMPO (de tu primer archivo)
    /// <summary>Permitir compensación por día.
    /// Null = hereda del Horario principal.</summary>
    public bool? PermitirCompensacion { get; set; }

    // --- Campos que se mantienen (de tu archivo actual) ---

    /// <summary>Redondeo de marcaciones (0 = sin redondeo). Ej: 5, 10, 15</summary>
    public int RedondeoMin { get; set; } = 0;

    /// <summary>Minutos de descanso (para descontar del total si quieres)</summary>
    public int DescansoMin { get; set; } = 0;
}