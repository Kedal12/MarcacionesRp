using System.ComponentModel.DataAnnotations;

namespace MarcacionAPI.Models;

public class Auditoria
{
    [Key]
    public int Id { get; set; }

    // Fecha y hora del evento. Se genera automáticamente por la BD.
    [Required]
    public DateTimeOffset Fecha { get; set; }

    // ID del usuario Admin que realizó la acción
    [Required]
    public int IdUsuarioAdmin { get; set; }

    // Descripción de la acción realizada (ej. "usuario.update", "sede.create")
    [Required]
    [MaxLength(50)]
    public string Accion { get; set; } = string.Empty;

    // Nombre de la entidad afectada (ej. "Usuario", "Sede", "Marcacion")
    [Required]
    [MaxLength(50)]
    public string Entidad { get; set; } = string.Empty;

    // ID de la entidad afectada
    [Required]
    public int EntidadId { get; set; }

    // Datos relevantes en formato JSON (opcional)
    public string? DataJson { get; set; }

    // --- Relaciones (Opcional, pero recomendado) ---
    // Si quieres poder navegar desde Auditoria al Usuario admin que realizó la acción:
    // [ForeignKey(nameof(IdUsuarioAdmin))]
    // public virtual Usuario? UsuarioAdmin { get; set; }

    // NOTA: No se recomienda añadir relaciones a Entidad/EntidadId porque
    // puede referirse a diferentes tablas (Usuario, Sede, etc.)
}