using System.Collections.Generic;
using MarcacionAPI.DTOs;

namespace MarcacionAPI.Services;

public class ResumenCompletoDto
{
	public List<TardanzaDetalleDto> Tardanzas { get; set; } = new List<TardanzaDetalleDto>();

	public int TotalAusencias { get; set; }

	public int TotalRetirosTempranos { get; set; }

	public double TotalSobretiempoMin { get; set; }
}
