using System;
using System.ComponentModel.DataAnnotations;
using MarcacionAPI.Models; // Para usar TipoCorreccion

namespace MarcacionAPI.DTOs;

// DTO para crear una solicitud de corrección (Empleado)
public record CorreccionCrearDto(
    [Required] DateOnly Fecha,
    [Required] string Tipo, // "entrada" o "salida"
    [Required] TimeSpan HoraSolicitada, // "HH:mm:ss" o "HH:mm"
    [Required][MaxLength(500)] string Motivo
);

// DTO para la respuesta al listar correcciones (Admin)
public record CorreccionListadoDto(
    int Id,
    int IdUsuario,
    string NombreUsuario,
    DateOnly Fecha,
    string Tipo,
    TimeSpan HoraSolicitada,
    string Motivo,
    string Estado,
    DateTimeOffset CreatedAt,
    string? NombreRevisor, // Nombre del admin que revisó
    DateTimeOffset? ReviewedAt
);

// DTO (Query Parameters) para filtrar la lista de correcciones (Admin GET)
public record CorreccionFiltroDto(
    int? IdUsuario,
    int? IdSede,
    DateOnly? Desde, // Rango de Fecha de la corrección
    DateOnly? Hasta,
    string? Estado // pendiente, aprobada, rechazada
                   // Podrías añadir paginación si es necesario (page, pageSize)
);