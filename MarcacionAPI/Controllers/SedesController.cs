using MarcacionAPI.Data;
using MarcacionAPI.DTOs;
using MarcacionAPI.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MarcacionAPI.Utils;
using MarcacionAPI.DTOs.Sedes;
using System.Text.Json;
using System.Security.Claims;

namespace MarcacionAPI.Controllers;

[Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
[ApiController]
[Route("api/[controller]")]
public class SedesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<SedesController> _logger;

    public SedesController(ApplicationDbContext context, ILogger<SedesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // ============================================================
    // GET api/sedes?search=&page=&pageSize=
    // ============================================================
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string? search,
        [FromQuery] int page = Paging.DefaultPage,
        [FromQuery] int pageSize = Paging.DefaultPageSize)
    {
        (page, pageSize) = Paging.Normalize(page, pageSize);

        var q = _context.Sedes.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            q = q.Where(x => x.Nombre.ToLower().Contains(s));
        }

        var total = await q.CountAsync();

        var items = await q
            .OrderBy(x => x.Nombre)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.Id,
                x.Nombre,
                x.Lat,
                x.Lon,
                Usuarios = _context.Usuarios.Count(u => u.IdSede == x.Id)
            })
            .ToListAsync();

        return Ok(new PagedResponse<object>(items, total, page, pageSize));
    }

    // ============================================================
    // GET api/sedes/all  (para combos)
    // ============================================================
    [HttpGet("all")]
    public async Task<IActionResult> GetAll()
    {
        var items = await _context.Sedes.AsNoTracking()
            .OrderBy(x => x.Nombre)
            .Select(x => new { x.Id, x.Nombre })
            .ToListAsync();

        return Ok(items);
    }

    // ============================================================
    // GET api/sedes/{id}
    // ============================================================
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var s = await _context.Sedes.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id);

        return s is null ? NotFound() : Ok(s);
    }

    // ============================================================
    // POST api/sedes
    // ============================================================
    [Authorize(Roles = Roles.SuperAdmin)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SedeCreateDto dto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto.Nombre))
                return BadRequest("Nombre es obligatorio.");

            var exists = await _context.Sedes.AnyAsync(x => x.Nombre == dto.Nombre);
            if (exists)
                return Conflict("Ya existe una sede con ese nombre.");

            if (dto.Lat is < -90 or > 90)
                return BadRequest("Latitud inválida.");

            if (dto.Lon is < -180 or > 180)
                return BadRequest("Longitud inválida.");

            var s = new Sede
            {
                Nombre = dto.Nombre.Trim(),
                Lat = dto.Lat,
                Lon = dto.Lon
            };

            _context.Sedes.Add(s);

            // ✅ GUARDAR PRIMERO para obtener el ID
            await _context.SaveChangesAsync();

            // Auditoría (DESPUÉS de tener el ID)
            var idAdmin = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (int.TryParse(idAdmin, out int adminId))
            {
                _context.Auditorias.Add(new Auditoria
                {
                    IdUsuarioAdmin = adminId,
                    Accion = "sede.create",
                    Entidad = "Sede",
                    EntidadId = s.Id, // ✅ Ahora sí tiene ID
                    DataJson = JsonSerializer.Serialize(new { s.Nombre, s.Lat, s.Lon })
                });

                await _context.SaveChangesAsync();
            }

            _logger.LogInformation("Sede creada: {Nombre} (ID: {Id})", s.Nombre, s.Id);

            return CreatedAtAction(nameof(GetById), new { id = s.Id }, s);
        }
        catch (DbUpdateException dbEx)
        {
            _logger.LogError(dbEx, "Error de base de datos al crear sede");
            return StatusCode(500, new
            {
                mensaje = "Error al guardar en la base de datos",
                error = dbEx.InnerException?.Message ?? dbEx.Message
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error inesperado al crear sede");
            return StatusCode(500, new
            {
                mensaje = "Error interno del servidor",
                error = ex.Message,
                detalle = ex.InnerException?.Message ?? "Sin detalles"
            });
        }
    }

    // ============================================================
    // PUT api/sedes/{id}
    // ============================================================
    [Authorize(Roles = Roles.SuperAdmin)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] SedeUpdateDto dto)
    {
        try
        {
            var s = await _context.Sedes.FirstOrDefaultAsync(x => x.Id == id);
            if (s is null)
                return NotFound();

            if (string.IsNullOrWhiteSpace(dto.Nombre))
                return BadRequest("Nombre es obligatorio.");

            var exists = await _context.Sedes.AnyAsync(x => x.Id != id && x.Nombre == dto.Nombre);
            if (exists)
                return Conflict("Ya existe una sede con ese nombre.");

            if (dto.Lat is < -90 or > 90)
                return BadRequest("Latitud inválida.");

            if (dto.Lon is < -180 or > 180)
                return BadRequest("Longitud inválida.");

            s.Nombre = dto.Nombre.Trim();
            s.Lat = dto.Lat;
            s.Lon = dto.Lon;

            // Auditoría
            var idAdmin = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (int.TryParse(idAdmin, out int adminId))
            {
                _context.Auditorias.Add(new Auditoria
                {
                    IdUsuarioAdmin = adminId,
                    Accion = "sede.update",
                    Entidad = "Sede",
                    EntidadId = s.Id,
                    DataJson = JsonSerializer.Serialize(dto)
                });
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation("Sede actualizada: {Id}", id);

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar sede {Id}", id);
            return StatusCode(500, new
            {
                mensaje = "Error al actualizar la sede",
                error = ex.Message
            });
        }
    }

    // ============================================================
    // PATCH api/sedes/{id}/coordenadas
    // ============================================================
    [Authorize(Roles = Roles.SuperAdmin)]
    [HttpPatch("{id:int}/coordenadas")]
    public async Task<IActionResult> UpdateCoords(int id, [FromBody] SedeCoordsDto dto)
    {
        try
        {
            var s = await _context.Sedes.FirstOrDefaultAsync(x => x.Id == id);
            if (s is null)
                return NotFound();

            if (dto.Lat is < -90 or > 90)
                return BadRequest("Latitud inválida.");

            if (dto.Lon is < -180 or > 180)
                return BadRequest("Longitud inválida.");

            s.Lat = dto.Lat;
            s.Lon = dto.Lon;

            // Auditoría
            var idAdmin = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (int.TryParse(idAdmin, out int adminId))
            {
                _context.Auditorias.Add(new Auditoria
                {
                    IdUsuarioAdmin = adminId,
                    Accion = "sede.update-coords",
                    Entidad = "Sede",
                    EntidadId = s.Id,
                    DataJson = JsonSerializer.Serialize(dto)
                });
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation("Coordenadas de sede {Id} actualizadas", id);

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar coordenadas de sede {Id}", id);
            return StatusCode(500, new
            {
                mensaje = "Error al actualizar las coordenadas",
                error = ex.Message
            });
        }
    }

    // ============================================================
    // DELETE api/sedes/{id}
    // ============================================================
    [Authorize(Roles = Roles.SuperAdmin)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        try
        {
            var s = await _context.Sedes.FirstOrDefaultAsync(x => x.Id == id);
            if (s is null)
                return NotFound();

            var tieneUsuarios = await _context.Usuarios.AnyAsync(u => u.IdSede == id);
            if (tieneUsuarios)
                return Conflict("No se puede eliminar: la sede tiene usuarios asignados.");

            var sedeData = new { s.Id, s.Nombre };

            _context.Sedes.Remove(s);

            // Auditoría
            var idAdmin = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (int.TryParse(idAdmin, out int adminId))
            {
                _context.Auditorias.Add(new Auditoria
                {
                    IdUsuarioAdmin = adminId,
                    Accion = "sede.delete",
                    Entidad = "Sede",
                    EntidadId = id,
                    DataJson = JsonSerializer.Serialize(sedeData)
                });
            }

            await _context.SaveChangesAsync();

            _logger.LogWarning("Sede eliminada: {Id} - {Nombre}", id, sedeData.Nombre);

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar sede {Id}", id);
            return StatusCode(500, new
            {
                mensaje = "Error al eliminar la sede",
                error = ex.Message
            });
        }
    }
}