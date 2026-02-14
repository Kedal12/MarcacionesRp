using System;

namespace MarcacionAPI.DTOs.Ausencias;

// Se añaden SedeId y SedeNombre al final para no romper llamadas existentes:
public record AusenciaListadoDto(
    int Id,
    int IdUsuario,
    string NombreUsuario,
    string Tipo,
    DateOnly Desde,
    DateOnly Hasta,
    string? Observacion,
    string Estado,
    DateTimeOffset CreatedAt,
    string? NombreAprobador,
    int? SedeId,           // ← NUEVO
    string? SedeNombre     // ← NUEVO
);