using MarcacionAPI.Data;
using MarcacionAPI.DTOs;
using MarcacionAPI.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.RateLimiting;
using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace MarcacionAPI.Controllers;

// --- DTOs ---
public record LoginDto(
    [Required] string Email,
    [Required] string Password
);

// ✅ NUEVO: DTO para login móvil
public record LoginMobileDto(
    [Required] string NumeroDocumento
);

public record ChangePasswordDto(
    [Required] string CurrentPassword,
    [Required, MinLength(6)] string NewPassword
);

public record LoginResponseDto(string Token);

// ✅ NUEVO: Response extendido para mobile
public record LoginMobileResponseDto(
    string Token,
    UsuarioMobileDto Usuario
);

public record UsuarioMobileDto(
    int Id,
    string NombreCompleto,
    string Email,
    string Rol,
    string NumeroDocumento,
    string? SedeNombre
);
// --- Fin DTOs ---

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;

    public AuthController(ApplicationDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    /// <summary>
    /// Devuelve la hora actual del servidor en UTC.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("time")]
    public IActionResult GetServerTime() => Ok(DateTimeOffset.UtcNow);

    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
    {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(idStr) || !int.TryParse(idStr, out var id))
            return Unauthorized("Token inválido o faltante.");

        var u = await _context.Usuarios.FirstOrDefaultAsync(x => x.Id == id && x.Activo);
        if (u is null) return Unauthorized("Usuario no encontrado o inactivo.");

        if (!BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, u.PasswordHash))
        {
            await Task.Delay(TimeSpan.FromSeconds(1));
            return BadRequest("Contraseña actual incorrecta.");
        }

        if (dto.NewPassword.Length < 6)
            return BadRequest("La nueva contraseña es muy corta (mínimo 6 caracteres).");

        u.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(idStr) || !int.TryParse(idStr, out var idUsuario))
            return Unauthorized();

        var user = await _context.Usuarios.AsNoTracking()
                             .Include(u => u.Sede)
                             .Where(u => u.Id == idUsuario)
                             .Select(u => new
                             {
                                 u.Id,
                                 u.Email,
                                 u.Rol,
                                 u.NombreCompleto,
                                 u.IdSede,
                                 SedeNombre = u.Sede != null ? u.Sede.Nombre : null
                             })
                             .FirstOrDefaultAsync();

        if (user == null) return NotFound("Usuario no encontrado.");

        return Ok(new
        {
            id = user.Id.ToString(),
            email = user.Email,
            rol = user.Rol,
            nombreCompleto = user.NombreCompleto,
            idSede = user.IdSede,
            sedeNombre = user.SedeNombre
        });
    }

    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] UsuarioCreacionDto usuarioDto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var emailNormalizado = usuarioDto.Email.Trim().ToLowerInvariant();
        var emailExiste = await _context.Usuarios.AnyAsync(u => u.Email == emailNormalizado);
        if (emailExiste) return Conflict("El email ya está registrado.");

        var rolNormalizado = string.IsNullOrWhiteSpace(usuarioDto.Rol)
            ? "empleado"
            : usuarioDto.Rol.Trim().ToLowerInvariant();

        if (rolNormalizado is not ("empleado" or "admin" or "superadmin"))
            return BadRequest("Rol inválido. Debe ser 'empleado', 'admin' o 'superadmin'.");

        var idSede = usuarioDto.IdSede > 0 ? usuarioDto.IdSede : 1;
        var sede = await _context.Sedes.FindAsync(idSede);
        if (sede is null) return BadRequest($"La sede {idSede} no existe.");

        var nuevoUsuario = new Usuario
        {
            NombreCompleto = usuarioDto.NombreCompleto.Trim(),
            Email = emailNormalizado,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(usuarioDto.Password),
            Rol = rolNormalizado,
            IdSede = idSede,
            TipoDocumento = usuarioDto.TipoDocumento,
            NumeroDocumento = usuarioDto.NumeroDocumento,
            Activo = true
        };

        await _context.Usuarios.AddAsync(nuevoUsuario);
        await _context.SaveChangesAsync();
        return StatusCode(201, new { mensaje = "Usuario creado exitosamente.", id = nuevoUsuario.Id });
    }

    /// <summary>
    /// Login tradicional con email y contraseña (para web/admin)
    /// </summary>
    [AllowAnonymous]
    [HttpPost("login")]
    [EnableRateLimiting("loginPolicy")]
    public async Task<ActionResult<LoginResponseDto>> Login([FromBody] LoginDto loginDto)
    {
        var email = loginDto.Email.Trim().ToLowerInvariant();

        var user = await _context.Usuarios
            .AsNoTracking()
            .Where(u => u.Email == email && u.Activo)
            .Select(u => new
            {
                u.Id,
                u.NombreCompleto,
                u.Email,
                u.PasswordHash,
                u.Rol,
                u.IdSede
            })
            .SingleOrDefaultAsync();

        if (user == null || !BCrypt.Net.BCrypt.Verify(loginDto.Password, user.PasswordHash))
        {
            await Task.Delay(TimeSpan.FromSeconds(1));
            return Unauthorized("Credenciales inválidas.");
        }

        var token = GenerarJwtToken(
            id: user.Id,
            email: user.Email,
            rol: user.Rol,
            idSede: user.IdSede,
            nombreCompleto: user.NombreCompleto
        );

        return Ok(new LoginResponseDto(token));
    }

    /// <summary>
    /// ✅ NUEVO: Login móvil solo con número de documento (para empleados)
    /// </summary>
    [AllowAnonymous]
    [HttpPost("login-mobile")]
    [EnableRateLimiting("loginPolicy")]
    public async Task<ActionResult<LoginMobileResponseDto>> LoginMobile([FromBody] LoginMobileDto loginDto)
    {
        if (string.IsNullOrWhiteSpace(loginDto.NumeroDocumento))
            return BadRequest("El número de documento es requerido.");

        var documento = loginDto.NumeroDocumento.Trim();

        var user = await _context.Usuarios
            .AsNoTracking()
            .Include(u => u.Sede)
            .Where(u => u.NumeroDocumento == documento && u.Activo)
            .Select(u => new
            {
                u.Id,
                u.NombreCompleto,
                u.Email,
                u.Rol,
                u.IdSede,
                u.NumeroDocumento,
                SedeNombre = u.Sede != null ? u.Sede.Nombre : null
            })
            .FirstOrDefaultAsync();

        if (user == null)
        {
            // Delay para prevenir ataques de fuerza bruta
            await Task.Delay(TimeSpan.FromSeconds(1));
            return Unauthorized("Documento no encontrado o usuario inactivo.");
        }

        // Generar token JWT
        var token = GenerarJwtToken(
            id: user.Id,
            email: user.Email,
            rol: user.Rol,
            idSede: user.IdSede,
            nombreCompleto: user.NombreCompleto
        );

        // Devolver token + datos del usuario
        var usuarioDto = new UsuarioMobileDto(
            user.Id,
            user.NombreCompleto,
            user.Email,
            user.Rol,
            user.NumeroDocumento,
            user.SedeNombre
        );

        return Ok(new LoginMobileResponseDto(token, usuarioDto));
    }

    private string GenerarJwtToken(int id, string email, string rol, int idSede, string nombreCompleto)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, id.ToString()),
            new Claim(ClaimTypes.Email, email),
            new Claim(ClaimTypes.Role, rol),
            new Claim("sede", idSede.ToString()),
            new Claim(ClaimTypes.Name, nombreCompleto ?? string.Empty)
        };

        var keyStr = _configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key not configured");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(keyStr));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var expireHours = int.TryParse(_configuration["Jwt:ExpireHours"], out var h) ? h : 8;
        var expires = DateTime.UtcNow.AddHours(expireHours);

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: expires,
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}