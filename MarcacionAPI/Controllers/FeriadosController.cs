using MarcacionAPI.Data;
using MarcacionAPI.Models;
using MarcacionAPI.DTOs.Horarios;
using MarcacionAPI.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;

namespace MarcacionAPI.Controllers;

public record FeriadoDto(string Nombre, bool Laborable = false);

[Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
[ApiController]
[Route("api/[controller]")]
public class FeriadosController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<FeriadosController> _logger;

    public FeriadosController(ApplicationDbContext context, ILogger<FeriadosController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // ============================================================
    // GET /api/feriados?year=YYYY
    // ============================================================
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] int? year)
    {
        var query = _context.Feriados.AsNoTracking();

        if (year.HasValue)
        {
            query = query.Where(f => f.Fecha.Year == year.Value);
        }

        var feriados = await query
            .OrderBy(f => f.Fecha)
            .ToListAsync();

        return Ok(feriados);
    }

    // ============================================================
    // POST /api/feriados/{fecha}
    // ============================================================
    [HttpPost("{fecha}")]
    [Authorize(Roles = Roles.SuperAdmin)]
    public async Task<IActionResult> CreateOrUpdate(string fecha, [FromBody] FeriadoDto dto)
    {
        try
        {
            if (!DateOnly.TryParse(fecha, out DateOnly fechaParsed))
            {
                return BadRequest("Formato de fecha inválido. Use YYYY-MM-DD.");
            }

            if (string.IsNullOrWhiteSpace(dto.Nombre))
            {
                return BadRequest("El nombre del feriado es requerido.");
            }

            var idAdmin = User.GetUserId();
            if (idAdmin is null)
                return Unauthorized();

            var existente = await _context.Feriados
                .FirstOrDefaultAsync(f => f.Fecha == fechaParsed);

            string accionAuditoria;

            if (existente != null)
            {
                // Actualizar
                existente.Nombre = dto.Nombre.Trim();
                existente.Laborable = dto.Laborable;
                accionAuditoria = "feriado.update";

                _logger.LogInformation("Feriado actualizado: {Fecha}", fechaParsed);
            }
            else
            {
                // Crear
                var nuevoFeriado = new Feriado
                {
                    Fecha = fechaParsed,
                    Nombre = dto.Nombre.Trim(),
                    Laborable = dto.Laborable
                };
                _context.Feriados.Add(nuevoFeriado);
                accionAuditoria = "feriado.create";

                _logger.LogInformation("Feriado creado: {Fecha} - {Nombre}", fechaParsed, dto.Nombre);
            }

            // Auditoría
            _context.Auditorias.Add(new Auditoria
            {
                IdUsuarioAdmin = idAdmin.Value,
                Accion = accionAuditoria,
                Entidad = "Feriado",
                EntidadId = fechaParsed.DayNumber,
                DataJson = JsonSerializer.Serialize(new
                {
                    fecha = fechaParsed.ToString("yyyy-MM-dd"),
                    dto.Nombre,
                    dto.Laborable
                })
            });

            await _context.SaveChangesAsync();

            return existente == null
                ? CreatedAtAction(nameof(Get), new { year = fechaParsed.Year }, new { fecha = fechaParsed })
                : NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear/actualizar feriado {Fecha}", fecha);
            return StatusCode(500, new
            {
                mensaje = "Error al procesar el feriado",
                error = ex.Message
            });
        }
    }

    // ============================================================
    // DELETE /api/feriados/{fecha}
    // ============================================================
    [HttpDelete("{fecha}")]
    [Authorize(Roles = Roles.SuperAdmin)]
    public async Task<IActionResult> Delete(string fecha)
    {
        try
        {
            if (!DateOnly.TryParse(fecha, out DateOnly fechaParsed))
            {
                return BadRequest("Formato de fecha inválido. Use YYYY-MM-DD.");
            }

            var feriado = await _context.Feriados
                .FirstOrDefaultAsync(f => f.Fecha == fechaParsed);

            if (feriado == null)
            {
                return NotFound("No se encontró un feriado para esa fecha.");
            }

            var idAdmin = User.GetUserId();
            if (idAdmin is null)
                return Unauthorized();

            var feriadoData = new
            {
                fecha = fechaParsed.ToString("yyyy-MM-dd"),
                feriado.Nombre,
                feriado.Laborable
            };

            _context.Feriados.Remove(feriado);

            // Auditoría
            _context.Auditorias.Add(new Auditoria
            {
                IdUsuarioAdmin = idAdmin.Value,
                Accion = "feriado.delete",
                Entidad = "Feriado",
                EntidadId = fechaParsed.DayNumber,
                DataJson = JsonSerializer.Serialize(feriadoData)
            });

            await _context.SaveChangesAsync();

            _logger.LogWarning("Feriado eliminado: {Fecha} - {Nombre}", fechaParsed, feriado.Nombre);

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar feriado {Fecha}", fecha);
            return StatusCode(500, new
            {
                mensaje = "Error al eliminar el feriado",
                error = ex.Message
            });
        }
    }
}