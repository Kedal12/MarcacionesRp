using System;
using System.Collections.Generic;

namespace MarcacionAPI.DTOs.Dashboard;

// --- Respuesta del Endpoint ---
public record DashboardMetricsResponseDto(
    int Presentes,
    int Ausentes,
    int Tarde,
    int SinSalida,
    int MarcacionesHoy,
    List<TardanzaDto> TopTardanzas // Lista de llegadas tarde
);

// DTO para representar una tardanza individual
public record TardanzaDto(
    int IdUsuario,
    string NombreUsuario,
    TimeSpan HoraEntradaProgramada, // Hora teórica de entrada
    DateTimeOffset PrimeraEntradaReal, // Marca real de entrada (UTC)
    double MinutosTarde // Minutos de retraso calculado
);

public record ResumenMensualDto(
    // Información del Usuario
    string NombreCompleto,
    string Cargo,
    string Documento,
    string FechaInicioLaboral,

    // Período
    string PeriodoActual,

    // Estadísticas del mes
    int TotalAusencias,
    int TotalTardanzas,
    int TotalDescansosExtendidos,
    int TotalRetirosTempranos,
    string Sobretiempo,

    // 👇 NUEVOS CAMPOS PARA EL TABLERO
    int TardanzasCompensadas,
    int TiempoTotalTardanzas // minutos NO compensados
);