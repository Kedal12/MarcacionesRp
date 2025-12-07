using MarcacionAPI.Data;
using MarcacionAPI.DTOs;
using MarcacionAPI.Models;
using MarcacionAPI.Utils; // <-- AÑADIDO
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Security.Claims; // <-- Requerido por User.GetUserId()
using System.Threading.Tasks;
using System.Text.Json; // Para serializar en auditoría

namespace MarcacionAPI.Controllers;

[Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")] // <-- MODIFICADO: Default solo para Admins
[ApiController]
[Route("api/[controller]")]
public class CorreccionesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    // private readonly ILogger<CorreccionesController> _logger;

    public CorreccionesController(ApplicationDbContext context)
    {
        _context = context;
        // _logger = logger;
    }

    // POST /api/correcciones (Empleado crea solicitud)
    /// <summary>
    /// Crea una nueva solicitud de corrección de marcación (estado: pendiente).
    /// </summary>
    [HttpPost]
    [Authorize] // <-- MODIFICADO: Anula el [Authorize] de la clase, permite a todos (empleados)
    public async Task<IActionResult> CrearCorreccion([FromBody] CorreccionCrearDto dto)
    {
        // Obtiene el ID del usuario que hace la solicitud (desde el token)
        var idUsuario = User.GetUserId();
        if (idUsuario is null)
        {
            return Unauthorized();
        }

        // Validaciones
        if (string.IsNullOrWhiteSpace(dto.Tipo) || (dto.Tipo != TipoCorreccion.Entrada && dto.Tipo != TipoCorreccion.Salida))
        {
            return BadRequest("El tipo debe ser 'entrada' o 'salida'.");
        }
        if (string.IsNullOrWhiteSpace(dto.Motivo))
        {
            return BadRequest("El motivo es requerido.");
        }

        var existePendiente = await _context.Correcciones.AnyAsync(c =>
            c.IdUsuario == idUsuario.Value &&
            c.Fecha == dto.Fecha &&
            c.Tipo == dto.Tipo &&
            c.Estado == EstadoCorreccion.Pendiente);
        if (existePendiente)
        {
            return Conflict("Ya tienes una solicitud pendiente para esa fecha y tipo.");
        }

        var nuevaCorreccion = new Correccion
        {
            IdUsuario = idUsuario.Value,
            Fecha = dto.Fecha,
            Tipo = dto.Tipo,
            HoraSolicitada = dto.HoraSolicitada,
            Motivo = dto.Motivo.Trim(),
            Estado = EstadoCorreccion.Pendiente,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = idUsuario.Value
        };

        _context.Correcciones.Add(nuevaCorreccion);

        // --- Auditoría ---
        _context.Auditorias.Add(new Auditoria
        {
            IdUsuarioAdmin = idUsuario.Value, // Usuario que realiza la acción
            Accion = "correccion.create.request",
            Entidad = "Correccion",
            EntidadId = nuevaCorreccion.Id, // EF asignará ID
            DataJson = JsonSerializer.Serialize(new { dto.Fecha, dto.Tipo, dto.HoraSolicitada, dto.Motivo })
        });
        // --- Fin Auditoría ---

        await _context.SaveChangesAsync();

        return Ok(nuevaCorreccion); // Devuelve 200 OK
    }

    // GET /api/correcciones (Admin lista solicitudes con filtros)
    /// <summary>
    /// Lista las solicitudes de corrección con filtros opcionales. (Admin/SuperAdmin)
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> ListarCorrecciones([FromQuery] CorreccionFiltroDto filtro)
    {
        var query = _context.Correcciones.AsNoTracking()
                             .Include(c => c.Usuario) // Para nombre y filtro sede
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
                    return Forbid("No puedes ver correcciones de usuarios de otra sede.");
                }
            }
        }
        // --- FIN LÓGICA DE SEDE ---

        // Aplicar filtros validados
        if (idUsuarioFiltrado.HasValue && idUsuarioFiltrado > 0)
        {
            query = query.Where(c => c.IdUsuario == idUsuarioFiltrado.Value);
        }
        if (sedeIdFiltrada.HasValue && sedeIdFiltrada > 0)
        {
            query = query.Where(c => c.Usuario != null && c.Usuario.IdSede == sedeIdFiltrada.Value);
        }

        if (!string.IsNullOrWhiteSpace(filtro.Estado))
        {
            query = query.Where(c => c.Estado == filtro.Estado.ToLower());
        }
        if (filtro.Desde.HasValue)
        {
            query = query.Where(c => c.Fecha >= filtro.Desde.Value);
        }
        if (filtro.Hasta.HasValue)
        {
            query = query.Where(c => c.Fecha <= filtro.Hasta.Value);
        }

        // NOTA: Considerar paginación si la lista es muy larga
        // (page, pageSize) = Paging.Normalize(filtro.Page, filtro.PageSize);
        // var total = await query.CountAsync();
        // .Skip((page-1)*pageSize).Take(pageSize)

        var correcciones = await query
                                .OrderByDescending(c => c.CreatedAt)
                                .Select(c => new CorreccionListadoDto(
                                    c.Id,
                                    c.IdUsuario,
                                    c.Usuario != null ? c.Usuario.NombreCompleto : "N/A",
                                    c.Fecha,
                                    c.Tipo,
                                    c.HoraSolicitada,
                                    c.Motivo,
                                    c.Estado,
                                    c.CreatedAt,
                                    null, // Placeholder nombre revisor
                                    c.ReviewedAt
                                ))
                                .ToListAsync();

        return Ok(correcciones);
    }

    // --- ACCIONES DE ADMINISTRADOR ---

    // PUT /api/correcciones/{id}/aprobar (Admin aprueba)
    /// <summary>
    /// Aprueba una solicitud de corrección y aplica la marcación. (Admin/SuperAdmin)
    /// </summary>
    [HttpPut("{id:int}/aprobar")]
    public async Task<IActionResult> AprobarCorreccion(int id)
    {
        var correccion = await _context.Correcciones
                                     .Include(c => c.Usuario)
                                         .ThenInclude(u => u != null ? u.Sede : null)
                                     .FirstOrDefaultAsync(c => c.Id == id);

        if (correccion == null) return NotFound();
        if (correccion.Usuario == null) return BadRequest("El usuario asociado a la corrección no existe.");
        if (correccion.Estado != EstadoCorreccion.Pendiente)
            return BadRequest($"La solicitud ya está en estado '{correccion.Estado}'.");

        var idAdmin = User.GetUserId();
        if (idAdmin is null) return Unauthorized("No se pudo identificar al administrador.");

        // --- LÓGICA DE SEDE AÑADIDA ---
        if (!User.IsSuperAdmin())
        {
            var sedeIdAdmin = User.GetSedeId() ?? 0;
            if (correccion.Usuario.IdSede != sedeIdAdmin)
            {
                return Forbid("No puedes aprobar correcciones de usuarios de otra sede.");
            }
        }
        // --- FIN LÓGICA DE SEDE ---

        try
        {
            var tz = TimeZoneInfo.Local; // O tu TimeZoneInfo específico
            var horaSolicitadaOnly = TimeOnly.FromTimeSpan(correccion.HoraSolicitada);
            var fechaHoraLocal = correccion.Fecha.ToDateTime(horaSolicitadaOnly);
            var fechaHoraCorreccionUtc = TimeZoneInfo.ConvertTimeToUtc(fechaHoraLocal, tz);

            var fechaUtcBuscada = DateOnly.FromDateTime(fechaHoraCorreccionUtc.Date);
            var marcacionOriginal = await _context.Marcaciones.FirstOrDefaultAsync(m =>
                m.IdUsuario == correccion.IdUsuario &&
                DateOnly.FromDateTime(m.FechaHora.Date) == fechaUtcBuscada &&
                m.Tipo == correccion.Tipo);

            if (marcacionOriginal != null)
            {
                marcacionOriginal.FechaHora = fechaHoraCorreccionUtc;
                // marcacionOriginal.Corregida = true; // Si decides añadir esta columna
            }
            else
            {
                var nuevaMarcacion = new Marcacion
                {
                    IdUsuario = correccion.IdUsuario,
                    FechaHora = fechaHoraCorreccionUtc,
                    Tipo = correccion.Tipo,
                    LatitudMarcacion = correccion.Usuario.Sede?.Lat ?? 0,
                    LongitudMarcacion = correccion.Usuario.Sede?.Lon ?? 0,
                    // Corregida = true // Si decides añadir esta columna
                };
                _context.Marcaciones.Add(nuevaMarcacion);
            }

            correccion.Estado = EstadoCorreccion.Aprobada;
            correccion.ReviewedAt = DateTimeOffset.UtcNow;
            correccion.ReviewedBy = idAdmin.Value;

            _context.Auditorias.Add(new Auditoria
            {
                IdUsuarioAdmin = idAdmin.Value,
                Accion = "correccion.approve",
                Entidad = "Correccion",
                EntidadId = correccion.Id,
                DataJson = JsonSerializer.Serialize(new { correccion.IdUsuario, correccion.Fecha, correccion.Tipo, correccion.HoraSolicitada })
            });

            await _context.SaveChangesAsync();
            return NoContent(); // 204 Éxito
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Ocurrió un error al aplicar la corrección: {ex.Message}");
        }
    }

    // PUT /api/correcciones/{id}/rechazar (Admin rechaza)
    /// <summary>
    /// Rechaza una solicitud de corrección pendiente. (Admin/SuperAdmin)
    /// </summary>
    [HttpPut("{id:int}/rechazar")]
    public async Task<IActionResult> RechazarCorreccion(int id)
    {
        // --- MODIFICADO: Incluir Usuario para verificar sede ---
        var correccion = await _context.Correcciones
                                  .Include(c => c.Usuario)
                                  .FirstOrDefaultAsync(c => c.Id == id);
        // --- FIN MODIFICADO ---

        if (correccion == null) return NotFound();
        if (correccion.Estado != EstadoCorreccion.Pendiente)
            return BadRequest($"La solicitud ya está en estado '{correccion.Estado}'.");

        var idAdmin = User.GetUserId();
        if (idAdmin is null) return Unauthorized("No se pudo identificar al administrador.");

        // --- LÓGICA DE SEDE AÑADIDA ---
        if (!User.IsSuperAdmin())
        {
            var sedeIdAdmin = User.GetSedeId() ?? 0;
            if (correccion.Usuario == null || correccion.Usuario.IdSede != sedeIdAdmin)
            {
                return Forbid("No puedes rechazar correcciones de usuarios de otra sede.");
            }
        }
        // --- FIN LÓGICA DE SEDE ---

        correccion.Estado = EstadoCorreccion.Rechazada;
        correccion.ReviewedAt = DateTimeOffset.UtcNow;
        correccion.ReviewedBy = idAdmin.Value;

        // --- Auditoría ---
        _context.Auditorias.Add(new Auditoria
        {
            IdUsuarioAdmin = idAdmin.Value,
            Accion = "correccion.reject",
            Entidad = "Correccion",
            EntidadId = correccion.Id,
            DataJson = JsonSerializer.Serialize(new { correccion.IdUsuario, correccion.Fecha, correccion.Tipo, correccion.HoraSolicitada })
        });
        // --- Fin Auditoría ---

        await _context.SaveChangesAsync();
        return NoContent(); // 204 Éxito
    }

    // DELETE /api/correcciones/{id} (Admin O Empleado borra las suyas)
    /// <summary>
    /// Elimina una solicitud de corrección (ej. solo pendientes o rechazadas).
    /// </summary>
    [HttpDelete("{id:int}")]
    [Authorize] // <-- MODIFICADO: Permite a todos los logueados, filtramos adentro
    public async Task<IActionResult> BorrarCorreccion(int id)
    {
        var correccion = await _context.Correcciones
                                 .Include(a => a.Usuario) // Necesario para chequeo de sede
                                 .FirstOrDefaultAsync(x => x.Id == id);
        if (correccion is null) return NotFound();

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
            if (correccion.Usuario != null && correccion.Usuario.IdSede == sedeIdAdmin)
            {
                tienePermiso = true;
            }
        }
        else // Es Empleado
        {
            // Empleado solo puede borrar las suyas PROPIAS
            // y solo si están pendientes o rechazadas
            if (correccion.IdUsuario == idUsuarioLogueado && (correccion.Estado == EstadoCorreccion.Pendiente || correccion.Estado == EstadoCorreccion.Rechazada))
            {
                tienePermiso = true;
            }
        }
        // --- FIN LÓGICA ---

        if (!tienePermiso)
        {
            return Forbid("No tienes permisos para borrar esta solicitud.");
        }

        _context.Correcciones.Remove(correccion);

        // --- Auditoría ---
        _context.Auditorias.Add(new Auditoria
        {
            IdUsuarioAdmin = idUsuarioLogueado.Value, // Quién borró
            Accion = "correccion.delete",
            Entidad = "Correccion",
            EntidadId = id, // ID de la borrada
            DataJson = JsonSerializer.Serialize(new { correccion.IdUsuario, correccion.Tipo, correccion.Fecha, correccion.Estado })
        });
        // --- Fin Auditoría ---

        await _context.SaveChangesAsync();
        return NoContent();
    }
}