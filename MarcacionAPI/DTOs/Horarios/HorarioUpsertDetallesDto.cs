using System.Collections.Generic;

namespace MarcacionAPI.DTOs.Horarios;

public class HorarioUpsertDetallesDto
{
	public List<HorarioDetalleDto> Detalles { get; set; } = new List<HorarioDetalleDto>();
}
