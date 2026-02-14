using System.Collections.Generic;

namespace MarcacionAPI.DTOs.Dashboard;

public record DashboardMetricsResponseDto(int Presentes, int Ausentes, int Tarde, int SinSalida, int MarcacionesHoy, List<TardanzaDto> TopTardanzas);
