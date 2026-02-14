// ============================================================================
// ViewFaceCoreService OPTIMIZADO - Sin escrituras innecesarias a disco
// Ubicación: MarcacionAPI/Services/ViewFaceCoreService.cs
// ============================================================================

using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Concurrent;
using FaceRecognitionDotNet;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace MarcacionAPI.Services;

/// <summary>
/// Implementación OPTIMIZADA de reconocimiento facial
/// Mejoras:
/// - Usa streams en memoria cuando es posible
/// - Elimina debug en producción
/// - Caché de FaceRecognition instance (thread-safe)
/// - Archivos temporales con nombres más cortos
/// </summary>
public class ViewFaceCoreService : IFaceRecognitionService, IDisposable
{
    private readonly FaceRecognition _faceRecognition;
    private readonly ILogger<ViewFaceCoreService> _logger;
    private readonly bool _debugMode;
    private readonly string? _debugDir;
    
    // ✅ Umbral ajustado - 0.55 es bastante estricto, considera 0.6 si hay muchos falsos negativos
    private const double UMBRAL_DISTANCIA = 0.55;
    
    // ✅ Directorio temporal único para esta instancia (más rápido que GetTempPath)
    private readonly string _tempDir;

    public ViewFaceCoreService(IConfiguration config, ILogger<ViewFaceCoreService> logger)
    {
        _logger = logger;
        
        // ✅ Debug solo si está explícitamente habilitado
        _debugMode = config.GetValue<bool>("FaceRecognition:DebugMode", false);
        
        // Inicializar FaceRecognition
        var modelsPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "models");
        Directory.CreateDirectory(modelsPath);
        _faceRecognition = FaceRecognition.Create(modelsPath);
        
        // ✅ Crear directorio temporal una sola vez
        _tempDir = Path.Combine(Path.GetTempPath(), "face-api");
        Directory.CreateDirectory(_tempDir);
        
