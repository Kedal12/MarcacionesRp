using System;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using MarcacionAPI.Data;
using MarcacionAPI.DTOs;
using MarcacionAPI.Models;
using MarcacionAPI.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace MarcacionAPI.Controllers;

[Authorize(Roles = "admin,superadmin")]
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

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] int? year)
    {
        var query = _context.Feriados.AsNoTracking();

        if (year.HasValue)
        {
            query = query.Where(f => f.Fecha.Year == year.Value);
        }

        var feriados = await query.OrderBy(f => f.Fecha).ToListAsync();
        return Ok(feriados);
    }

    [HttpPost("{fecha}")]
    [Authorize(Roles = "superadmin")]
    public async Task<IActionResult> CreateOrUpdate(string fecha, [FromBody] FeriadoDto dto)
    {
        try
        {
            if (!DateOnly.TryParse(fecha, out var fechaParsed))
            {
                return BadRequest("Formato de fecha inválido. Use YYYY-MM-DD.");
            }

            if (string.IsNullOrWhiteSpace(dto.Nombre))
            {
                return BadRequest("El nombre del feriado es requerido.");
            }

            var idAdmin = User.GetUserId();
            if (!idAdmin.HasValue)
            {
                return Unauthorized();
            }

            var existente = await _context.Feriados
                .FirstOrDefaultAsync(f => f.Fecha == fechaParsed);

            string accion;
            if (existente != null)
            {
                existente.Nombre = dto.Nombre.Trim();
                existente.Laborable = dto.Laborable;
                accion = "feriado.update";
                _logger.LogInformation("Feriado actualizado: {Fecha}", fechaParsed);
            }
            else
            {
                var feriado = new Feriado
                {
                    Fecha = fechaParsed,
                    Nombre = dto.Nombre.Trim(),
                    Laborable = dto.Laborable
                };
                _context.Feriados.Add(feriado);
                accion = "feriado.create";
                _logger.LogInformation("Feriado creado: {Fecha} - {Nombre}", fechaParsed, dto.Nombre);
            }

            _context.Auditorias.Add(new Auditoria
            {
                IdUsuarioAdmin = idAdmin.Value,
                Accion = accion,
                Entidad = "Feriado",
                EntidadId = fechaParsed.DayNumber,
                DataJson = JsonSerializer.Serialize(new
                {
                    fecha = fechaParsed.ToString("yyyy-MM-dd"),
                    Nombre = dto.Nombre,
                    Laborable = dto.Laborable
                })
            });

            await _context.SaveChangesAsync();

            if (existente != null)
            {
                return NoContent();
            }
            else
            {
                return CreatedAtAction(nameof(Get), new { year = fechaParsed.Year }, new { fecha = fechaParsed });
            }
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

    [HttpDelete("{fecha}")]
    [Authorize(Roles = "superadmin")]
    public async Task<IActionResult> Delete(string fecha)
    {
        try
        {
            if (!DateOnly.TryParse(fecha, out var fechaParsed))
            {
                return BadRequest("Formato de fecha inválido. Use YYYY-MM-DD.");
            }

            var feriado = await _context.Feriados
                .FirstOrDefaultAsync(f => f.Fecha == fechaParsed);

            if (feriado == null)
            {
                return NotFound("No se encontró un feriado para esa fecha.");
            }

            var userId = User.GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized();
            }

            var feriadoData = new
            {
                fecha = fechaParsed.ToString("yyyy-MM-dd"),
                Nombre = feriado.Nombre,
                Laborable = feriado.Laborable
            };

            _context.Feriados.Remove(feriado);
            _context.Auditorias.Add(new Auditoria
            {
                IdUsuarioAdmin = userId.Value,
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