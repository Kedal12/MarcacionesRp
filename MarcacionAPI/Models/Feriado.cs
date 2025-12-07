using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MarcacionAPI.Models;

public class Feriado
{
    // Usamos DateOnly porque no nos importa la hora, solo el día.
    // Se mapeará a DATE en SQL Server.
    [Key]
    public DateOnly Fecha { get; set; }

    [Required]
    [MaxLength(120)]
    public string Nombre { get; set; } = string.Empty;

    // Indica si este día, aunque feriado, se considera laborable
    // (ej. algunos festivos que se trabajan). Por defecto es No Laborable.
    public bool Laborable { get; set; } = false;
}