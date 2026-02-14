// ============================================================================
// Modelo: LoginLog
// Ubicación: MarcacionAPI/Models/LoginLog.cs
// ============================================================================

using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MarcacionAPI.Models;

/// <summary>
/// Modelo para registrar intentos de login facial
/// Útil para auditoría y detección de intentos fraudulentos
/// </summary>
public class LoginLog
{
    [Key]
    public int Id { get; set; }
    
    /// <summary>
    /// ID del usuario que intentó hacer login
    /// </summary>
    [Required]
    [ForeignKey("Usuario")]
    public int IdUsuario { get; set; }
    
    /// <summary>
    /// Si el intento de login fue exitoso
    /// </summary>
    [Required]
    public bool Exitoso { get; set; }
    
    /// <summary>
    /// Nivel de confianza de la comparación facial (0.0 a 1.0)
    /// </summary>
    [Required]
    public double Confianza { get; set; }
    
    /// <summary>
    /// Fecha y hora del intento de login
    /// </summary>
    [Required]
    public DateTimeOffset FechaHora { get; set; } = DateTimeOffset.UtcNow;
    
    // Navegación
    public Usuario? Usuario { get; set; }
}
