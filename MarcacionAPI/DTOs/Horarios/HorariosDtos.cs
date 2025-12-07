using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace MarcacionAPI.DTOs.Horarios;

public class HorarioCreateDto
{
    [Required(ErrorMessage = "El nombre es obligatorio.")]
    [MaxLength(100)]
    public string Nombre { get; set; } = string.Empty;

    public bool Activo { get; set; } = true;

    // --- CAMPO DE LA TABLA PADRE ---
    // Este campo SÍ existe en tu tabla Horarios (según tu imagen)
    public bool PermitirCompensacion { get; set; } = true;

    public int? IdSede { get; set; }

    // --- CAMPOS AUXILIARES (Solo para crear los detalles, NO van a la tabla Horarios) ---

    // Recibimos string para facilitar el formato JSON "HH:mm" (ej: "08:00")
    [RegularExpression(@"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$", ErrorMessage = "Formato de hora inválido. Use HH:mm")]
    public string? HoraEntradaDefault { get; set; }

    [RegularExpression(@"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$", ErrorMessage = "Formato de hora inválido. Use HH:mm")]
    public string? HoraSalidaDefault { get; set; }

    public int ToleranciaMinDefault { get; set; } = 5;

    // Opcional: ¿Cuántos minutos de almuerzo por defecto?
    public int DescansoMinDefault { get; set; } = 60;
}

public class HorarioUpdateDto
{
    [Required(ErrorMessage = "El nombre es obligatorio.")]
    [MaxLength(100)]
    public string Nombre { get; set; } = string.Empty;

    public bool Activo { get; set; } = true;

    // Agregado porque existe en la tabla padre
    public bool PermitirCompensacion { get; set; }

    public int? IdSede { get; set; }
}

public class HorarioDetalleDto
{
    /// 1=Lunes ... 7=Domingo
    public int DiaSemana { get; set; }

    public bool Laborable { get; set; } = true;
    public TimeSpan? HoraEntrada { get; set; }
    public TimeSpan? HoraSalida { get; set; }
    public int? ToleranciaMin { get; set; } // Nullable para heredar si quisieras
    public int RedondeoMin { get; set; } = 0;
    public int DescansoMin { get; set; } = 0;

    // Agregado para permitir excepciones por día
    public bool? PermitirCompensacion { get; set; }
}

public class HorarioUpsertDetallesDto
{
    public List<HorarioDetalleDto> Detalles { get; set; } = new();
}

public class AsignarHorarioDto
{
    public int IdUsuario { get; set; }
    public int IdHorario { get; set; }
    public DateOnly Desde { get; set; }
    public DateOnly? Hasta { get; set; }
}

public class HorarioDetalleResponseDto
{
    public int Id { get; set; }
    public string Dia { get; set; } = string.Empty;
    public string Desde { get; set; } = string.Empty;
    public string Hasta { get; set; } = string.Empty;
    public string? SedeNombre { get; set; }
    public string? Observacion { get; set; }
}