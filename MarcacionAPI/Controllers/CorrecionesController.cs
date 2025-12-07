using MarcacionAPI.Data;
using MarcacionAPI.DTOs;
using MarcacionAPI.Models;
using MarcacionAPI.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using System.Text.Json;

namespace MarcacionAPI.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CorreccionesController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public CorreccionesController(ApplicationDbContext context)
    {
        _context = context;
    }

    private static TimeZoneInfo GetBogotaTz()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("America/Bogota"); }
        catch { return TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time"); }
    }

    // =========================================================================
    // 1. CREAR SOLICITUD
    // =========================================================================
    [HttpPost]
    public async Task<IActionResult> CrearCorreccion([FromBody] CorreccionCrearDto dto)
    {
        var idLogueadoStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (idLogueadoStr == null) return Unauthorized();
        int idLogueado = int.Parse(idLogueadoStr);

        int idUsuarioFinal = idLogueado;

        // Si envían IdUsuario y es admin, lo usamos
        if (dto.IdUsuario.HasValue && dto.IdUsuario.Value > 0)
        {
            if (User.IsInRole(Roles.Admin) || User.IsInRole(Roles.SuperAdmin))
            {
                idUsuarioFinal = dto.IdUsuario.Value;
            }
            else
            {
                return Forbid("No puedes crear solicitudes para otros usuarios.");
            }
        }

        if (string.IsNullOrWhiteSpace(dto.Tipo) || (dto.Tipo != TipoCorreccion.Entrada && dto.Tipo != TipoCorreccion.Salida))
            return BadRequest("El tipo debe ser 'entrada' o 'salida'.");

        if (string.IsNullOrWhiteSpace(dto.Motivo))
            return BadRequest("El motivo es requerido.");

        var existePendiente = await _context.Correcciones.AnyAsync(c =>
            c.IdUsuario == idUsuarioFinal &&
            c.Fecha == dto.Fecha &&
            c.Tipo == dto.Tipo &&
            c.Estado == EstadoCorreccion.Pendiente);

        if (existePendiente)
            return Conflict("Ya existe una solicitud pendiente para esa fecha y tipo.");

        var nuevaCorreccion = new Correccion
        {
            IdUsuario = idUsuarioFinal,
            Fecha = dto.Fecha,
            Tipo = dto.Tipo,
            HoraSolicitada = dto.HoraSolicitada,
            Motivo = dto.Motivo.Trim(),
            Estado = EstadoCorreccion.Pendiente,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = idLogueado
        };

        _context.Correcciones.Add(nuevaCorreccion);

        _context.Auditorias.Add(new Auditoria
        {
            IdUsuarioAdmin = idLogueado,
            Accion = "correccion.create",
            Entidad = "Correccion",
            DataJson = JsonSerializer.Serialize(new { UsuarioObjetivo = idUsuarioFinal, dto.Fecha, dto.Tipo })
        });

        await _context.SaveChangesAsync();
        return Ok(nuevaCorreccion);
    }

    // =========================================================================
    // 2. LISTAR 
    // =========================================================================
    [HttpGet]
    [Authorize(Roles = "admin,superadmin")]
    public async Task<IActionResult> ListarCorrecciones([FromQuery] CorreccionFiltroDto filtro)
    {
        var query = _context.Correcciones.AsNoTracking()
                            .Include(c => c.Usuario)
                            .AsQueryable();

        var sedeIdFiltrada = filtro.IdSede;
        var idUsuarioFiltrado = filtro.IdUsuario;

        if (!User.IsSuperAdmin())
        {
            sedeIdFiltrada = User.GetSedeId() ?? 0;
            if (idUsuarioFiltrado.HasValue && idUsuarioFiltrado.Value > 0)
            {
                var usuarioSede = await _context.Usuarios.AsNoTracking()
                    .Where(u => u.Id == idUsuarioFiltrado.Value)
                    .Select(u => u.IdSede)
                    .FirstOrDefaultAsync();

                if (usuarioSede == 0 || usuarioSede != sedeIdFiltrada)
                    return Forbid();
            }
        }

        if (idUsuarioFiltrado.HasValue) query = query.Where(c => c.IdUsuario == idUsuarioFiltrado.Value);
        if (sedeIdFiltrada.HasValue && sedeIdFiltrada > 0)
            query = query.Where(c => c.Usuario.IdSede == sedeIdFiltrada.Value);
        if (!string.IsNullOrWhiteSpace(filtro.Estado))
            query = query.Where(c => c.Estado == filtro.Estado.ToLower());
        if (filtro.Desde.HasValue) query = query.Where(c => c.Fecha >= filtro.Desde.Value);
        if (filtro.Hasta.HasValue) query = query.Where(c => c.Fecha <= filtro.Hasta.Value);

        var lista = await query.OrderByDescending(c => c.CreatedAt)
            .Select(c => new CorreccionListadoDto(
                c.Id,
                c.IdUsuario,
                c.Usuario.NombreCompleto,
                c.Fecha,
                c.Tipo,
                c.HoraSolicitada,
                c.Motivo,
                c.Estado,
                c.CreatedAt,
                null,
                c.ReviewedAt
            )).ToListAsync();

        return Ok(lista);
    }

    // =========================================================================
    // 3. APROBAR (SOLO SUPERADMIN) -> CREA MARCACIÓN
    // =========================================================================
    // ✅ CAMBIO IMPORTANTE: Usamos HttpPut para coincidir con tu frontend (arregla error 405)
    [HttpPut("{id:int}/aprobar")]
    [Authorize(Roles = "superadmin")]
    public async Task<IActionResult> AprobarCorreccion(int id)
    {
        var correccion = await _context.Correcciones
            .Include(c => c.Usuario)
                .ThenInclude(u => u.Sede) // Traemos la sede para las coordenadas
            .FirstOrDefaultAsync(c => c.Id == id);

        if (correccion == null) return NotFound();
        if (correccion.Estado != EstadoCorreccion.Pendiente)
            return BadRequest($"La solicitud ya está '{correccion.Estado}'.");

        var idAdmin = User.GetUserId() ?? 0;

        try
        {
            var tz = GetBogotaTz();

            // Construir FechaHora exacta
            var fechaLocal = correccion.Fecha.ToDateTime(TimeOnly.FromTimeSpan(correccion.HoraSolicitada));
            var fechaUtcFinal = TimeZoneInfo.ConvertTimeToUtc(fechaLocal, tz);

            // Buscar duplicados
            var rangoInicio = fechaUtcFinal.AddMinutes(-1);
            var rangoFin = fechaUtcFinal.AddMinutes(1);

            var marcacionExistente = await _context.Marcaciones.FirstOrDefaultAsync(m =>
                m.IdUsuario == correccion.IdUsuario &&
                m.Tipo == correccion.Tipo &&
                m.FechaHora >= rangoInicio && m.FechaHora <= rangoFin);

            if (marcacionExistente != null)
            {
                marcacionExistente.FechaHora = fechaUtcFinal;
            }
            else
            {
                // ✅ CORRECCIÓN: Usamos los nombres correctos de tu modelo (LatitudMarcacion)
                // y eliminamos 'Origen' que no existe.
                var nuevaMarcacion = new Marcacion
                {
                    IdUsuario = correccion.IdUsuario,
                    FechaHora = fechaUtcFinal,
                    Tipo = correccion.Tipo,
                    // Convertimos double a decimal
                    LatitudMarcacion = (decimal)(correccion.Usuario.Sede?.Lat ?? 0),
                    LongitudMarcacion = (decimal)(correccion.Usuario.Sede?.Lon ?? 0)
                };
                _context.Marcaciones.Add(nuevaMarcacion);
            }

            correccion.Estado = EstadoCorreccion.Aprobada;
            correccion.ReviewedAt = DateTimeOffset.UtcNow;
            correccion.ReviewedBy = idAdmin;

            _context.Auditorias.Add(new Auditoria
            {
                IdUsuarioAdmin = idAdmin,
                Accion = "correccion.approve",
                Entidad = "Correccion",
                EntidadId = correccion.Id,
                DataJson = JsonSerializer.Serialize(new { correccion.IdUsuario, NuevaHora = fechaUtcFinal })
            });

            await _context.SaveChangesAsync();
            return Ok(new { mensaje = "Aprobado y marcación aplicada." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error aplicando marcación: {ex.Message}");
        }
    }

    // =========================================================================
    // 4. RECHAZAR
    // =========================================================================
    [HttpPut("{id:int}/rechazar")]
    [Authorize(Roles = "superadmin")]
    public async Task<IActionResult> RechazarCorreccion(int id)
    {
        var correccion = await _context.Correcciones.FindAsync(id);
        if (correccion == null) return NotFound();

        if (correccion.Estado != EstadoCorreccion.Pendiente)
            return BadRequest($"La solicitud ya está '{correccion.Estado}'.");

        var idAdmin = User.GetUserId();

        correccion.Estado = EstadoCorreccion.Rechazada;
        correccion.ReviewedAt = DateTimeOffset.UtcNow;
        correccion.ReviewedBy = idAdmin ?? 0;

        await _context.SaveChangesAsync();
        return Ok(new { mensaje = "Solicitud rechazada." });
    }

    // =========================================================================
    // 5. BORRAR
    // =========================================================================
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> BorrarCorreccion(int id)
    {
        var correccion = await _context.Correcciones.FindAsync(id);
        if (correccion == null) return NotFound();

        var idLogueado = User.GetUserId();
        if (idLogueado == null) return Unauthorized();

        bool permiso = false;

        if (User.IsSuperAdmin())
        {
            permiso = true;
        }
        else if (correccion.IdUsuario == idLogueado)
        {
            if (correccion.Estado != EstadoCorreccion.Aprobada)
                permiso = true;
        }

        if (!permiso) return Forbid("No tienes permiso para eliminar esta solicitud.");

        _context.Correcciones.Remove(correccion);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}