namespace MarcacionAPI.DTOs.Horarios;

public class HorarioDetalleResponseDto
{
	public int Id { get; set; }

	public string Dia { get; set; } = string.Empty;

	public string Desde { get; set; } = string.Empty;

	public string Hasta { get; set; } = string.Empty;

	public string? SedeNombre { get; set; }

	public string? Observacion { get; set; }
}
