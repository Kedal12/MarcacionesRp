namespace MarcacionAPI.DTOs.Dashboard;

public record ResumenMensualDto(string NombreCompleto, string Cargo, string Documento, string FechaInicioLaboral, string PeriodoActual, int TotalAusencias, int TotalTardanzas, int TotalDescansosExtendidos, int TotalRetirosTempranos, string Sobretiempo, int TardanzasCompensadas, int TiempoTotalTardanzas);