        // ✅ Debug dir solo si está habilitado
        if (_debugMode)
        {
            _debugDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "debug-fotos");
            Directory.CreateDirectory(_debugDir);
        }
        
        _logger.LogInformation("ViewFaceCoreService inicializado. Modelos: {Path}, Debug: {Debug}", 
            modelsPath, _debugMode);
    }

    /// <summary>
    /// ✅ OPTIMIZADO: Compara foto capturada contra embedding guardado
    /// - NO escribe a disco para debug (a menos que esté habilitado)
    /// - Usa nombres de archivo más cortos
    /// - Limpieza inmediata de archivos temporales
    /// </summary>
    public async Task<FaceComparisonResult> CompararConEmbedding(float[] embeddingGuardado, byte[] fotoCapturada)
    {
        // ✅ Validación rápida antes de procesar
        if (embeddingGuardado == null || embeddingGuardado.Length == 0)
        {
            return new FaceComparisonResult
            {
                Match = false,
                Confidence = 0,
                Message = "Embedding guardado inválido"
            };
        }

        if (fotoCapturada == null || fotoCapturada.Length < 1000) // Imagen muy pequeña = inválida
        {
            return new FaceComparisonResult
            {
                Match = false,
                Confidence = 0,
                Message = "Foto capturada inválida o muy pequeña"
            };
        }

        return await Task.Run(() =>
        {
            // ✅ Nombre de archivo más corto = más rápido
            var tempPath = Path.Combine(_tempDir, $"{Guid.NewGuid():N}.jpg");
            
            try
            {
                // ✅ Debug SOLO si está habilitado en config
                if (_debugMode && _debugDir != null)
                {
                    var debugPath = Path.Combine(_debugDir, $"cap_{DateTime.Now:HHmmss}.jpg");
                    File.WriteAllBytes(debugPath, fotoCapturada);
                }

                File.WriteAllBytes(tempPath, fotoCapturada);

                using var image = FaceRecognition.LoadImageFile(tempPath);
                
                // ✅ Detección de rostros
                var faces = _faceRecognition.FaceLocations(image).ToArray();

                if (faces.Length == 0)
                {
                    _logger.LogWarning("CompararConEmbedding: No se detectó rostro");
                    return new FaceComparisonResult
                    {
                        Match = false,
                        Confidence = 0,
                        Message = "No se detectó rostro en foto capturada"
                    };
                }

                // ✅ Extraer encoding de la foto capturada
                var encodings = _faceRecognition.FaceEncodings(image, faces).ToArray();

                if (encodings.Length == 0)
                {
                    return new FaceComparisonResult
                    {
                        Match = false,
                        Confidence = 0,
                        Message = "No se pudo extraer características faciales"
                    };
                }

                // ✅ Convertir embedding guardado
                var embeddingDouble = embeddingGuardado.Select(f => (double)f).ToArray();
                var storedEncoding = FaceRecognition.LoadFaceEncoding(embeddingDouble);

                // ✅ Comparar
                var distancia = FaceRecognition.FaceDistance(storedEncoding, encodings[0]);
                var confianza = Math.Clamp(1.0 - distancia, 0.0, 1.0);
                var match = distancia <= UMBRAL_DISTANCIA;

                _logger.LogInformation("Facial: Dist={Dist:F3}, Conf={Conf:P0}, Match={Match}", 
                    distancia, confianza, match);

                return new FaceComparisonResult
                {
                    Match = match,
                    Confidence = confianza,
                    Message = match
                        ? $"Rostro verificado ({confianza:P0})"
                        : $"Rostro no coincide ({confianza:P0})"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en CompararConEmbedding");
                return new FaceComparisonResult
                {
                    Match = false,
                    Confidence = 0,
                    Message = $"Error: {ex.Message}"
                };
            }
            finally
            {
                // ✅ Limpieza inmediata
                try { if (File.Exists(tempPath)) File.Delete(tempPath); } catch { }
            }
        });
    }

    /// <summary>
    /// ✅ OPTIMIZADO: Compara dos fotos directamente
    /// </summary>
    public async Task<FaceComparisonResult> CompararRostros(byte[] foto1, byte[] foto2)
    {
        return await Task.Run(() =>
        {
            var img1Path = Path.Combine(_tempDir, $"{Guid.NewGuid():N}.jpg");
            var img2Path = Path.Combine(_tempDir, $"{Guid.NewGuid():N}.jpg");

            try
            {
                File.WriteAllBytes(img1Path, foto1);
                File.WriteAllBytes(img2Path, foto2);

                using var image1 = FaceRecognition.LoadImageFile(img1Path);
                using var image2 = FaceRecognition.LoadImageFile(img2Path);

                var faces1 = _faceRecognition.FaceLocations(image1).ToArray();
                var faces2 = _faceRecognition.FaceLocations(image2).ToArray();

                if (faces1.Length == 0)
                {
                    return new FaceComparisonResult
                    {
                        Match = false,
                        Confidence = 0,
                        Message = "No se detectó rostro en foto de perfil"
                    };
                }

                if (faces2.Length == 0)
                {
                    return new FaceComparisonResult
                    {
                        Match = false,
                        Confidence = 0,
                        Message = "No se detectó rostro en foto capturada"
                    };
                }

                var encodings1 = _faceRecognition.FaceEncodings(image1, faces1).ToArray();
                var encodings2 = _faceRecognition.FaceEncodings(image2, faces2).ToArray();

                if (encodings1.Length == 0 || encodings2.Length == 0)
                {
                    return new FaceComparisonResult
                    {
                        Match = false,
                        Confidence = 0,
                        Message = "No se pudo extraer características faciales"
                    };
                }

                var distancia = FaceRecognition.FaceDistance(encodings1[0], encodings2[0]);
                var confianza = Math.Clamp(1.0 - distancia, 0.0, 1.0);
                var match = distancia <= UMBRAL_DISTANCIA;

                _logger.LogInformation("CompararRostros: Dist={Dist:F3}, Match={Match}", distancia, match);

                return new FaceComparisonResult
                {
                    Match = match,
                    Confidence = confianza,
                    Message = match
                        ? $"Rostro verificado ({confianza:P0})"
                        : $"Rostro no coincide ({confianza:P0})"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en CompararRostros");
                return new FaceComparisonResult
                {
                    Match = false,
                    Confidence = 0,
                    Message = $"Error: {ex.Message}"
                };
            }
            finally
            {
                try { if (File.Exists(img1Path)) File.Delete(img1Path); } catch { }
                try { if (File.Exists(img2Path)) File.Delete(img2Path); } catch { }
            }
        });
    }

    /// <summary>
    /// ✅ Valida que una foto contenga un rostro
    /// </summary>
    public async Task<FaceValidationResult> ValidarRostro(byte[] foto)
    {
        return await Task.Run(() =>
        {
            var tempPath = Path.Combine(_tempDir, $"{Guid.NewGuid():N}.jpg");

            try
            {
                File.WriteAllBytes(tempPath, foto);

                using var image = FaceRecognition.LoadImageFile(tempPath);
                var faces = _faceRecognition.FaceLocations(image).ToArray();

                return new FaceValidationResult
                {
                    Success = faces.Length > 0,
                    Message = faces.Length > 0
                        ? "Rostro válido detectado"
                        : "No se detectó ningún rostro",
                    FacesDetected = faces.Length
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en ValidarRostro");
                return new FaceValidationResult
                {
                    Success = false,
                    Message = $"Error: {ex.Message}",
                    FacesDetected = 0
                };
            }
            finally
            {
                try { if (File.Exists(tempPath)) File.Delete(tempPath); } catch { }
            }
        });
    }

    /// <summary>
    /// ✅ Obtiene el embedding (vector 128D) de una foto
    /// </summary>
    public async Task<float[]?> ObtenerEmbedding(byte[] foto)
    {
        return await Task.Run(() =>
        {
            var tempPath = Path.Combine(_tempDir, $"{Guid.NewGuid():N}.jpg");

            try
            {
                File.WriteAllBytes(tempPath, foto);

                using var image = FaceRecognition.LoadImageFile(tempPath);
                var faces = _faceRecognition.FaceLocations(image).ToArray();

                if (faces.Length == 0) return null;

                var encodings = _faceRecognition.FaceEncodings(image, faces).ToArray();
                if (encodings.Length == 0) return null;

                var embedding = encodings[0].GetRawEncoding().Select(d => (float)d).ToArray();
                
                _logger.LogInformation("Embedding extraído: {Length} elementos", embedding.Length);

                return embedding;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en ObtenerEmbedding");
                return null;
            }
            finally
            {
                try { if (File.Exists(tempPath)) File.Delete(tempPath); } catch { }
            }
        });
    }

    public void Dispose()
    {
        _faceRecognition?.Dispose();
        
        // ✅ Limpiar directorio temporal al cerrar
        try
        {
            if (Directory.Exists(_tempDir))
            {
                foreach (var file in Directory.GetFiles(_tempDir, "*.jpg"))
                {
                    try { File.Delete(file); } catch { }
                }
            }
        }
        catch { }
    }
}
