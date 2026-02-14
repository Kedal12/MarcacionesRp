using System;

namespace MarcacionAPI.DTOs.Horarios;

public class AsignarHorarioDto
{
	public int IdUsuario { get; set; }

	public int IdHorario { get; set; }

	public DateOnly Desde { get; set; }

	public DateOnly? Hasta { get; set; }
}
