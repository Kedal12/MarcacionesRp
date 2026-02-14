using System;

namespace MarcacionAPI.DTOs.Dashboard;

public record TardanzaDto(int IdUsuario, string NombreUsuario, TimeSpan HoraEntradaProgramada, DateTimeOffset PrimeraEntradaReal, double MinutosTarde);
