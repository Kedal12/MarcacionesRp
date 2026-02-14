using System;

namespace MarcacionAPI.DTOs;

// Se añaden SedeId y SedeNombre al final:
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
    DateTimeOffset? ReviewedAt,
    int? SedeId,           // ← NUEVO
    string? SedeNombre     // ← NUEVO
);