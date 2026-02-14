using System;

namespace MarcacionAPI.DTOs;

public record CorreccionFiltroDto(int? IdUsuario, int? IdSede, DateOnly? Desde, DateOnly? Hasta, string? Estado);
