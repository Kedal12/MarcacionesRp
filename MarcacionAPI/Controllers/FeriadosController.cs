using MarcacionAPI.Data;
using MarcacionAPI.Models;
using MarcacionAPI.DTOs.Horarios; // Asumiendo que FeriadoDto está aquí o en su propio DTO
using MarcacionAPI.Utils; // Para Roles y UserExtensions
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Security.Claims; // Para ClaimsTypes
using System.Text.Json; // Para Auditoría
using System.Threading.Tasks;

namespace MarcacionAPI.Controllers;

// DTO para crear/actualizar feriados (Lo muevo aquí si no está en un DTO global)
public record FeriadoDto(string Nombre, bool Laborable = false);

// --- MODIFICADO: Roles a nivel de clase ---
[Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")] // admin y superadmin pueden ver
[ApiController]
[Route("api/[controller]")]
public class FeriadosController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public FeriadosController(ApplicationDbContext context)
    {
        _context = context;
    }

    // GET /api/feriados?year=YYYY (opcional para filtrar por año)
    /// <summary>
    /// Obtiene la lista de feriados, opcionalmente filtrados por año.
    /// </summary>
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

    // POST /api/feriados/{fecha} (fecha en formato YYYY-MM-DD)
    /// <summary>
    /// Crea o actualiza un feriado para una fecha específica. (Solo SuperAdmin)
    /// </summary>
    [HttpPost("{fecha}")]
    [Authorize(Roles = Roles.SuperAdmin)] // <-- RESTRINGIDO A SUPERADMIN
    public async Task<IActionResult> CreateOrUpdate(string fecha, [FromBody] FeriadoDto dto)
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
        if (idAdmin is null) return Unauthorized();

        var existente = await _context.Feriados.FirstOrDefaultAsync(f => f.Fecha == fechaParsed);
        string accionAuditoria;

        if (existente != null)
        {
            // Actualiza
            existente.Nombre = dto.Nombre.Trim();
            existente.Laborable = dto.Laborable;
            accionAuditoria = "feriado.update";
        }
        else
        {
            // Crea
            var nuevoFeriado = new Feriado
            {
                Fecha = fechaParsed,
                Nombre = dto.Nombre.Trim(),
                Laborable = dto.Laborable
            };
            _context.Feriados.Add(nuevoFeriado);
            accionAuditoria = "feriado.create";
        }

        // --- Auditoría ---
        _context.Auditorias.Add(new Auditoria
        {
            IdUsuarioAdmin = idAdmin.Value,
            Accion = accionAuditoria,
            Entidad = "Feriado",
            // Usamos DayNumber como ID único ya que Fecha es la PK (y es DateOnly)
            EntidadId = fechaParsed.DayNumber,
            DataJson = JsonSerializer.Serialize(new { fecha = fechaParsed.ToString("yyyy-MM-dd"), dto.Nombre, dto.Laborable })
        });
        // --- Fin Auditoría ---

        await _context.SaveChangesAsync();

        return existente == null ? CreatedAtAction(nameof(Get), new { year = fechaParsed.Year }, new { fecha = fechaParsed }) : NoContent();
    }

    // DELETE /api/feriados/{fecha} (fecha en formato YYYY-MM-DD)
    /// <summary>
    /// Elimina un feriado específico. (Solo SuperAdmin)
    /// </summary>
    [HttpDelete("{fecha}")]
    [Authorize(Roles = Roles.SuperAdmin)] // <-- RESTRINGIDO A SUPERADMIN
    public async Task<IActionResult> Delete(string fecha)
    {
        if (!DateOnly.TryParse(fecha, out DateOnly fechaParsed))
        {
            return BadRequest("Formato de fecha inválido. Use YYYY-MM-DD.");
        }

        var feriado = await _context.Feriados.FirstOrDefaultAsync(f => f.Fecha == fechaParsed);

        if (feriado == null)
        {
            return NotFound("No se encontró un feriado para esa fecha.");
        }

        var idAdmin = User.GetUserId();
        if (idAdmin is null) return Unauthorized();

        _context.Feriados.Remove(feriado);

        // --- Auditoría ---
        _context.Auditorias.Add(new Auditoria
        {
            IdUsuarioAdmin = idAdmin.Value,
            Accion = "feriado.delete",
            Entidad = "Feriado",
            EntidadId = fechaParsed.DayNumber,
            DataJson = JsonSerializer.Serialize(new { fecha = fechaParsed.ToString("yyyy-MM-dd"), feriado.Nombre, feriado.Laborable })
        });
        // --- Fin Auditoría ---

        await _context.SaveChangesAsync();

        return NoContent(); // 204 Éxito sin contenido
    }
}