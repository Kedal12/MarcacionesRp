using System;
using System.ComponentModel.DataAnnotations;

namespace MarcacionAPI.DTOs.Ausencias;

// DTO para crear una solicitud de ausencia (Empleado)
public record AusenciaCrearDto(
    [Required] string Tipo, // "vacaciones", "enfermedad", etc.
    [Required] DateOnly Desde,
    [Required] DateOnly Hasta,
    string? Observacion
);

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