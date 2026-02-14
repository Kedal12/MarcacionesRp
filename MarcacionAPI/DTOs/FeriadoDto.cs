using System.ComponentModel.DataAnnotations;

namespace MarcacionAPI.DTOs;

public class FeriadoDto
{
    [Required]
    public string Nombre { get; set; } = string.Empty;

    public bool Laborable { get; set; }
}