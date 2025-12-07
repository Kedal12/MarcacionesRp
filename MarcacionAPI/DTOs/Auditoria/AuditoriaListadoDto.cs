using System;
using System.ComponentModel.DataAnnotations;

namespace MarcacionAPI.DTOs.Auditoria;

public record AuditoriaListadoDto(
    int Id,
    DateTimeOffset Fecha,
    int IdUsuarioAdmin,
    string? NombreUsuarioAdmin, // Opcional, requiere Join
    string Accion,
    string Entidad,
    int EntidadId,
    string? DataJson
);

public record AuditoriaFiltroDto(
    int? IdUsuarioAdmin,
    string? Accion,
    string? Entidad,
    int? EntidadId,
    DateTimeOffset? Desde,
    DateTimeOffset? Hasta,
    int Page = 1, // Añadir paginación
    int PageSize = 20
);