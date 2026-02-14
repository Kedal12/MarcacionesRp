using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MarcacionAPI.Models;

public class Marcacion
{
    [Key]
    public int Id { get; set; }

    [ForeignKey("Usuario")]
    public int IdUsuario { get; set; }

    public DateTimeOffset FechaHora { get; set; } = DateTimeOffset.UtcNow;

    [Required]
    [MaxLength(20)]
    public string Tipo { get; set; } = string.Empty;

    public decimal LatitudMarcacion { get; set; }

    public decimal LongitudMarcacion { get; set; }

    public DateTimeOffset? InicioAlmuerzo { get; set; }

    public DateTimeOffset? FinAlmuerzo { get; set; }

    public int? TiempoAlmuerzoMinutos { get; set; }

    public Usuario? Usuario { get; set; }

    // Campos para recargos (Ley 2466 de 2025)
    public double? HorasExtraDiurnas { get; set; }

    public double? HorasExtraNocturnas { get; set; }
    public double? HorasRecargoNocturnoOrdinario { get; set; }
    public bool RecargosCalculados { get; set; } = false;

    // NUEVO: Validación biométrica
    public bool ValidadoConBiometria { get; set; } = false;

    public string? DispositivoUsado { get; set; }
}