using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Linq.Expressions;
using System.Security.Claims;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using BCrypt.Net;
using ClosedXML.Excel;
using MarcacionAPI.Data;
using MarcacionAPI.DTOs;
using MarcacionAPI.Models;
using MarcacionAPI.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace MarcacionAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "superadmin,admin")]
public class UsuariosController : ControllerBase
{
    public record ResetPasswordDto(string NewPassword);
    public record CambiarEstadoDto(bool Activo);

    private readonly ApplicationDbContext _context;
    private readonly ILogger<UsuariosController> _logger;

    public UsuariosController(ApplicationDbContext context, ILogger<UsuariosController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResponse<UsuarioListadoDto>>> Get(
        [FromQuery] string? search,
        [FromQuery] int? idSede,
        [FromQuery] bool? activo,
        [FromQuery] string? numeroDocumento,  // ✅ Filtro por documento
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var (p, sSize) = Paging.Normalize(page, pageSize);

        IQueryable<Usuario> query = _context.Usuarios
            .Include(u => u.Sede)
            .AsNoTracking();

        if (!User.IsSuperAdmin())
        {
            int sedeId = User.GetSedeId().GetValueOrDefault();
            query = query.Where(u => u.IdSede == sedeId);
        }
        else if (idSede.HasValue && idSede.Value > 0)
        {
            query = query.Where(u => u.IdSede == idSede.Value);
        }

        // ✅ Filtro de estado activo/inactivo
        if (activo.HasValue)
        {
            query = query.Where(u => u.Activo == activo.Value);
        }

        // ✅ Filtro por número de documento (búsqueda exacta o parcial)
        if (!string.IsNullOrWhiteSpace(numeroDocumento))
        {
            string doc = numeroDocumento.Trim();
            query = query.Where(u => u.NumeroDocumento.Contains(doc));
        }

        // Búsqueda general por nombre o email
        if (!string.IsNullOrWhiteSpace(search))
        {
            string s = search.Trim().ToLower();
            query = query.Where(u => u.NombreCompleto.ToLower().Contains(s) || u.Email.ToLower().Contains(s));
        }

        var total = await query.CountAsync();
        var items = await query.OrderBy(u => u.NombreCompleto)
            .Skip((p - 1) * sSize)
            .Take(sSize)
            .Select(u => new UsuarioListadoDto
            {
                Id = u.Id,
                NombreCompleto = u.NombreCompleto,
                Email = u.Email,
                Rol = u.Rol,
                IdSede = u.IdSede,
                SedeNombre = u.Sede != null ? u.Sede.Nombre : "Sin sede",
                TipoDocumento = u.TipoDocumento ?? "",
                NumeroDocumento = u.NumeroDocumento ?? "",
                Activo = u.Activo,
                BiometriaHabilitada = u.BiometriaHabilitada,
                BiometriaFechaRegistro = u.FaceEmbedding != null ? DateTime.Now : null
            })
            .ToListAsync();

        return Ok(new PagedResponse<UsuarioListadoDto>(items, total, p, sSize));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<UsuarioListadoDto>> GetById(int id)
    {
        var usuario = await _context.Usuarios
            .Include(u => u.Sede)
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == id);

        if (usuario == null) return NotFound();

        if (!User.IsSuperAdmin())
        {
            int sedeId = User.GetSedeId().GetValueOrDefault();
            if (usuario.IdSede != sedeId) return Forbid();
        }

        return Ok(new UsuarioListadoDto
        {
            Id = usuario.Id,
            NombreCompleto = usuario.NombreCompleto,
            Email = usuario.Email,
            Rol = usuario.Rol,
            IdSede = usuario.IdSede,
            SedeNombre = usuario.Sede?.Nombre ?? "Sin sede",
            TipoDocumento = usuario.TipoDocumento ?? "",
            NumeroDocumento = usuario.NumeroDocumento ?? "",
            Activo = usuario.Activo,
            BiometriaHabilitada = usuario.BiometriaHabilitada
        });
    }

    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] UsuarioCrearDto dto)
    {
        try
        {
            if (await _context.Usuarios.AnyAsync(u => u.Email == dto.Email))
                return BadRequest("El email ya está registrado.");

            int sedeId = dto.IdSede;
            if (!User.IsSuperAdmin())
            {
                sedeId = User.GetSedeId().GetValueOrDefault();
                if (sedeId == 0) return Unauthorized("No se identificó la sede del administrador.");
            }

            var nuevo = new Usuario
            {
                NombreCompleto = dto.NombreCompleto.Trim(),
                Email = dto.Email.Trim(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                Rol = User.IsSuperAdmin() ? dto.Rol.ToLowerInvariant() : "empleado",
                IdSede = sedeId,
                TipoDocumento = dto.TipoDocumento ?? "",
                NumeroDocumento = dto.NumeroDocumento ?? "",
                Activo = true,
                BiometriaHabilitada = true
            };

            _context.Usuarios.Add(nuevo);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById), new { id = nuevo.Id }, new { nuevo.Id, nuevo.Email });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear usuario");
            return StatusCode(500, new { mensaje = "Error interno", detalle = ex.Message });
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Actualizar(int id, [FromBody] UsuarioActualizarDto dto)
    {
        try
        {
            var u = await _context.Usuarios.FindAsync(id);
            if (u == null) return NotFound();

            if (!User.IsSuperAdmin())
            {
                int sedeIdAdmin = User.GetSedeId().GetValueOrDefault();
                if (u.IdSede != sedeIdAdmin) return Forbid();
            }

            u.NombreCompleto = dto.NombreCompleto.Trim();
            u.Activo = dto.Activo;
            u.TipoDocumento = dto.TipoDocumento ?? u.TipoDocumento;
            u.NumeroDocumento = dto.NumeroDocumento ?? u.NumeroDocumento;

            if (User.IsSuperAdmin())
            {
                u.Rol = dto.Rol.ToLowerInvariant();
                u.IdSede = dto.IdSede;
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar usuario {Id}", id);
            return StatusCode(500, new { mensaje = "Error al actualizar", error = ex.Message });
        }
    }

    /// <summary>
    /// Cambia el estado activo/inactivo de un usuario
    /// </summary>
    [HttpPatch("{id:int}/estado")]
    public async Task<IActionResult> CambiarEstado(int id, [FromBody] CambiarEstadoDto dto)
    {
        try
        {
            var u = await _context.Usuarios.FindAsync(id);
            if (u == null) return NotFound();

            if (!User.IsSuperAdmin())
            {
                int sedeIdAdmin = User.GetSedeId().GetValueOrDefault();
                if (u.IdSede != sedeIdAdmin) return Forbid();
            }

            u.Activo = dto.Activo;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Estado de usuario {Id} cambiado a {Estado}", id, dto.Activo ? "activo" : "inactivo");
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al cambiar estado del usuario {Id}", id);
            return StatusCode(500, new { mensaje = "Error al cambiar estado", error = ex.Message });
        }
    }

    /// <summary>
    /// Resetea la contraseña de un usuario
    /// </summary>
    [HttpPost("{id:int}/reset-password")]
    public async Task<IActionResult> ResetPassword(int id, [FromBody] ResetPasswordDto dto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto.NewPassword) || dto.NewPassword.Length < 6)
                return BadRequest("La contraseña debe tener al menos 6 caracteres.");

            var u = await _context.Usuarios.FindAsync(id);
            if (u == null) return NotFound();

            if (!User.IsSuperAdmin())
            {
                int sedeIdAdmin = User.GetSedeId().GetValueOrDefault();
                if (u.IdSede != sedeIdAdmin) return Forbid();
            }

            u.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Contraseña de usuario {Id} reseteada por admin", id);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al resetear contraseña del usuario {Id}", id);
            return StatusCode(500, new { mensaje = "Error al resetear contraseña", error = ex.Message });
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Eliminar(int id)
    {
        var u = await _context.Usuarios.FindAsync(id);
        if (u == null) return NotFound();

        if (!User.IsSuperAdmin())
        {
            int sedeId = User.GetSedeId().GetValueOrDefault();
            if (u.IdSede != sedeId) return Forbid();
        }

        u.Activo = false; // Soft Delete por seguridad
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("importar-masivo")]
    public async Task<IActionResult> ImportarMasivo(IFormFile archivo)
    {
        if (archivo == null || archivo.Length == 0) return BadRequest("No se ha subido ningún archivo.");

        try
        {
            // 1. Cargar todas las sedes en memoria para mapear nombres -> IDs rápidamente
            var sedesMap = await _context.Sedes
                .ToDictionaryAsync(s => s.Nombre.Trim().ToLower(), s => s.Id);

            using var stream = new MemoryStream();
            await archivo.CopyToAsync(stream);
            using var workbook = new XLWorkbook(stream);
            var worksheet = workbook.Worksheet(1);
            var rows = worksheet.RangeUsed().RowsUsed().Skip(1);

            var usuariosNuevos = new List<Usuario>();
            var errores = new List<string>();

            foreach (var row in rows)
            {
                var nombreSedeExcel = row.Cell(7).Value.ToString().Trim().ToLower();
                var email = row.Cell(2).Value.ToString().Trim();

                // Validación de existencia de Sede
                if (!sedesMap.TryGetValue(nombreSedeExcel, out int sedeId))
                {
                    errores.Add($"Fila {row.RowNumber()}: La sede '{row.Cell(7).Value}' no existe en el sistema.");
                    continue;
                }

                // Validación de Email duplicado
                if (await _context.Usuarios.AnyAsync(u => u.Email == email))
                {
                    errores.Add($"Fila {row.RowNumber()}: El email {email} ya está registrado.");
                    continue;
                }

                usuariosNuevos.Add(new Usuario
                {
                    NombreCompleto = row.Cell(1).Value.ToString().Trim(),
                    Email = email,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(row.Cell(3).Value.ToString()),
                    TipoDocumento = row.Cell(4).Value.ToString(),
                    NumeroDocumento = row.Cell(5).Value.ToString(),
                    Rol = row.Cell(6).Value.ToString().ToLower() ?? "empleado",
                    IdSede = sedeId, // ✅ ID asociado automáticamente
                    Activo = true,
                    BiometriaHabilitada = true
                });
            }

            if (usuariosNuevos.Any())
            {
                _context.Usuarios.AddRange(usuariosNuevos);
                await _context.SaveChangesAsync();
            }

            return Ok(new
            {
                mensaje = $"Proceso finalizado: {usuariosNuevos.Count} usuarios creados.",
                errores = errores
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en importación masiva");
            return StatusCode(500, "Error técnico al procesar el Excel.");
        }
    }
}