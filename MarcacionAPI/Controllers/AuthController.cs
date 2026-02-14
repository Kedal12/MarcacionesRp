using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Runtime.InteropServices;
using MarcacionAPI.Data;
using MarcacionAPI.DTOs;
using MarcacionAPI.Models;
using MarcacionAPI.Services; // ← IMPORTANTE: Agregar este using
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace MarcacionAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthController> _logger;
    private readonly IFaceRecognitionService _faceService; // ← NUEVO

    public AuthController(
        ApplicationDbContext context,
        IConfiguration configuration,
        ILogger<AuthController> logger,
        IFaceRecognitionService faceService) // ← AGREGAR ESTE PARÁMETRO
    {
        _context = context;
        _configuration = configuration;
        _logger = logger;
        _faceService = faceService; // ← NUEVA ASIGNACIÓN
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto loginDto)
    {
        try
        {
            var usuario = await _context.Usuarios
                .Include(u => u.Sede)
                .FirstOrDefaultAsync(u => u.Email == loginDto.Email && u.Activo);

            if (usuario == null || !BCrypt.Net.BCrypt.Verify(loginDto.Password, usuario.PasswordHash))
            {
                await Task.Delay(TimeSpan.FromSeconds(1));
                return Unauthorized(new { mensaje = "Credenciales inválidas" });
            }

            var token = GenerarToken(usuario);

            return Ok(new
            {
                token = token,
                usuario = new
                {
                    usuario.Id,
                    usuario.NombreCompleto,
                    usuario.Email,
                    usuario.Rol,
                    IdSede = usuario.IdSede,
                    NombreSede = usuario.Sede?.Nombre
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en login");
            return StatusCode(500, new { mensaje = "Error interno" });
        }
    }

    [HttpPost("login-mobile")]
    public async Task<IActionResult> LoginMobile([FromBody] LoginMobileDto loginDto)
    {
        try
        {
            var usuario = await _context.Usuarios
                .Include(u => u.Sede)
                .FirstOrDefaultAsync(u => u.NumeroDocumento == loginDto.NumeroDocumento && u.Activo);

            if (usuario == null || !BCrypt.Net.BCrypt.Verify(loginDto.Password, usuario.PasswordHash))
            {
                await Task.Delay(TimeSpan.FromSeconds(1));
                return Unauthorized(new { mensaje = "Credenciales inválidas" });
            }

            var token = GenerarToken(usuario);

            return Ok(new LoginMobileResponseDto(
                token,
                new UsuarioMobileDto(
                    usuario.Id,
                    usuario.NombreCompleto,
                    usuario.Email,
                    usuario.Rol,
                    usuario.NumeroDocumento ?? "",
                    usuario.Sede?.Nombre,
                    usuario.BiometriaHabilitada
                )
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en login mobile");
            return StatusCode(500, new { mensaje = "Error en autenticación" });
        }
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetMe()
    {
        try
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();

            var idUsuario = int.Parse(userIdClaim);

            var usuario = await _context.Usuarios
                .Include(u => u.Sede)
                .FirstOrDefaultAsync(u => u.Id == idUsuario);

            if (usuario == null) return NotFound();

            return Ok(new
            {
                usuario.Id,
                usuario.NombreCompleto,
                usuario.Email,
                usuario.Rol,
                IdSede = usuario.IdSede,
                NombreSede = usuario.Sede?.Nombre,
                usuario.BiometriaHabilitada
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al recuperar perfil");
            return StatusCode(500, new { mensaje = "Error al recuperar perfil" });
        }
    }

    // ============================================================================
    // NUEVOS ENDPOINTS PARA AUTENTICACIÓN FACIAL
    // ============================================================================

    /// <summary>
    /// ENDPOINT 1: Verificar que el documento existe
    /// Paso 1 del login facial
    /// </summary>
    [HttpPost("verificar-documento")]
    public async Task<IActionResult> VerificarDocumento([FromBody] VerificarDocumentoDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.NumeroDocumento))
        {
            return BadRequest(new { mensaje = "Número de documento requerido" });
        }

        try
        {
            var usuario = await _context.Usuarios
                .FirstOrDefaultAsync(u => u.NumeroDocumento == dto.NumeroDocumento && u.Activo);

            if (usuario == null)
            {
                return NotFound(new { mensaje = "Documento no registrado en el sistema" });
            }

            // Verificar que tenga foto o embedding
            if (string.IsNullOrEmpty(usuario.FotoPerfilPath) && usuario.FaceEmbedding == null)
            {
                return BadRequest(new
                {
                    mensaje = "Usuario no tiene foto de perfil registrada. Debe usar login tradicional o contactar al administrador."
                });
            }

            // Si tiene embedding, está listo
            // Si no tiene embedding, verificar que el archivo exista
            if (usuario.FaceEmbedding == null)
            {
                if (!System.IO.File.Exists(usuario.FotoPerfilPath))
                {
                    return BadRequest(new
                    {
                        mensaje = "Archivo de foto de perfil no encontrado. Contacte al administrador."
                    });
                }
            }

            return Ok(new
            {
                mensaje = "Documento verificado correctamente. Proceda con reconocimiento facial.",
                userId = usuario.Id,
                nombreCompleto = usuario.NombreCompleto
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error verificando documento");
            return StatusCode(500, new { mensaje = "Error interno del servidor" });
        }
    }

    /// <summary>
    /// ENDPOINT 2: Login con reconocimiento facial (OPTIMIZADO con embeddings)
    /// Paso 2 del login facial
    /// </summary>
    [HttpPost("login-facial")]
    public async Task<IActionResult> LoginFacial([FromBody] LoginFacialDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.NumeroDocumento) || string.IsNullOrWhiteSpace(dto.FotoBase64))
        {
            return BadRequest(new { mensaje = "Datos incompletos" });
        }

        try
        {
            // 1. Buscar usuario
            var usuario = await _context.Usuarios
                .Include(u => u.Sede)
                .FirstOrDefaultAsync(u => u.NumeroDocumento == dto.NumeroDocumento && u.Activo);

            if (usuario == null)
            {
                return NotFound(new { mensaje = "Usuario no encontrado" });
            }

            // 2. Verificar bloqueo por intentos fallidos (3 intentos en 15 min)
            var intentosFallidos = await _context.LoginLogs
                .Where(l => l.IdUsuario == usuario.Id &&
                            !l.Exitoso &&
                            l.FechaHora > DateTimeOffset.UtcNow.AddMinutes(-15))
                .CountAsync();

            if (intentosFallidos >= 3)
            {
                return StatusCode(429, new
                {
                    mensaje = "Demasiados intentos fallidos. Por favor intente nuevamente en 15 minutos o indique al administrador para registrar marcacion manual."
                });
            }

            // 3. Decodificar imagen capturada
            byte[] imagenCapturada;
            try
            {
                imagenCapturada = Convert.FromBase64String(dto.FotoBase64);
            }
            catch (FormatException)
            {
                return BadRequest(new { mensaje = "Formato de imagen inválido" });
            }

            // 4. Comparar rostros
            FaceComparisonResult resultado;
            var viewFaceService = _faceService as ViewFaceCoreService;

            // ✅ OPTIMIZACIÓN: Si tiene embedding, usar comparación rápida
            if (usuario.FaceEmbedding != null && viewFaceService != null)
            {
                // Convertir byte[] a float[]
                float[] embedding = new float[usuario.FaceEmbedding.Length / sizeof(float)];
                Buffer.BlockCopy(usuario.FaceEmbedding, 0, embedding, 0, usuario.FaceEmbedding.Length);

                // Comparación RÁPIDA (solo procesa foto capturada)
                resultado = await viewFaceService.CompararConEmbedding(embedding, imagenCapturada);
            }
            else
            {
                // Comparación normal (procesa ambas fotos)
                if (string.IsNullOrEmpty(usuario.FotoPerfilPath))
                {
                    return BadRequest(new { mensaje = "Usuario sin foto de perfil registrada" });
                }

                if (!System.IO.File.Exists(usuario.FotoPerfilPath))
                {
                    return BadRequest(new { mensaje = "Archivo de foto de perfil no encontrado" });
                }

                byte[] fotoPerfil = await System.IO.File.ReadAllBytesAsync(usuario.FotoPerfilPath);
                resultado = await _faceService.CompararRostros(fotoPerfil, imagenCapturada);
            }

            // 5. Verificar resultado
            if (!resultado.Match)
            {
                await RegistrarIntentoFallido(usuario.Id, resultado.Confidence);

                return Unauthorized(new
                {
                    mensaje = $"Rostro no coincide (confianza: {resultado.Confidence:P0}). Intente nuevamente o use login tradicional."
                });
            }

            // 6. ✅ Rostro coincide - Generar token
            var token = GenerarToken(usuario);
            await RegistrarLoginExitoso(usuario.Id, resultado.Confidence);

            // 7. Retornar respuesta
            // Asegúrate de que las variables coincidan con lo que el DTO espera
            return Ok(new LoginFacialResponseDto(
                Token: token,
                User: new UsuarioMobileDto(
                    usuario.Id,
                    usuario.NombreCompleto,
                    usuario.Email,
                    usuario.Rol,
                    usuario.NumeroDocumento ?? "",
                    usuario.Sede?.Nombre,
                    usuario.BiometriaHabilitada
                ),
                Confidence: resultado.Confidence
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en login facial");
            return StatusCode(500, new { mensaje = "Error procesando autenticación facial" });
        }
    }

    /// <summary>
    /// ENDPOINT 3: Registrar foto de perfil con embedding
    /// Requiere autenticación
    /// </summary>
    [Authorize]
    [HttpPost("registrar-foto-perfil")]
    public async Task<IActionResult> RegistrarFotoPerfil([FromBody] RegistrarFotoPerfilDto dto)
    {
        // Obtener ID del usuario autenticado
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdClaim))
        {
            return Unauthorized();
        }

        int userId = int.Parse(userIdClaim);
        int targetUserId = userId;

        // Si es admin y especifica otro usuario
        if (dto.IdUsuario.HasValue && dto.IdUsuario.Value > 0)
        {
            var userRole = User.FindFirstValue(ClaimTypes.Role);
            if (userRole != "admin" && userRole != "superadmin")
            {
                return Forbid("No autorizado para registrar foto de otros usuarios");
            }
            targetUserId = dto.IdUsuario.Value;
        }

        var usuario = await _context.Usuarios.FindAsync(targetUserId);
        if (usuario == null)
        {
            return NotFound(new { mensaje = "Usuario no encontrado" });
        }

        try
        {
            // 1. Decodificar imagen
            byte[] imageBytes;
            try
            {
                imageBytes = Convert.FromBase64String(dto.FotoBase64);
            }
            catch (FormatException)
            {
                return BadRequest(new { mensaje = "Formato de imagen inválido" });
            }

            // 2. Validar que contenga un rostro
            var validacion = await _faceService.ValidarRostro(imageBytes);
            if (!validacion.Success)
            {
                return BadRequest(new { mensaje = validacion.Message });
            }

            // 3. ✅ OPTIMIZACIÓN: Generar embedding
            var viewFaceService = _faceService as ViewFaceCoreService;
            if (viewFaceService != null)
            {
                var embedding = await viewFaceService.ObtenerEmbedding(imageBytes);
                if (embedding != null)
                {
                    byte[] embeddingBytes = new byte[embedding.Length * sizeof(float)];
                    Buffer.BlockCopy(embedding, 0, embeddingBytes, 0, embeddingBytes.Length);
                    usuario.FaceEmbedding = embeddingBytes;
                }
            }

            // 4. Crear directorio
            string fotosDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "fotos-perfil");
            Directory.CreateDirectory(fotosDir);

            // 5. Guardar archivo
            string fileName = $"{usuario.NumeroDocumento}_{DateTime.UtcNow:yyyyMMddHHmmss}.jpg";
            string filePath = Path.Combine(fotosDir, fileName);
            await System.IO.File.WriteAllBytesAsync(filePath, imageBytes);

            // 6. Eliminar foto anterior
            if (!string.IsNullOrEmpty(usuario.FotoPerfilPath) &&
                System.IO.File.Exists(usuario.FotoPerfilPath))
            {
                try
                {
                    System.IO.File.Delete(usuario.FotoPerfilPath);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error eliminando foto anterior");
                }
            }

            // 7. Actualizar BD
            usuario.FotoPerfilPath = filePath;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                mensaje = "Foto de perfil registrada exitosamente",
                rutaArchivo = fileName,
                embeddingGuardado = usuario.FaceEmbedding != null
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error registrando foto");
            return StatusCode(500, new { mensaje = "Error guardando foto de perfil" });
        }
    }

    // ============================================================================
    // MÉTODOS AUXILIARES
    // ============================================================================

    private async Task RegistrarLoginExitoso(int userId, double confidence)
    {
        try
        {
            _context.LoginLogs.Add(new LoginLog
            {
                IdUsuario = userId,
                Exitoso = true,
                Confianza = confidence,
                FechaHora = DateTimeOffset.UtcNow
            });
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error registrando login exitoso");
        }
    }

    private async Task RegistrarIntentoFallido(int userId, double confidence)
    {
        try
        {
            _context.LoginLogs.Add(new LoginLog
            {
                IdUsuario = userId,
                Exitoso = false,
                Confianza = confidence,
                FechaHora = DateTimeOffset.UtcNow
            });
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error registrando intento fallido");
        }
    }

    // MÉTODO AUXILIAR UNIFICADO PARA GENERAR TOKENS
    private string GenerarToken(Usuario usuario, int diasExpiracion = 7)
    {
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, usuario.Id.ToString()),
            new Claim(ClaimTypes.Name, usuario.NombreCompleto ?? "Sin Nombre"),
            new Claim(ClaimTypes.Email, usuario.Email ?? "sin@email.com"),
            new Claim(ClaimTypes.Role, usuario.Rol ?? "Usuario")
        };

        if (usuario.IdSede > 0)
            claims.Add(new Claim("SedeId", usuario.IdSede.ToString()));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
            _configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key no configurada")
        ));

        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddDays(diasExpiracion),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}