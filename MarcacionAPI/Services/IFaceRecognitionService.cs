// ============================================================================
// Interfaz: IFaceRecognitionService
// Ubicación: MarcacionAPI/Services/IFaceRecognitionService.cs
// ============================================================================

using System.Threading.Tasks;

namespace MarcacionAPI.Services;

/// <summary>
/// Interfaz para servicios de reconocimiento facial
/// Implementada por ViewFaceCoreService
/// </summary>
public interface IFaceRecognitionService
{
    /// <summary>
    /// Compara dos imágenes directamente (útil para validaciones rápidas).
    /// </summary>
    Task<FaceComparisonResult> CompararRostros(byte[] foto1, byte[] foto2);

    /// <summary>
    /// Valida la calidad de la foto y que exista un solo rostro.
    /// </summary>
    Task<FaceValidationResult> ValidarRostro(byte[] foto);

    /// <summary>
    /// Extrae el vector numérico (embedding) de un rostro para guardarlo en la BD.
    /// </summary>
    Task<float[]?> ObtenerEmbedding(byte[] foto);

    /// <summary>
    /// Compara un rostro capturado contra un embedding guardado en la base de datos.
    /// Este es el método que usarás para la marcación diaria.
    /// </summary>
    Task<FaceComparisonResult> CompararConEmbedding(float[] embeddingGuardado, byte[] fotoCapturada);
}

/// <summary>
/// Resultado de comparación de rostros
/// </summary>
public class FaceComparisonResult
{
    /// <summary>
    /// Indica si los rostros coinciden (true) o no (false)
    /// </summary>
    public bool Match { get; set; }

    /// <summary>
    /// Nivel de confianza/similitud de 0.0 a 1.0
    /// Ejemplo: 0.85 = 85% de similitud
    /// </summary>
    public double Confidence { get; set; }

    /// <summary>
    /// Mensaje descriptivo del resultado
    /// </summary>
    public string Message { get; set; } = string.Empty;
}

/// <summary>
/// Resultado de validación de rostro
/// </summary>
public class FaceValidationResult
{
    /// <summary>
    /// Indica si la validación fue exitosa
    /// </summary>
    public bool Success { get; set; }

    /// <summary>
    /// Mensaje descriptivo del resultado
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Cantidad de rostros detectados en la imagen
    /// </summary>
    public int FacesDetected { get; set; }
}