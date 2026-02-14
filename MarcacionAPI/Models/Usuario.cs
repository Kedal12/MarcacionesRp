using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace MarcacionAPI.Models;

public class Usuario
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string NombreCompleto { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [MaxLength(200)]
    public string Email { get; set; } = string.Empty;

    [JsonIgnore]
    [Required]
    public string PasswordHash { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string Rol { get; set; } = string.Empty;

    [ForeignKey("Sede")]
    public int IdSede { get; set; }

    public bool Activo { get; set; } = true;

    public Sede? Sede { get; set; }

    public string TipoDocumento { get; set; }

    public string NumeroDocumento { get; set; }

    // NUEVO: Control de autenticación biométrica
    public bool BiometriaHabilitada { get; set; } = false;

    public string? FotoPerfilPath { get; set; }
    public byte[]? FaceEmbedding { get; set; }
}