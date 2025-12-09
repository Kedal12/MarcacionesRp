using MarcacionAPI.Data;
using MarcacionAPI.DTOs.Ausencias;
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

[Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
[ApiController]
[Route("api/[controller]")]
public class AusenciasController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public AusenciasController(ApplicationDbContext context)
    {
        _context = context;
    }

    // POST /api/ausencias
    /// <summary>
    /// Crea una nueva solicitud de ausencia (siempre queda en estado PENDIENTE).
    /// - Empleado: Solo puede crear para sí mismo
    /// - Admin: Puede crear para usuarios de su sede
    /// - SuperAdmin: Puede crear para cualquier usuario
    /// Todas las ausencias requieren aprobación de RRHH.
    /// </summary>
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> CrearAusencia([FromBody] AusenciaCrearDto dto)
    {
        var idUsuarioLogueado = User.GetUserId();
        if (idUsuarioLogueado is null)
        {
            return Unauthorized();
        }

        // Validación básica
        if (string.IsNullOrWhiteSpace(dto.Tipo)) return BadRequest("El tipo de ausencia es requerido.");
        if (dto.Hasta < dto.Desde) return BadRequest("La fecha 'Hasta' no puede ser anterior a 'Desde'.");

        // Determinar para quién es la ausencia
        int idUsuarioDestino;
        bool esParaOtroUsuario = false;

        if (dto.IdUsuario.HasValue && dto.IdUsuario.Value > 0 && dto.IdUsuario.Value != idUsuarioLogueado.Value)
        {
            // Admin/SuperAdmin creando ausencia para OTRO usuario
            esParaOtroUsuario = true;
            idUsuarioDestino = dto.IdUsuario.Value;

            // Verificar permisos
            if (!User.IsInRole(Roles.Admin) && !User.IsSuperAdmin())
            {
                return Forbid("Solo administradores pueden crear ausencias para otros usuarios.");
            }

            // Verificar que el usuario destino existe y está activo
            var usuarioDestino = await _context.Usuarios
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == idUsuarioDestino && u.Activo);

            if (usuarioDestino == null)
            {
                return NotFound("El usuario especificado no existe o está inactivo.");
            }

            // Si es Admin (no SuperAdmin), verificar que el usuario sea de su sede
            if (!User.IsSuperAdmin())
            {
                var sedeIdAdmin = User.GetSedeId() ?? 0;
                if (usuarioDestino.IdSede != sedeIdAdmin)
                {
                    return Forbid("No puedes crear ausencias para usuarios de otra sede.");
                }
            }
        }
        else
        {
            // Usuario creando ausencia para SÍ MISMO
            idUsuarioDestino = idUsuarioLogueado.Value;
        }

        // Validar solapamiento con otras ausencias del usuario destino
        var overlap = await _context.Ausencias.AnyAsync(a =>
            a.IdUsuario == idUsuarioDestino &&
            a.Estado != EstadoAusencia.Rechazada &&
            !((a.Hasta < dto.Desde) || (a.Desde > dto.Hasta)));

        if (overlap)
        {
            return Conflict("Ya existe una solicitud de ausencia (pendiente o aprobada) que se solapa con las fechas indicadas.");
        }

        // ✅ SIEMPRE queda en estado PENDIENTE - requiere aprobación de RRHH
        var nuevaAusencia = new Ausencia
        {
            IdUsuario = idUsuarioDestino,
            Tipo = dto.Tipo.Trim(),
            Desde = dto.Desde,
            Hasta = dto.Hasta,
            Observacion = dto.Observacion?.Trim(),
            Estado = EstadoAusencia.Pendiente, // Siempre pendiente
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = idUsuarioLogueado.Value
        };

        _context.Ausencias.Add(nuevaAusencia);

        // --- Auditoría ---
        _context.Auditorias.Add(new Auditoria
        {
            IdUsuarioAdmin = idUsuarioLogueado.Value,
            Accion = esParaOtroUsuario ? "ausencia.create.admin" : "ausencia.create.request",
            Entidad = "Ausencia",
            EntidadId = nuevaAusencia.Id,
            DataJson = JsonSerializer.Serialize(new
            {
                IdUsuarioDestino = idUsuarioDestino,
                dto.Tipo,
                dto.Desde,
                dto.Hasta,
                dto.Observacion
            })
        });
        // --- Fin Auditoría ---

        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAusenciaById), new { id = nuevaAusencia.Id }, nuevaAusencia);
    }

    // GET /api/ausencias/{id}
    [HttpGet("{id:int}")]
    [Authorize]
    public async Task<IActionResult> GetAusenciaById(int id)
    {
        var idUsuarioLogueado = User.GetUserId();
        if (idUsuarioLogueado is null) return Unauthorized();

        var query = _context.Ausencias.AsNoTracking()
                                      .Include(a => a.Usuario)
                                      .Where(a => a.Id == id);

        if (!User.IsSuperAdmin())
        {
            if (User.IsInRole(Roles.Admin))
            {
                var sedeIdAdmin = User.GetSedeId() ?? 0;
                query = query.Where(a => a.Usuario != null && a.Usuario.IdSede == sedeIdAdmin);
            }
            else
            {
                query = query.Where(a => a.IdUsuario == idUsuarioLogueado.Value);
            }
        }

        var ausenciaDto = await query.Select(a => new AusenciaListadoDto(
                                          a.Id,
                                          a.IdUsuario,
                                          a.Usuario != null ? a.Usuario.NombreCompleto : "N/A",
                                          a.Tipo,
                                          a.Desde,
                                          a.Hasta,
                                          a.Observacion,
                                          a.Estado,
                                          a.CreatedAt,
                                          null
                                      ))
                                      .FirstOrDefaultAsync();

        return ausenciaDto == null ? NotFound("No se encontró la ausencia o no tienes permisos para verla.") : Ok(ausenciaDto);
    }

    // GET /api/ausencias
    [HttpGet]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> ListarAusencias([FromQuery] AusenciaFiltroDto filtro)
    {
        var query = _context.Ausencias.AsNoTracking()
                             .Include(a => a.Usuario)
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
                {
                    return Forbid("No puedes ver ausencias de usuarios de otra sede.");
                }
            }
        }

        if (idUsuarioFiltrado.HasValue && idUsuarioFiltrado > 0)
        {
            query = query.Where(a => a.IdUsuario == idUsuarioFiltrado.Value);
        }

        if (sedeIdFiltrada.HasValue && sedeIdFiltrada > 0)
        {
            query = query.Where(a => a.Usuario != null && a.Usuario.IdSede == sedeIdFiltrada.Value);
        }

        if (!string.IsNullOrWhiteSpace(filtro.Estado))
        {
            query = query.Where(a => a.Estado == filtro.Estado.ToLower());
        }
        if (filtro.Desde.HasValue)
        {
            query = query.Where(a => a.Hasta >= filtro.Desde.Value);
        }
        if (filtro.Hasta.HasValue)
        {
            query = query.Where(a => a.Desde <= filtro.Hasta.Value);
        }

        var ausencias = await query
                                .OrderByDescending(a => a.CreatedAt)
                                .Select(a => new AusenciaListadoDto(
                                    a.Id,
                                    a.IdUsuario,
                                    a.Usuario != null ? a.Usuario.NombreCompleto : "N/A",
                                    a.Tipo,
                                    a.Desde,
                                    a.Hasta,
                                    a.Observacion,
                                    a.Estado,
                                    a.CreatedAt,
                                    null
                                ))
                                .ToListAsync();

        return Ok(ausencias);
    }

    // GET /api/ausencias/usuarios-sede
    [HttpGet("usuarios-sede")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> GetUsuariosSede()
    {
        var query = _context.Usuarios.AsNoTracking()
                            .Where(u => u.Activo)
                            .AsQueryable();

        if (!User.IsSuperAdmin())
        {
            var sedeId = User.GetSedeId() ?? 0;
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

    // PUT /api/ausencias/{id}/aprobar
    [HttpPut("{id:int}/aprobar")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> AprobarAusencia(int id)
    {
        var ausencia = await _context.Ausencias
                                  .Include(a => a.Usuario)
                                  .FirstOrDefaultAsync(a => a.Id == id);
        if (ausencia == null) return NotFound();
        if (ausencia.Estado != EstadoAusencia.Pendiente)
            return BadRequest($"La solicitud ya está en estado '{ausencia.Estado}'.");

        var idAdmin = User.GetUserId();
        if (idAdmin is null) return Unauthorized("No se pudo identificar al administrador.");

        if (!User.IsSuperAdmin())
        {
            var sedeIdAdmin = User.GetSedeId() ?? 0;
            if (ausencia.Usuario == null || ausencia.Usuario.IdSede != sedeIdAdmin)
            {
                return Forbid("No puedes aprobar solicitudes de usuarios de otra sede.");
            }
        }

        ausencia.Estado = EstadoAusencia.Aprobada;
        ausencia.ApprovedAt = DateTimeOffset.UtcNow;
        ausencia.ApprovedBy = idAdmin.Value;

        _context.Auditorias.Add(new Auditoria
        {
            IdUsuarioAdmin = idAdmin.Value,
            Accion = "ausencia.approve",
            Entidad = "Ausencia",
            EntidadId = ausencia.Id,
            DataJson = JsonSerializer.Serialize(new { ausencia.IdUsuario, ausencia.Tipo, ausencia.Desde, ausencia.Hasta })
        });

        await _context.SaveChangesAsync();
        return NoContent();
    }

    // PUT /api/ausencias/{id}/rechazar
    [HttpPut("{id:int}/rechazar")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> RechazarAusencia(int id)
    {
        var ausencia = await _context.Ausencias
                                  .Include(a => a.Usuario)
                                  .FirstOrDefaultAsync(a => a.Id == id);
        if (ausencia == null) return NotFound();
        if (ausencia.Estado != EstadoAusencia.Pendiente)
            return BadRequest($"La solicitud ya está en estado '{ausencia.Estado}'.");

        var idAdmin = User.GetUserId();
        if (idAdmin is null) return Unauthorized("No se pudo identificar al administrador.");

        if (!User.IsSuperAdmin())
        {
            var sedeIdAdmin = User.GetSedeId() ?? 0;
            if (ausencia.Usuario == null || ausencia.Usuario.IdSede != sedeIdAdmin)
            {
                return Forbid("No puedes rechazar solicitudes de usuarios de otra sede.");
            }
        }

        ausencia.Estado = EstadoAusencia.Rechazada;
        ausencia.ApprovedAt = DateTimeOffset.UtcNow;
        ausencia.ApprovedBy = idAdmin.Value;

        _context.Auditorias.Add(new Auditoria
        {
            IdUsuarioAdmin = idAdmin.Value,
            Accion = "ausencia.reject",
            Entidad = "Ausencia",
            EntidadId = ausencia.Id,
            DataJson = JsonSerializer.Serialize(new { ausencia.IdUsuario, ausencia.Tipo, ausencia.Desde, ausencia.Hasta })
        });

        await _context.SaveChangesAsync();
        return NoContent();
    }

    // DELETE /api/ausencias/{id}
    [HttpDelete("{id:int}")]
    [Authorize]
    public async Task<IActionResult> BorrarAusencia(int id)
    {
        var ausencia = await _context.Ausencias
                                 .Include(a => a.Usuario)
                                 .FirstOrDefaultAsync(x => x.Id == id);
        if (ausencia is null) return NotFound();

        var idUsuarioLogueado = User.GetUserId();
        if (idUsuarioLogueado is null) return Unauthorized();

        bool tienePermiso = false;

        if (User.IsSuperAdmin())
        {
            tienePermiso = true;
        }
        else if (User.IsInRole(Roles.Admin))
        {
            var sedeIdAdmin = User.GetSedeId() ?? 0;
            if (ausencia.Usuario != null && ausencia.Usuario.IdSede == sedeIdAdmin)
            {
                tienePermiso = true;
            }
        }
        else
        {
            if (ausencia.IdUsuario == idUsuarioLogueado && (ausencia.Estado == EstadoAusencia.Pendiente || ausencia.Estado == EstadoAusencia.Rechazada))
            {
                tienePermiso = true;
            }
        }

        if (!tienePermiso)
        {
            return Forbid("No tienes permisos para borrar esta solicitud.");
        }

        _context.Ausencias.Remove(ausencia);

        _context.Auditorias.Add(new Auditoria
        {
            IdUsuarioAdmin = idUsuarioLogueado.Value,
            Accion = "ausencia.delete",
            Entidad = "Ausencia",
            EntidadId = id,
            DataJson = JsonSerializer.Serialize(new { ausencia.IdUsuario, ausencia.Tipo, ausencia.Desde, ausencia.Hasta, ausencia.Estado })
        });

        await _context.SaveChangesAsync();
        return NoContent();
    }
}