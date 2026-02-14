using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Security.Claims;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using MarcacionAPI.Data;
using MarcacionAPI.DTOs;
using MarcacionAPI.Models;
using MarcacionAPI.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("America/Bogota");
        }
        catch
        {
            return TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
        }
    }

    [HttpPost]
    public async Task<IActionResult> CrearCorreccion([FromBody] CorreccionCrearDto dto)
    {
        string text = base.User.FindFirstValue("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
        if (text == null)
        {
            return Unauthorized();
        }
        int idUsuarioFinal;
        int idLogueado = (idUsuarioFinal = int.Parse(text));
        if (dto.IdUsuario.HasValue && dto.IdUsuario.Value > 0)
        {
            if (!base.User.IsInRole("admin") && !base.User.IsInRole("superadmin"))
            {
                return Forbid("No puedes crear solicitudes para otros usuarios.");
            }
            idUsuarioFinal = dto.IdUsuario.Value;
        }
        if (string.IsNullOrWhiteSpace(dto.Tipo) || (dto.Tipo != "entrada" && dto.Tipo != "salida"))
        {
            return BadRequest("El tipo debe ser 'entrada' o 'salida'.");
        }
        if (string.IsNullOrWhiteSpace(dto.Motivo))
        {
            return BadRequest("El motivo es requerido.");
        }
        if (await EntityFrameworkQueryableExtensions.AnyAsync<Correccion>((IQueryable<Correccion>)_context.Correcciones, (Expression<Func<Correccion, bool>>)((Correccion c) => c.IdUsuario == idUsuarioFinal && c.Fecha == dto.Fecha && c.Tipo == dto.Tipo && c.Estado == "pendiente"), default(CancellationToken)))
        {
            return Conflict("Ya existe una solicitud pendiente para esa fecha y tipo.");
        }
        Correccion nuevaCorreccion = new Correccion
        {
            IdUsuario = idUsuarioFinal,
            Fecha = dto.Fecha,
            Tipo = dto.Tipo,
            HoraSolicitada = dto.HoraSolicitada,
            Motivo = dto.Motivo.Trim(),
            Estado = "pendiente",
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = idLogueado
        };
        _context.Correcciones.Add(nuevaCorreccion);
        _context.Auditorias.Add(new Auditoria
        {
            IdUsuarioAdmin = idLogueado,
            Accion = "correccion.create",
            Entidad = "Correccion",
            DataJson = JsonSerializer.Serialize(new
            {
                UsuarioObjetivo = idUsuarioFinal,
                Fecha = dto.Fecha,
                Tipo = dto.Tipo
            })
        });
        await ((DbContext)_context).SaveChangesAsync(default(CancellationToken));
        return Ok(nuevaCorreccion);
    }

    [HttpGet]
    [Authorize(Roles = "admin,superadmin")]
    public async Task<IActionResult> ListarCorrecciones([FromQuery] CorreccionFiltroDto filtro)
    {
        IQueryable<Correccion> query =
            ((IEnumerable<Correccion>)
                EntityFrameworkQueryableExtensions
                    .Include<Correccion, Usuario>(
                        EntityFrameworkQueryableExtensions.AsNoTracking<Correccion>(
                            (IQueryable<Correccion>)_context.Correcciones
                        ),
                        (Expression<Func<Correccion, Usuario>>)((Correccion c) => c.Usuario)
                    )
                    .ThenInclude((Usuario u) => u.Sede) // ← incluir Sede
            ).AsQueryable();

        int? sedeIdFiltrada = filtro.IdSede;
        int? idUsuarioFiltrado = filtro.IdUsuario;

        if (!User.IsSuperAdmin())
        {
            sedeIdFiltrada = User.GetSedeId().GetValueOrDefault();

            if (idUsuarioFiltrado.HasValue && idUsuarioFiltrado.Value > 0)
            {
                int num = await EntityFrameworkQueryableExtensions.FirstOrDefaultAsync<int>(
                    from u in EntityFrameworkQueryableExtensions.AsNoTracking<Usuario>((IQueryable<Usuario>)_context.Usuarios)
                    where u.Id == ((int?)idUsuarioFiltrado).Value
                    select u.IdSede,
                    default(CancellationToken)
                );

                if (num == 0 || num != sedeIdFiltrada)
                    return Forbid();
            }
        }

        if (idUsuarioFiltrado.HasValue)
            query = query.Where((Correccion c) => c.IdUsuario == ((int?)idUsuarioFiltrado).Value);

        if (sedeIdFiltrada.HasValue && sedeIdFiltrada > 0)
            query = query.Where((Correccion c) => c.Usuario.IdSede == ((int?)sedeIdFiltrada).Value);

        if (!string.IsNullOrWhiteSpace(filtro.Estado))
            query = query.Where((Correccion c) => c.Estado == filtro.Estado.ToLower());

        if (filtro.Desde.HasValue)
            query = query.Where((Correccion c) => c.Fecha >= filtro.Desde.Value);

        if (filtro.Hasta.HasValue)
            query = query.Where((Correccion c) => c.Fecha <= filtro.Hasta.Value);

        return Ok(await EntityFrameworkQueryableExtensions.ToListAsync<CorreccionListadoDto>(
            from c in query
            orderby c.CreatedAt descending
            select new CorreccionListadoDto(
                c.Id,                                  // Id
                c.IdUsuario,                           // IdUsuario
                c.Usuario.NombreCompleto,              // NombreUsuario
                c.Fecha,                               // Fecha
                c.Tipo,                                // Tipo
                c.HoraSolicitada,                      // HoraSolicitada
                c.Motivo,                              // Motivo
                c.Estado,                              // Estado
                c.CreatedAt,                           // CreatedAt
                null,                                  // NombreRevisor
                c.ReviewedAt,                          // ReviewedAt
                (c.Usuario.Sede != null ? (int?)c.Usuario.Sede.Id : null),     // SedeId (nullable)
                (c.Usuario.Sede != null ? c.Usuario.Sede.Nombre : null)        // SedeNombre (nullable)
            ),
            default(CancellationToken)
        ));
    }

    [HttpPut("{id:int}/aprobar")]
    [Authorize(Roles = "superadmin")]
    public async Task<IActionResult> AprobarCorreccion(int id)
    {
        Correccion correccion = await EntityFrameworkQueryableExtensions.FirstOrDefaultAsync<Correccion>((IQueryable<Correccion>)EntityFrameworkQueryableExtensions.ThenInclude<Correccion, Usuario, Sede>(EntityFrameworkQueryableExtensions.Include<Correccion, Usuario>((IQueryable<Correccion>)_context.Correcciones, (Expression<Func<Correccion, Usuario>>)((Correccion c) => c.Usuario)), (Expression<Func<Usuario, Sede>>)((Usuario u) => u.Sede)), (Expression<Func<Correccion, bool>>)((Correccion c) => c.Id == id), default(CancellationToken));
        if (correccion == null)
        {
            return NotFound();
        }
        if (correccion.Estado != "pendiente")
        {
            return BadRequest("La solicitud ya está '" + correccion.Estado + "'.");
        }
        int idAdmin = base.User.GetUserId().GetValueOrDefault();
        try
        {
            TimeZoneInfo bogotaTz = GetBogotaTz();
            DateTime dateTime = correccion.Fecha.ToDateTime(TimeOnly.FromTimeSpan(correccion.HoraSolicitada));
            DateTime fechaUtcFinal = TimeZoneInfo.ConvertTimeToUtc(dateTime, bogotaTz);
            DateTime rangoInicio = fechaUtcFinal.AddMinutes(-1.0);
            DateTime rangoFin = fechaUtcFinal.AddMinutes(1.0);
            Marcacion marcacion = await EntityFrameworkQueryableExtensions.FirstOrDefaultAsync<Marcacion>((IQueryable<Marcacion>)_context.Marcaciones, (Expression<Func<Marcacion, bool>>)((Marcacion m) => m.IdUsuario == correccion.IdUsuario && m.Tipo == correccion.Tipo && m.FechaHora >= (DateTimeOffset)rangoInicio && m.FechaHora <= (DateTimeOffset)rangoFin), default(CancellationToken));
            if (marcacion != null)
            {
                marcacion.FechaHora = fechaUtcFinal;
            }
            else
            {
                Marcacion marcacion2 = new Marcacion
                {
                    IdUsuario = correccion.IdUsuario,
                    FechaHora = fechaUtcFinal,
                    Tipo = correccion.Tipo,
                    LatitudMarcacion = (correccion.Usuario.Sede?.Lat).GetValueOrDefault(),
                    LongitudMarcacion = (correccion.Usuario.Sede?.Lon).GetValueOrDefault()
                };
                _context.Marcaciones.Add(marcacion2);
            }
            correccion.Estado = "aprobada";
            correccion.ReviewedAt = DateTimeOffset.UtcNow;
            correccion.ReviewedBy = idAdmin;
            _context.Auditorias.Add(new Auditoria
            {
                IdUsuarioAdmin = idAdmin,
                Accion = "correccion.approve",
                Entidad = "Correccion",
                EntidadId = correccion.Id,
                DataJson = JsonSerializer.Serialize(new
                {
                    IdUsuario = correccion.IdUsuario,
                    NuevaHora = fechaUtcFinal
                })
            });
            await ((DbContext)_context).SaveChangesAsync(default(CancellationToken));
            return Ok(new
            {
                mensaje = "Aprobado y marcación aplicada."
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, "Error aplicando marcación: " + ex.Message);
        }
    }

    [HttpPut("{id:int}/rechazar")]
    [Authorize(Roles = "superadmin")]
    public async Task<IActionResult> RechazarCorreccion(int id)
    {
        Correccion correccion = await _context.Correcciones.FindAsync(new object[1] { id });
        if (correccion == null)
        {
            return NotFound();
        }
        if (correccion.Estado != "pendiente")
        {
            return BadRequest("La solicitud ya está '" + correccion.Estado + "'.");
        }
        int? userId = base.User.GetUserId();
        correccion.Estado = "rechazada";
        correccion.ReviewedAt = DateTimeOffset.UtcNow;
        correccion.ReviewedBy = userId.GetValueOrDefault();
        await ((DbContext)_context).SaveChangesAsync(default(CancellationToken));
        return Ok(new
        {
            mensaje = "Solicitud rechazada."
        });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> BorrarCorreccion(int id)
    {
        Correccion correccion = await _context.Correcciones.FindAsync(new object[1] { id });
        if (correccion == null)
        {
            return NotFound();
        }
        int? userId = base.User.GetUserId();
        if (!userId.HasValue)
        {
            return Unauthorized();
        }
        bool flag = false;
        if (base.User.IsSuperAdmin())
        {
            flag = true;
        }
        else if (correccion.IdUsuario == userId && correccion.Estado != "aprobada")
        {
            flag = true;
        }
        if (!flag)
        {
            return Forbid("No tienes permiso para eliminar esta solicitud.");
        }
        _context.Correcciones.Remove(correccion);
        await ((DbContext)_context).SaveChangesAsync(default(CancellationToken));
        return NoContent();
    }

    [HttpGet("mis-solicitudes")]
    public async Task<IActionResult> GetMisSolicitudes()
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));

        var correcciones = await _context.Correcciones
            .Where(c => c.IdUsuario == userId)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new
            {
                id = c.Id,
                fecha = c.Fecha.ToString("yyyy-MM-dd"), // ✅ Formato DateOnly correcto
                tipo = c.Tipo,
                horaSolicitada = c.HoraSolicitada.ToString(@"hh\:mm\:ss"), // ✅ Formato TimeSpan correcto
                motivo = c.Motivo,
                estado = c.Estado,
                createdAt = c.CreatedAt
            })
            .ToListAsync();

        return Ok(correcciones);
    }
}