using System;

namespace MarcacionAPI.DTOs.Ausencias;

public record AusenciaFiltroDto(int? IdUsuario, int? IdSede, DateOnly? Desde, DateOnly? Hasta, string? Estado);
