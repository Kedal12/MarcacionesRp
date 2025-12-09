using System;
using System.ComponentModel.DataAnnotations;

namespace MarcacionAPI.DTOs.Ausencias;

// DTO para crear una solicitud de ausencia (Empleado)
public class AusenciaCrearDto
{
    /// <summary>
    /// ID del usuario para quien se crea la ausencia.
    /// - Si es null o 0: se crea para el usuario logueado
    /// - Si tiene valor: Admin/SuperAdmin creando para otro usuario
    /// </summary>
    public int? IdUsuario { get; set; }

    [Required(ErrorMessage = "El tipo de ausencia es requerido.")]
    public string Tipo { get; set; } = string.Empty;

    [Required(ErrorMessage = "La fecha 'Desde' es requerida.")]
    public DateOnly Desde { get; set; }

    [Required(ErrorMessage = "La fecha 'Hasta' es requerida.")]
    public DateOnly Hasta { get; set; }

    public string? Observacion { get; set; }
}

// DTO para la respuesta al listar ausencias (Admin)
public record AusenciaListadoDto(
    int Id,
    int IdUsuario,
    string NombreUsuario, // Nombre del empleado
    string Tipo,
    DateOnly Desde,
    DateOnly Hasta,
    string? Observacion,
    string Estado, // pendiente, aprobada, rechazada
    DateTimeOffset CreatedAt,
    string? NombreAprobador // Nombre del admin que aprobó/rechazó
);

// DTO (Query Parameters) para filtrar la lista de ausencias (Admin GET)
public record AusenciaFiltroDto(
    int? IdUsuario,
    int? IdSede, // Filtrar por la sede del usuario
    DateOnly? Desde, // Rango de fechas de la ausencia (solapamiento)
    DateOnly? Hasta,
    string? Estado // pendiente, aprobada, rechazada
                   // Podrías añadir paginación aquí si es necesario (page, pageSize)
);