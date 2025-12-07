using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MarcacionAPI.Models;

public class UsuarioHorario
{
    [Key] public int Id { get; set; }

    [ForeignKey(nameof(Usuario))]
    public int IdUsuario { get; set; }

    public Usuario Usuario { get; set; } = null!;

    [ForeignKey(nameof(Horario))]
    public int IdHorario { get; set; }

    public Horario Horario { get; set; } = null!;

    /// <summary>Vigencia del horario para el usuario</summary>
    public DateOnly Desde { get; set; }

    public DateOnly? Hasta { get; set; } // null = indefinido
}