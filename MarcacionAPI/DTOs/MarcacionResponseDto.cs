using System;

namespace MarcacionAPI.DTOs;

public record MarcacionResponseDto(int Id, int IdUsuario, DateTimeOffset FechaHora, DateTimeOffset? InicioAlmuerzo, DateTimeOffset? FinAlmuerzo, DateTimeOffset FechaHoraLocal, DateTimeOffset? InicioAlmuerzoLocal, DateTimeOffset? FinAlmuerzoLocal, string Tipo, decimal Latitud, decimal Longitud, int? TiempoAlmuerzoMinutos);
