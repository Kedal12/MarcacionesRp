using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MarcacionAPI.Models;

public class Horario
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Nombre { get; set; } = string.Empty;

    public bool PermitirCompensacion { get; set; } = true;

    public bool Activo { get; set; } = true;

    // --- Clave foránea a Sede (Ya estaba) ---
    public int? IdSede { get; set; } // Nullable: si es null, es "Global"

    [ForeignKey(nameof(IdSede))]
    public virtual Sede? Sede { get; set; }

    // --- Relaciones ---

    // Relación a los detalles (Ya estaba)
    public virtual ICollection<HorarioDetalle> Detalles { get; set; } = new List<HorarioDetalle>();

    // NUEVA Relación a Usuarios (de tu primer archivo)
    // Asegúrate de tener un modelo 'Usuario' definido
    public virtual ICollection<UsuarioHorario> Asignaciones { get; set; } = new List<UsuarioHorario>();
}