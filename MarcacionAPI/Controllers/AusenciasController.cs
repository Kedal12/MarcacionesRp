using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Security.Claims;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using MarcacionAPI.Data;
using MarcacionAPI.DTOs.Ausencias;
using MarcacionAPI.Models;
using MarcacionAPI.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MarcacionAPI.Controllers;

/// <summary>
/// Controlador de Ausencias
/// NOTA: El atributo de clase permite admin/superadmin, pero algunos endpoints
/// tienen [Authorize] propio para permitir acceso a usuarios normales.
/// </summary>
[Authorize(Roles = "admin,superadmin")]
[ApiController]
[Route("api/[controller]")]
public class AusenciasController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public AusenciasController(ApplicationDbContext context)
    {
        _context = context;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // ✅ NUEVO ENDPOINT: Mis Solicitudes (para usuarios normales)
    // ════════════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Obtiene las solicitudes de ausencia del usuario actualmente logueado.
    /// NO requiere rol admin - cualquier usuario autenticado puede ver sus propias ausencias.
    /// </summary>
    [HttpGet("mis-solicitudes")]
    [Authorize] // Sobrescribe el rol de clase - solo requiere autenticación
    public async Task<IActionResult> GetMisSolicitudes()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized("No se pudo identificar al usuario.");
        }

        var ausencias = await _context.Ausencias
            .AsNoTracking()
            .Where(a => a.IdUsuario == userId)
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new
            {
                id = a.Id,
                tipo = a.Tipo,
                desde = a.Desde.ToString("yyyy-MM-dd"),
                hasta = a.Hasta.ToString("yyyy-MM-dd"),
                observacion = a.Observacion,
                estado = a.Estado,
                createdAt = a.CreatedAt
            })
            .ToListAsync();

        return Ok(ausencias);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Crear Ausencia
    // ════════════════════════════════════════════════════════════════════════════

    [HttpPost]
    [Authorize] // Sobrescribe - cualquier usuario puede crear su propia ausencia
    public async Task<IActionResult> CrearAusencia([FromBody] AusenciaCrearDto dto)
    {
        int? idUsuarioLogueado = User.GetUserId();
        if (!idUsuarioLogueado.HasValue)
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(dto.Tipo))
        {
            return BadRequest("El tipo de ausencia es requerido.");
        }

        if (dto.Hasta < dto.Desde)
        {
            return BadRequest("La fecha 'Hasta' no puede ser anterior a 'Desde'.");
        }

        bool esParaOtroUsuario = false;
        int idUsuarioDestino;

        if (dto.IdUsuario.HasValue && dto.IdUsuario.Value > 0 && dto.IdUsuario.Value != idUsuarioLogueado.Value)
        {
            esParaOtroUsuario = true;
            idUsuarioDestino = dto.IdUsuario.Value;

            if (!User.IsInRole("admin") && !User.IsSuperAdmin())
            {
                return Forbid("Solo administradores pueden crear ausencias para otros usuarios.");
            }

            var usuario = await _context.Usuarios
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == idUsuarioDestino && u.Activo);

            if (usuario == null)
            {
                return NotFound("El usuario especificado no existe o está inactivo.");
            }

            if (!User.IsSuperAdmin())
            {
                int sedeAdmin = User.GetSedeId().GetValueOrDefault();
                if (usuario.IdSede != sedeAdmin)
                {
                    return Forbid("No puedes crear ausencias para usuarios de otra sede.");
                }
            }
        }
        else
        {
            idUsuarioDestino = idUsuarioLogueado.Value;
        }

        // Verificar solapamiento
        bool existeSolapamiento = await _context.Ausencias
            .AnyAsync(a =>
                a.IdUsuario == idUsuarioDestino &&
                a.Estado != "rechazada" &&
                !(a.Hasta < dto.Desde || a.Desde > dto.Hasta));

        if (existeSolapamiento)
        {
            return Conflict("Ya existe una solicitud de ausencia (pendiente o aprobada) que se solapa con las fechas indicadas.");
        }

        var nuevaAusencia = new Ausencia
        {
            IdUsuario = idUsuarioDestino,
            Tipo = dto.Tipo.Trim(),
            Desde = dto.Desde,
            Hasta = dto.Hasta,
            Observacion = dto.Observacion?.Trim(),
            Estado = "pendiente",
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = idUsuarioLogueado.Value
        };

        _context.Ausencias.Add(nuevaAusencia);

        _context.Auditorias.Add(new Auditoria
        {
            IdUsuarioAdmin = idUsuarioLogueado.Value,
            Accion = esParaOtroUsuario ? "ausencia.create.admin" : "ausencia.create.request",
            Entidad = "Ausencia",
            EntidadId = nuevaAusencia.Id,
            DataJson = JsonSerializer.Serialize(new
            {
                IdUsuarioDestino = idUsuarioDestino,
                Tipo = dto.Tipo,
                Desde = dto.Desde,
                Hasta = dto.Hasta,
                Observacion = dto.Observacion
            })
        });

        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAusenciaById), new { id = nuevaAusencia.Id }, nuevaAusencia);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Obtener Ausencia por ID
    // ════════════════════════════════════════════════════════════════════════════

    [HttpGet("{id:int}")]
    [Authorize]
    public async Task<IActionResult> GetAusenciaById(int id)
    {
        int? idUsuarioLogueado = User.GetUserId();
        if (!idUsuarioLogueado.HasValue)
        {
            return Unauthorized();
        }

        var query = _context.Ausencias
            .AsNoTracking()
            .Include(a => a.Usuario)
                .ThenInclude(u => u.Sede) // ← incluir Sede (nuevo)
            .Where(a => a.Id == id);

        // Filtrar según rol
        if (!User.IsSuperAdmin())
        {
            if (User.IsInRole("admin"))
            {
                int sedeIdAdmin = User.GetSedeId().GetValueOrDefault();
                query = query.Where(a => a.Usuario != null && a.Usuario.IdSede == sedeIdAdmin);
            }
            else
            {
                query = query.Where(a => a.IdUsuario == idUsuarioLogueado.Value);
            }
        }

        var ausencia = await query
            .Select(a => new AusenciaListadoDto(
                a.Id,                                              // Id
                a.IdUsuario,                                       // IdUsuario
                a.Usuario != null ? a.Usuario.NombreCompleto : "N/A", // NombreUsuario
                a.Tipo,                                            // Tipo
                a.Desde,                                           // Desde
                a.Hasta,                                           // Hasta
                a.Observacion,                                     // Observacion
                a.Estado,                                          // Estado
                a.CreatedAt,                                       // CreatedAt
                null,                                              // NombreAprobador
                (a.Usuario != null && a.Usuario.Sede != null ? (int?)a.Usuario.Sede.Id : null),
                (a.Usuario != null && a.Usuario.Sede != null ? a.Usuario.Sede.Nombre : null)
            ))
            .FirstOrDefaultAsync();

        if (ausencia == null)
        {
            return NotFound("No se encontró la ausencia o no tienes permisos para verla.");
        }

        return Ok(ausencia);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Listar Ausencias (Admin)
    // ════════════════════════════════════════════════════════════════════════════

    [HttpGet]
    [Authorize(Roles = "admin,superadmin")]
    public async Task<IActionResult> ListarAusencias([FromQuery] AusenciaFiltroDto filtro)
    {
        var query = _context.Ausencias
            .AsNoTracking()
            .Include(a => a.Usuario)
                .ThenInclude(u => u.Sede) // ← incluir Sede
            .AsQueryable();

        int? sedeIdFiltrada = filtro.IdSede;
        int? idUsuarioFiltrado = filtro.IdUsuario;

        if (!User.IsSuperAdmin())
        {
            sedeIdFiltrada = User.GetSedeId().GetValueOrDefault();

            if (idUsuarioFiltrado.HasValue && idUsuarioFiltrado.Value > 0)
            {
                var sedeUsuario = await _context.Usuarios
                    .AsNoTracking()
                    .Where(u => u.Id == idUsuarioFiltrado.Value)
                    .Select(u => u.IdSede)
                    .FirstOrDefaultAsync();

                if (sedeUsuario == 0 || sedeUsuario != sedeIdFiltrada)
                    return Forbid("No puedes ver ausencias de usuarios de otra sede.");
            }
        }

        if (idUsuarioFiltrado.HasValue && idUsuarioFiltrado > 0)
            query = query.Where(a => a.IdUsuario == idUsuarioFiltrado.Value);

        if (sedeIdFiltrada.HasValue && sedeIdFiltrada > 0)
            query = query.Where(a => a.Usuario != null && a.Usuario.IdSede == sedeIdFiltrada.Value);

        if (!string.IsNullOrWhiteSpace(filtro.Estado))
            query = query.Where(a => a.Estado == filtro.Estado.ToLower());

        if (filtro.Desde.HasValue)
            query = query.Where(a => a.Hasta >= filtro.Desde.Value);

        if (filtro.Hasta.HasValue)
            query = query.Where(a => a.Desde <= filtro.Hasta.Value);

        var resultado = await query
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new AusenciaListadoDto(
                a.Id,                                  // Id
                a.IdUsuario,                           // IdUsuario
                a.Usuario != null ? a.Usuario.NombreCompleto : "N/A", // NombreUsuario
                a.Tipo,                                // Tipo
                a.Desde,                               // Desde
                a.Hasta,                               // Hasta
                a.Observacion,                         // Observacion
                a.Estado,                              // Estado
                a.CreatedAt,                           // CreatedAt
                null,                                  // NombreAprobador
                (a.Usuario != null && a.Usuario.Sede != null ? (int?)a.Usuario.Sede.Id : null), // SedeId
                (a.Usuario != null && a.Usuario.Sede != null ? a.Usuario.Sede.Nombre : null)    // SedeNombre
            ))
            .ToListAsync();

        return Ok(resultado);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Usuarios de la Sede (para selector)
    // ════════════════════════════════════════════════════════════════════════════

    [HttpGet("usuarios-sede")]
    [Authorize(Roles = "admin,superadmin")]
    public async Task<IActionResult> GetUsuariosSede()
    {
        var query = _context.Usuarios
            .AsNoTracking()
            .Where(u => u.Activo)
            .AsQueryable();

        if (!User.IsSuperAdmin())
        {
            int sedeId = User.GetSedeId().GetValueOrDefault();
            query = query.Where(u => u.IdSede == sedeId);
        }

        var usuarios = await query
            .OrderBy(u => u.NombreCompleto)
            .Select(u => new
            {
                u.Id,
                u.NombreCompleto,
                u.NumeroDocumento
            })
            .ToListAsync();

        return Ok(usuarios);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Aprobar Ausencia (Admin)
    // ════════════════════════════════════════════════════════════════════════════

    [HttpPut("{id:int}/aprobar")]
    [Authorize(Roles = "admin,superadmin")]
    public async Task<IActionResult> AprobarAusencia(int id)
    {
        var ausencia = await _context.Ausencias
            .Include(a => a.Usuario)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (ausencia == null)
        {
            return NotFound();
        }

        if (ausencia.Estado != "pendiente")
        {
            return BadRequest($"La solicitud ya está en estado '{ausencia.Estado}'.");
        }

        int? userId = User.GetUserId();
        if (!userId.HasValue)
        {
            return Unauthorized("No se pudo identificar al administrador.");
        }

        if (!User.IsSuperAdmin())
        {
            int sedeAdmin = User.GetSedeId().GetValueOrDefault();
            if (ausencia.Usuario == null || ausencia.Usuario.IdSede != sedeAdmin)
            {
                return Forbid("No puedes aprobar solicitudes de usuarios de otra sede.");
            }
        }

        ausencia.Estado = "aprobada";
        ausencia.ApprovedAt = DateTimeOffset.UtcNow;
        ausencia.ApprovedBy = userId.Value;

        _context.Auditorias.Add(new Auditoria
        {
            IdUsuarioAdmin = userId.Value,
            Accion = "ausencia.approve",
            Entidad = "Ausencia",
            EntidadId = ausencia.Id,
            DataJson = JsonSerializer.Serialize(new
            {
                ausencia.IdUsuario,
                ausencia.Tipo,
                ausencia.Desde,
                ausencia.Hasta
            })
        });

        await _context.SaveChangesAsync();

        return NoContent();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Rechazar Ausencia (Admin)
    // ════════════════════════════════════════════════════════════════════════════

    [HttpPut("{id:int}/rechazar")]
    [Authorize(Roles = "admin,superadmin")]
    public async Task<IActionResult> RechazarAusencia(int id)
    {
        var ausencia = await _context.Ausencias
            .Include(a => a.Usuario)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (ausencia == null)
        {
            return NotFound();
        }

        if (ausencia.Estado != "pendiente")
        {
            return BadRequest($"La solicitud ya está en estado '{ausencia.Estado}'.");
        }

        int? userId = User.GetUserId();
        if (!userId.HasValue)
        {
            return Unauthorized("No se pudo identificar al administrador.");
        }

        if (!User.IsSuperAdmin())
        {
            int sedeAdmin = User.GetSedeId().GetValueOrDefault();
            if (ausencia.Usuario == null || ausencia.Usuario.IdSede != sedeAdmin)
            {
                return Forbid("No puedes rechazar solicitudes de usuarios de otra sede.");
            }
        }

        ausencia.Estado = "rechazada";
        ausencia.ApprovedAt = DateTimeOffset.UtcNow;
        ausencia.ApprovedBy = userId.Value;

        _context.Auditorias.Add(new Auditoria
        {
            IdUsuarioAdmin = userId.Value,
            Accion = "ausencia.reject",
            Entidad = "Ausencia",
            EntidadId = ausencia.Id,
            DataJson = JsonSerializer.Serialize(new
            {
                ausencia.IdUsuario,
                ausencia.Tipo,
                ausencia.Desde,
                ausencia.Hasta
            })
        });

        await _context.SaveChangesAsync();

        return NoContent();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Borrar Ausencia
    // ════════════════════════════════════════════════════════════════════════════

    [HttpDelete("{id:int}")]
    [Authorize]
    public async Task<IActionResult> BorrarAusencia(int id)
    {
        var ausencia = await _context.Ausencias
            .Include(a => a.Usuario)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (ausencia == null)
        {
            return NotFound();
        }

        int? userId = User.GetUserId();
        if (!userId.HasValue)
        {
            return Unauthorized();
        }

        bool puedeEliminar = false;

        if (User.IsSuperAdmin())
        {
            puedeEliminar = true;
        }
        else if (User.IsInRole("admin"))
        {
            int sedeAdmin = User.GetSedeId().GetValueOrDefault();
            if (ausencia.Usuario != null && ausencia.Usuario.IdSede == sedeAdmin)
            {
                puedeEliminar = true;
            }
        }
        else if (ausencia.IdUsuario == userId &&
                (ausencia.Estado == "pendiente" || ausencia.Estado == "rechazada"))
        {
            puedeEliminar = true;
        }

        if (!puedeEliminar)
        {
            return Forbid("No tienes permisos para borrar esta solicitud.");
        }

        _context.Ausencias.Remove(ausencia);

        _context.Auditorias.Add(new Auditoria
        {
            IdUsuarioAdmin = userId.Value,
            Accion = "ausencia.delete",
            Entidad = "Ausencia",
            EntidadId = id,
            DataJson = JsonSerializer.Serialize(new
            {
                ausencia.IdUsuario,
                ausencia.Tipo,
                ausencia.Desde,
                ausencia.Hasta,
                ausencia.Estado
            })
        });

        await _context.SaveChangesAsync();

        return NoContent();
    }
}