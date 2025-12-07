using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MarcacionAPI.Models;

// Define los posibles estados de una solicitud de corrección
public static class EstadoCorreccion
{
    public const string Pendiente = "pendiente";
    public const string Aprobada = "aprobada";
    public const string Rechazada = "rechazada";
}

// Define los tipos de corrección (para qué marca aplica)
public static class TipoCorreccion
{
    public const string Entrada = "entrada";
    public const string Salida = "salida";
}

public class Correccion
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int IdUsuario { get; set; } // Usuario que solicita la corrección

    [Required]
    public DateOnly Fecha { get; set; } // El día al que corresponde la corrección

    [Required]
    [MaxLength(10)] // "entrada" o "salida"
    public string Tipo { get; set; } = string.Empty; // Define si corrige una entrada o salida

    [Required]
    [Column(TypeName = "time")] // Guarda solo la hora solicitada
    public TimeSpan HoraSolicitada { get; set; }

    [Required]
    [MaxLength(500)]
    public string Motivo { get; set; } = string.Empty; // Justificación del empleado

    [Required]
    [MaxLength(20)]
    public string Estado { get; set; } = EstadoCorreccion.Pendiente; // Estado inicial

    // Auditoría de la solicitud
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public int? CreatedBy { get; set; } // Normalmente = IdUsuario

    public DateTimeOffset? ReviewedAt { get; set; } // Fecha de revisión (aprobación/rechazo)
    public int? ReviewedBy { get; set; } // ID del Admin que revisó

    // --- Relaciones de Navegación (Opcional) ---
    [ForeignKey(nameof(IdUsuario))]
    public virtual Usuario? Usuario { get; set; }

    // [ForeignKey(nameof(ReviewedBy))]
    // public virtual Usuario? Revisor { get; set; }
}