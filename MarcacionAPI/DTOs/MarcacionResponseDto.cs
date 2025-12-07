// ARCHIVO: DTOs/MarcacionResponseDto.cs
namespace MarcacionAPI.DTOs;

public record MarcacionResponseDto(
    int Id,
    int IdUsuario,

    // --- Campos UTC (para reportes/historial) ---
    DateTimeOffset FechaHora,
    DateTimeOffset? InicioAlmuerzo,
    DateTimeOffset? FinAlmuerzo,

    // --- NUEVOS CAMPOS (para mostrar en la app) ---
    DateTimeOffset FechaHoraLocal,
    DateTimeOffset? InicioAlmuerzoLocal,
    DateTimeOffset? FinAlmuerzoLocal,
    // --- FIN NUEVOS CAMPOS ---

    string Tipo,
    decimal Latitud,
    decimal Longitud,
    int? TiempoAlmuerzoMinutos
);