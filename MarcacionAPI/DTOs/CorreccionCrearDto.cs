using System;
using System.ComponentModel.DataAnnotations;

namespace MarcacionAPI.DTOs;

public record CorreccionCrearDto([Required] DateOnly Fecha, [Required] string Tipo, [Required] TimeSpan HoraSolicitada, [Required][MaxLength(500)] string Motivo, int? IdUsuario = null);
