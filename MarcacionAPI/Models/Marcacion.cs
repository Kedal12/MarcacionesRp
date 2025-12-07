using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MarcacionAPI.Models;

public class Marcacion
{
    [Key]
    public int Id { get; set; }

    [ForeignKey(nameof(Usuario))]
    public int IdUsuario { get; set; }

    public DateTimeOffset FechaHora { get; set; } = DateTimeOffset.UtcNow;

    // Valida "entrada" o "salida" a nivel de servicio/controlador (ver abajo)
    [Required, MaxLength(20)]
    public string Tipo { get; set; } = string.Empty;

    // Fijamos precisión en OnModelCreating
    public decimal LatitudMarcacion { get; set; }

    public decimal LongitudMarcacion { get; set; }

    // ========== NUEVOS CAMPOS PARA ALMUERZO ==========
    /// <summary>
    /// Fecha y hora de inicio del almuerzo (nullable)
    /// </summary>
    public DateTimeOffset? InicioAlmuerzo { get; set; }

    /// <summary>
    /// Fecha y hora de fin del almuerzo (nullable)
    /// </summary>
    public DateTimeOffset? FinAlmuerzo { get; set; }

    /// <summary>
    /// Duración del almuerzo en minutos (calculado automáticamente)
    /// </summary>
    public int? TiempoAlmuerzoMinutos { get; set; }

    // ==================================================

    // ¡Sin new!
    public Usuario? Usuario { get; set; }
}