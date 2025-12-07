using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MarcacionAPI.Models;

// Define los posibles estados de una solicitud de ausencia
public static class EstadoAusencia
{
    public const string Pendiente = "pendiente";
    public const string Aprobada = "aprobada";
    public const string Rechazada = "rechazada";
}

public class Ausencia
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int IdUsuario { get; set; } // Usuario que solicita la ausencia (Empleado)

    [Required]
    [MaxLength(30)]
    public string Tipo { get; set; } = string.Empty; // Ej: "vacaciones", "enfermedad", "permiso", "licencia_maternidad", "incapacidad"

    [Required]
    public DateOnly Desde { get; set; } // Fecha de inicio (inclusiva)

    [Required]
    public DateOnly Hasta { get; set; } // Fecha de fin (inclusiva)

    [MaxLength(500)]
    public string? Observacion { get; set; } // Motivo o detalles

    [Required]
    [MaxLength(20)]
    public string Estado { get; set; } = EstadoAusencia.Pendiente; // Estado inicial

    // Auditoría de la solicitud
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow; // Fecha de creación (automática)

    public int? CreatedBy { get; set; } // Quién la creó (normalmente = IdUsuario, pero admin podría crearla por otro)

    public DateTimeOffset? ApprovedAt { get; set; } // Fecha de aprobación/rechazo

    public int? ApprovedBy { get; set; } // ID del Admin que aprobó/rechazó

    // --- Relaciones de Navegación (Opcional pero útil) ---
    [ForeignKey(nameof(IdUsuario))]
    public virtual Usuario? Usuario { get; set; } // El empleado ausente

    // Si quieres relacionar quién aprobó/creó con la tabla Usuarios:
    // [ForeignKey(nameof(CreatedBy))]
    // public virtual Usuario? Creador { get; set; }
    // [ForeignKey(nameof(ApprovedBy))]
    // public virtual Usuario? Aprobador { get; set; }
}