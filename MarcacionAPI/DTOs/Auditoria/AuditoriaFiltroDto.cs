using System;

namespace MarcacionAPI.DTOs.Auditoria;

public record AuditoriaFiltroDto(int? IdUsuarioAdmin, string? Accion, string? Entidad, int? EntidadId, DateTimeOffset? Desde, DateTimeOffset? Hasta, int Page = 1, int PageSize = 20);
