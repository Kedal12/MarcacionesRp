using System.ComponentModel.DataAnnotations;

namespace MarcacionAPI.DTOs;

// ============================================================================
// DTOs PARA AUTENTICACIÓN FACIAL
// ============================================================================

/// <summary>
/// DTO para verificar si un documento existe (Paso 1 del login facial)
/// </summary>
public record VerificarDocumentoDto(
    [Required(ErrorMessage = "El número de documento es requerido")]
    [StringLength(20, ErrorMessage = "El número de documento no puede exceder 20 caracteres")]
    string NumeroDocumento
);

/// <summary>
/// DTO para login con reconocimiento facial (Paso 2)
/// </summary>
public record LoginFacialDto(
    [Required(ErrorMessage = "El número de documento es requerido")]
    [StringLength(20, ErrorMessage = "El número de documento no puede exceder 20 caracteres")]
    string NumeroDocumento,
    
    [Required(ErrorMessage = "La foto en base64 es requerida")]
    string FotoBase64
);

/// <summary>
/// DTO para registrar foto de perfil de usuario
/// </summary>
public record RegistrarFotoPerfilDto(
    [Required(ErrorMessage = "La foto en base64 es requerida")]
    string FotoBase64,
    
    /// <summary>
    /// ID del usuario al que se le registrará la foto.
    /// Si es null, se usa el ID del usuario autenticado.
    /// Solo admins pueden especificar otro usuario.
    /// </summary>
    int? IdUsuario = null
);

/// <summary>
/// DTO de respuesta exitosa de login facial
/// </summary>
public record LoginFacialResponseDto(
    [Required] string Token,
    [Required] UsuarioMobileDto User,
    [Range(0.0, 1.0)] double Confidence
);

// ============================================================================
// NOTA: UsuarioMobileDto ya existe en tu proyecto, 
// este DTO de respuesta lo reutiliza
// ============================================================================
