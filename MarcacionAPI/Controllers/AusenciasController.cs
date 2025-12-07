using MarcacionAPI.Data;
using MarcacionAPI.DTOs.Ausencias; // Asegúrate que AusenciaCrearDto, AusenciaListadoDto, AusenciaFiltroDto estén aquí
using MarcacionAPI.Models;
using MarcacionAPI.Utils; // <-- AÑADIDO
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using System.Text.Json; // Para serializar en auditoría

namespace MarcacionAPI.Controllers;

[Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")] // <-- MODIFICADO: Admin/SuperAdmin por defecto
[ApiController]
[Route("api/[controller]")]
public class AusenciasController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public AusenciasController(ApplicationDbContext context)
    {
        _context = context;
    }

    // POST /api/ausencias (Empleado/Admin/SuperAdmin crea su PROPIA solicitud)
    /// <summary>
    /// Crea una nueva solicitud de ausencia (estado: pendiente).
    /// </summary>
    [HttpPost]
    [Authorize] // <-- MODIFICADO: Anula el authorize de la clase, permite a todos los logueados
    public async Task<IActionResult> CrearAusencia([FromBody] AusenciaCrearDto dto)
    {
        // Obtiene el ID del usuario que hace la solicitud (desde el token)
        var idUsuario = User.GetUserId();
        if (idUsuario is null)
        {
            return Unauthorized();
        }

        // Validación básica
        if (string.IsNullOrWhiteSpace(dto.Tipo)) return BadRequest("El tipo de ausencia es requerido.");
        if (dto.Hasta < dto.Desde) return BadRequest("La fecha 'Hasta' no puede ser anterior a 'Desde'.");

        // Validar solapamiento con otras ausencias del mismo usuario
        var overlap = await _context.Ausencias.AnyAsync(a =>
            a.IdUsuario == idUsuario.Value &&
            a.Estado != EstadoAusencia.Rechazada && // Ignora rechazadas
            !((a.Hasta < dto.Desde) || (a.Desde > dto.Hasta)));

        if (overlap)
        {
            return Conflict("Ya existe una solicitud de ausencia (pendiente o aprobada) que se solapa con las fechas indicadas.");
        }

        var nuevaAusencia = new Ausencia
        {
            IdUsuario = idUsuario.Value,
            Tipo = dto.Tipo.Trim(),
            Desde = dto.Desde,
            Hasta = dto.Hasta,
            Observacion = dto.Observacion?.Trim(),
            Estado = EstadoAusencia.Pendiente, // Estado inicial
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = idUsuario.Value // El mismo usuario la crea
        };

        _context.Ausencias.Add(nuevaAusencia);

        // --- Auditoría ---
        _context.Auditorias.Add(new Auditoria
        {
            IdUsuarioAdmin = idUsuario.Value, // El usuario que crea es el "admin" de esta acción
            Accion = "ausencia.create.request",
            Entidad = "Ausencia",
            EntidadId = nuevaAusencia.Id,
            DataJson = JsonSerializer.Serialize(new { dto.Tipo, dto.Desde, dto.Hasta, dto.Observacion })
        });
        // --- Fin Auditoría ---

        await _context.SaveChangesAsync(); // Guarda Ausencia y Auditoría
        return CreatedAtAction(nameof(GetAusenciaById), new { id = nuevaAusencia.Id }, nuevaAusencia);
    }

    // GET /api/ausencias/{id}
    /// <summary>
    /// Obtiene una ausencia específica por ID.
    /// (Admin/SuperAdmin pueden ver cualquiera [de su sede], Empleado solo las suyas)
    /// </summary>
    [HttpGet("{id:int}")]
    [Authorize] // <-- MODIFICADO: Permite a Empleados también, filtramos adentro
    public async Task<IActionResult> GetAusenciaById(int id)
    {
        var idUsuarioLogueado = User.GetUserId();
        if (idUsuarioLogueado is null) return Unauthorized();

        var query = _context.Ausencias.AsNoTracking()
                                      .Include(a => a.Usuario)
                                      .Where(a => a.Id == id);

        // --- LÓGICA DE SEDE Y PERMISOS ---
        if (!User.IsSuperAdmin()) // Si no es SuperAdmin, aplicar filtros
        {
            if (User.IsInRole(Roles.Admin)) // Si es Admin de Sede
            {
                var sedeIdAdmin = User.GetSedeId() ?? 0;
                // Filtrar por usuarios de su sede
                query = query.Where(a => a.Usuario != null && a.Usuario.IdSede == sedeIdAdmin);
            }
            else // Si es Empleado
            {
                // Filtrar solo por sus propias ausencias
                query = query.Where(a => a.IdUsuario == idUsuarioLogueado.Value);
            }
        }
        // SuperAdmin no tiene filtros
        // --- FIN LÓGICA ---

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
                                          null // Placeholder nombre aprobador
                                      ))
                                      .FirstOrDefaultAsync();

        return ausenciaDto == null ? NotFound("No se encontró la ausencia o no tienes permisos para verla.") : Ok(ausenciaDto);
    }

    // GET /api/ausencias (Admin lista solicitudes con filtros)
    /// <summary>
    /// Lista las solicitudes de ausencia con filtros opcionales. (Admin/SuperAdmin)
    /// </summary>
    [HttpGet]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")] // <-- MODIFICADO
    public async Task<IActionResult> ListarAusencias([FromQuery] AusenciaFiltroDto filtro)
    {
        var query = _context.Ausencias.AsNoTracking()
                             .Include(a => a.Usuario)
                             .AsQueryable();

        // --- LÓGICA DE SEDE AÑADIDA ---
        var sedeIdFiltrada = filtro.IdSede;
        var idUsuarioFiltrado = filtro.IdUsuario;

        if (!User.IsSuperAdmin())
        {
            // Forzar el filtro de sede al del admin
            sedeIdFiltrada = User.GetSedeId() ?? 0;

            // Si el admin (no superadmin) intenta filtrar por un usuario específico,
            // verificar que ese usuario pertenezca a SU sede.
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
        // --- FIN LÓGICA DE SEDE ---

        // Aplicar filtros validados
        if (idUsuarioFiltrado.HasValue && idUsuarioFiltrado > 0)
        {
            query = query.Where(a => a.IdUsuario == idUsuarioFiltrado.Value);
        }
        // Aplicar filtro de Sede (ya sea el del query o el forzado)
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
            query = query.Where(a => a.Hasta >= filtro.Desde.Value); // Solapamiento
        }
        if (filtro.Hasta.HasValue)
        {
            query = query.Where(a => a.Desde <= filtro.Hasta.Value); // Solapamiento
        }

        // Seleccionar y ordenar
        var ausencias = await query
                                .OrderByDescending(a => a.CreatedAt) // Más recientes primero
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
                                    null // Placeholder nombre aprobador
                                ))
                                .ToListAsync();

        return Ok(ausencias);
    }

    // PUT /api/ausencias/{id}/aprobar (Admin aprueba)
    [HttpPut("{id:int}/aprobar")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")] // <-- MODIFICADO
    public async Task<IActionResult> AprobarAusencia(int id)
    {
        var ausencia = await _context.Ausencias
                                  .Include(a => a.Usuario) // Incluir usuario para verificar sede
                                  .FirstOrDefaultAsync(a => a.Id == id);
        if (ausencia == null) return NotFound();
        if (ausencia.Estado != EstadoAusencia.Pendiente)
            return BadRequest($"La solicitud ya está en estado '{ausencia.Estado}'.");

        var idAdmin = User.GetUserId();
        if (idAdmin is null) return Unauthorized("No se pudo identificar al administrador.");

        // --- LÓGICA DE SEDE AÑADIDA ---
        if (!User.IsSuperAdmin())
        {
            var sedeIdAdmin = User.GetSedeId() ?? 0;
            if (ausencia.Usuario == null || ausencia.Usuario.IdSede != sedeIdAdmin)
            {
                return Forbid("No puedes aprobar solicitudes de usuarios de otra sede.");
            }
        }
        // --- FIN LÓGICA DE SEDE ---

        ausencia.Estado = EstadoAusencia.Aprobada;
        ausencia.ApprovedAt = DateTimeOffset.UtcNow;
        ausencia.ApprovedBy = idAdmin.Value;

        // --- Auditoría ---
        _context.Auditorias.Add(new Auditoria
        {
            IdUsuarioAdmin = idAdmin.Value,
            Accion = "ausencia.approve",
            Entidad = "Ausencia",
            EntidadId = ausencia.Id,
            DataJson = JsonSerializer.Serialize(new { ausencia.IdUsuario, ausencia.Tipo, ausencia.Desde, ausencia.Hasta })
        });
        // --- Fin Auditoría ---

        await _context.SaveChangesAsync();
        return NoContent(); // 204 Éxito
    }

    // PUT /api/ausencias/{id}/rechazar (Admin rechaza)
    [HttpPut("{id:int}/rechazar")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")] // <-- MODIFICADO
    public async Task<IActionResult> RechazarAusencia(int id)
    {
        var ausencia = await _context.Ausencias
                                  .Include(a => a.Usuario) // Incluir usuario para verificar sede
                                  .FirstOrDefaultAsync(a => a.Id == id);
        if (ausencia == null) return NotFound();
        if (ausencia.Estado != EstadoAusencia.Pendiente)
            return BadRequest($"La solicitud ya está en estado '{ausencia.Estado}'.");

        var idAdmin = User.GetUserId();
        if (idAdmin is null) return Unauthorized("No se pudo identificar al administrador.");

        // --- LÓGICA DE SEDE AÑADIDA ---
        if (!User.IsSuperAdmin())
        {
            var sedeIdAdmin = User.GetSedeId() ?? 0;
            if (ausencia.Usuario == null || ausencia.Usuario.IdSede != sedeIdAdmin)
            {
                return Forbid("No puedes rechazar solicitudes de usuarios de otra sede.");
            }
        }
        // --- FIN LÓGICA DE SEDE ---

        ausencia.Estado = EstadoAusencia.Rechazada;
        ausencia.ApprovedAt = DateTimeOffset.UtcNow;
        ausencia.ApprovedBy = idAdmin.Value;

        // --- Auditoría ---
        _context.Auditorias.Add(new Auditoria
        {
            IdUsuarioAdmin = idAdmin.Value,
            Accion = "ausencia.reject",
            Entidad = "Ausencia",
            EntidadId = ausencia.Id,
            DataJson = JsonSerializer.Serialize(new { ausencia.IdUsuario, ausencia.Tipo, ausencia.Desde, ausencia.Hasta })
        });
        // --- Fin Auditoría ---

        await _context.SaveChangesAsync();
        return NoContent(); // 204 Éxito
    }

    // DELETE /api/ausencias/{id} (Admin O Empleado borra las suyas)
    [HttpDelete("{id:int}")]
    [Authorize] // <-- MODIFICADO: Permite a todos los logueados, filtramos adentro
    public async Task<IActionResult> BorrarAusencia(int id)
    {
        var ausencia = await _context.Ausencias
                                 .Include(a => a.Usuario) // Necesario para chequeo de sede
                                 .FirstOrDefaultAsync(x => x.Id == id);
        if (ausencia is null) return NotFound();

        var idUsuarioLogueado = User.GetUserId();
        if (idUsuarioLogueado is null) return Unauthorized();

        bool tienePermiso = false;

        // --- LÓGICA DE PERMISOS DE BORRADO ---
        if (User.IsSuperAdmin())
        {
            tienePermiso = true; // SuperAdmin puede borrar todo
        }
        else if (User.IsInRole(Roles.Admin))
        {
            // Admin solo puede borrar de su sede
            var sedeIdAdmin = User.GetSedeId() ?? 0;
            if (ausencia.Usuario != null && ausencia.Usuario.IdSede == sedeIdAdmin)
            {
                tienePermiso = true;
            }
        }
        else // Es Empleado
        {
            // Empleado solo puede borrar las suyas PROPIAS
            // y solo si están pendientes o rechazadas
            if (ausencia.IdUsuario == idUsuarioLogueado && (ausencia.Estado == EstadoAusencia.Pendiente || ausencia.Estado == EstadoAusencia.Rechazada))
            {
                tienePermiso = true;
            }
        }
        // --- FIN LÓGICA ---

        if (!tienePermiso)
        {
            return Forbid("No tienes permisos para borrar esta solicitud.");
        }

        _context.Ausencias.Remove(ausencia);

        // --- Auditoría ---
        _context.Auditorias.Add(new Auditoria
        {
            IdUsuarioAdmin = idUsuarioLogueado.Value, // Quién borró
            Accion = "ausencia.delete",
            Entidad = "Ausencia",
            EntidadId = id, // ID de la borrada
            DataJson = JsonSerializer.Serialize(new { ausencia.IdUsuario, ausencia.Tipo, ausencia.Desde, ausencia.Hasta, ausencia.Estado })
        });
        // --- Fin Auditoría ---

        await _context.SaveChangesAsync();
        return NoContent();
    }
}