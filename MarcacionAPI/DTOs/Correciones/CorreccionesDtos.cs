using System;
using System.ComponentModel.DataAnnotations;
using MarcacionAPI.Models;

namespace MarcacionAPI.DTOs;

// DTO para crear una solicitud de corrección
public record CorreccionCrearDto(
    [Required] DateOnly Fecha,
    [Required] string Tipo, // "entrada" o "salida"
    [Required] TimeSpan HoraSolicitada, // "HH:mm:ss"
    [Required][MaxLength(500)] string Motivo,
    int? IdUsuario = null

);

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
    string? NombreRevisor,
    DateTimeOffset? ReviewedAt
);

public record CorreccionFiltroDto(
    int? IdUsuario,
    int? IdSede,
    DateOnly? Desde,
    DateOnly? Hasta,
    string? Estado
);