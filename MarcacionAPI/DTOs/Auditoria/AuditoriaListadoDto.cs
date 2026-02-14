using System;

namespace MarcacionAPI.DTOs.Auditoria;

public record AuditoriaListadoDto(int Id, DateTimeOffset Fecha, int IdUsuarioAdmin, string? NombreUsuarioAdmin, string Accion, string Entidad, int EntidadId, string? DataJson);
