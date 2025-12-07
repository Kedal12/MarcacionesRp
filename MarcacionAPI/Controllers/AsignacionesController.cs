using MarcacionAPI.Data;
using MarcacionAPI.DTOs;
using MarcacionAPI.DTOs.Horarios;
using MarcacionAPI.Models;
using MarcacionAPI.Utils; // Roles y UserExtensions
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Linq;

namespace MarcacionAPI.Controllers;

[Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
[ApiController]
[Route("api/[controller]")]
public class AsignacionesController : ControllerBase
{
    private readonly ApplicationDbContext _ctx;

    public AsignacionesController(ApplicationDbContext ctx) => _ctx = ctx;

    // ========= Helpers zona y día (1=Lunes..7=Domingo) =========
    private static TimeZoneInfo TzBogota()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("America/Bogota"); }
        catch { return TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time"); }
    }

    private static int DiaSemana17(DateOnly fecha)
    {
        // Sunday=0..Saturday=6  => 1..7 (Mon..Sun)
        var dow = (int)fecha.ToDateTime(TimeOnly.MinValue).DayOfWeek;
        return dow == 0 ? 7 : dow;
    }

    // ========= DTO para previsualizar horario efectivo (solo desde Detalle) =========
    public sealed record HorarioVigenteDto(
        int IdHorario,
        string NombreHorario,
        int DiaSemana,
        TimeSpan? HoraEntrada,   // de HorarioDetalle
        TimeSpan? HoraSalida,    // de HorarioDetalle
        int? ToleranciaMin,      // de HorarioDetalle
        bool Laborable,
        int RedondeoMin,
        int DescansoMin
    );

    /// <summary>
    /// Resuelve el horario vigente del usuario para una fecha dada
    /// leyendo SIEMPRE de HorarioDetalles (JOIN) y evitando columnas
    /// inexistentes en la tabla Horarios.
    /// </summary>
    private async Task<HorarioVigenteDto?> ObtenerHorarioVigenteAsync(int idUsuario, DateOnly fecha)
    {
        int dia = DiaSemana17(fecha);

        var query =
            from uh in _ctx.UsuarioHorarios.AsNoTracking()
            join h in _ctx.Horarios.AsNoTracking() on uh.IdHorario equals h.Id
            join hd in _ctx.HorarioDetalles.AsNoTracking() on h.Id equals hd.IdHorario
            where uh.IdUsuario == idUsuario
               && uh.Desde <= fecha
               && (uh.Hasta == null || uh.Hasta >= fecha)
               && hd.DiaSemana == dia
            orderby uh.Desde descending
            select new HorarioVigenteDto(
                h.Id,
                h.Nombre,
                hd.DiaSemana,
                hd.HoraEntrada,
                hd.HoraSalida,
                hd.ToleranciaMin,
                hd.Laborable,
                hd.RedondeoMin,
                hd.DescansoMin
            );

        return await query.FirstOrDefaultAsync();
    }

    // ========================== GET: listar asignaciones ==========================
    // GET api/asignaciones?idUsuario=...
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] int idUsuario)
    {
        if (idUsuario <= 0) return BadRequest("idUsuario requerido.");

        // Seguridad por sede
        if (!User.IsSuperAdmin())
        {
            var sedeIdAdmin = User.GetSedeId() ?? 0;
            var idSedeUsuario = await _ctx.Usuarios.AsNoTracking()
                                    .Where(u => u.Id == idUsuario)
                                    .Select(u => u.IdSede)
                                    .FirstOrDefaultAsync();
            if (idSedeUsuario == 0 || idSedeUsuario != sedeIdAdmin)
                return Forbid("No puedes ver asignaciones de usuarios de otra sede.");
        }

        var items = await _ctx.UsuarioHorarios.AsNoTracking()
            .Include(uh => uh.Horario)
            .Where(uh => uh.IdUsuario == idUsuario)
            .OrderByDescending(uh => uh.Desde)
            .Select(uh => new
            {
                uh.Id,
                uh.IdUsuario,
                uh.IdHorario,
                Horario = uh.Horario.Nombre,
                uh.Desde,
                uh.Hasta
            })
            .ToListAsync();

        return Ok(items);
    }

    // =================== GET: horario vigente (JOIN a Detalles) ===================
    // GET api/asignaciones/horario-vigente?idUsuario=3&fecha=2025-11-11
    [HttpGet("horario-vigente")]
    public async Task<IActionResult> GetHorarioVigente([FromQuery] int idUsuario, [FromQuery] DateOnly? fecha)
    {
        if (idUsuario <= 0) return BadRequest("idUsuario requerido.");
        var tz = TzBogota();
        var fechaLocal = fecha ?? DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, tz).Date);

        // Seguridad por sede
        if (!User.IsSuperAdmin())
        {
            var sedeIdAdmin = User.GetSedeId() ?? 0;
            var idSedeUsuario = await _ctx.Usuarios.AsNoTracking()
                                    .Where(u => u.Id == idUsuario)
                                    .Select(u => u.IdSede)
                                    .FirstOrDefaultAsync();
            if (idSedeUsuario == 0 || idSedeUsuario != sedeIdAdmin)
                return Forbid("No puedes ver información de usuarios de otra sede.");
        }

        var vigente = await ObtenerHorarioVigenteAsync(idUsuario, fechaLocal);
        if (vigente is null)
            return NotFound("No existe asignación vigente o detalle de horario para la fecha dada.");

        return Ok(vigente);
    }

    // =============================== POST: asignar ================================
    // POST api/asignaciones
    [HttpPost]
    public async Task<IActionResult> Asignar([FromBody] AsignarHorarioDto dto)
    {
        if (dto.IdUsuario <= 0 || dto.IdHorario <= 0) return BadRequest("Ids inválidos.");
        if (dto.Hasta.HasValue && dto.Hasta.Value < dto.Desde) return BadRequest("Rango de fechas inválido.");

        var usuario = await _ctx.Usuarios
                                .FirstOrDefaultAsync(u => u.Id == dto.IdUsuario && u.Activo);

        // ← OJO: no materializamos columnas inexistentes de Horarios
        var horarioLite = await _ctx.Horarios
                                .AsNoTracking()
                                .Where(h => h.Id == dto.IdHorario && h.Activo)
                                .Select(h => new { h.Id, h.IdSede, h.Nombre })
                                .SingleOrDefaultAsync();

        if (usuario is null || horarioLite is null)
            return NotFound("Usuario u horario no válido o inactivo.");

        // Seguridad por sede
        if (!User.IsSuperAdmin())
        {
            var sedeIdAdmin = User.GetSedeId() ?? 0;

            if (usuario.IdSede != sedeIdAdmin)
                return Forbid("No puedes asignar horarios a usuarios de otra sede.");

            if (horarioLite.IdSede.HasValue && horarioLite.IdSede.Value != sedeIdAdmin)
                return Forbid("No puedes asignar un horario de otra sede.");
        }

        // Validar que el horario tenga al menos un detalle
        var tieneDetalles = await _ctx.HorarioDetalles
                                      .AsNoTracking()
                                      .AnyAsync(d => d.IdHorario == dto.IdHorario);
        if (!tieneDetalles)
            return BadRequest("El horario seleccionado no tiene detalles configurados.");

        // Validar solapes (intersección inclusiva)
        var haySolape = await _ctx.UsuarioHorarios.AnyAsync(uh =>
            uh.IdUsuario == dto.IdUsuario &&
            !(
                (uh.Hasta.HasValue && uh.Hasta.Value < dto.Desde) ||
                (dto.Hasta.HasValue && dto.Hasta.Value < uh.Desde)
             )
        );
        if (haySolape)
            return Conflict("Existe una asignación que se solapa con el rango indicado.");

        var uh = new UsuarioHorario
        {
            IdUsuario = dto.IdUsuario,
            IdHorario = dto.IdHorario,
            Desde = dto.Desde,
            Hasta = dto.Hasta
        };

        _ctx.UsuarioHorarios.Add(uh);
        await _ctx.SaveChangesAsync(); // ya tenemos uh.Id

        // Auditoría
        _ctx.Auditorias.Add(new Auditoria
        {
            IdUsuarioAdmin = User.GetUserId() ?? 0,
            Accion = "horario.assign",
            Entidad = "UsuarioHorario",
            EntidadId = uh.Id,
            DataJson = JsonSerializer.Serialize(dto)
        });
        await _ctx.SaveChangesAsync();

        return CreatedAtAction(nameof(Get), new { idUsuario = dto.IdUsuario }, new
        {
            uh.Id,
            uh.IdUsuario,
            uh.IdHorario,
            Horario = horarioLite.Nombre,
            uh.Desde,
            uh.Hasta
        });
    }

    // =============================== DELETE: borrar ===============================
    // DELETE api/asignaciones/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var uh = await _ctx.UsuarioHorarios
                           .Include(u => u.Usuario)
                           .FirstOrDefaultAsync(x => x.Id == id);
        if (uh is null) return NotFound();

        if (!User.IsSuperAdmin())
        {
            var sedeIdAdmin = User.GetSedeId() ?? 0;
            if (uh.Usuario == null || uh.Usuario.IdSede != sedeIdAdmin)
                return Forbid("No puedes eliminar asignaciones de usuarios de otra sede.");
        }

        _ctx.UsuarioHorarios.Remove(uh);
        await _ctx.SaveChangesAsync();

        _ctx.Auditorias.Add(new Auditoria
        {
            IdUsuarioAdmin = User.GetUserId() ?? 0,
            Accion = "horario.unassign",
            Entidad = "UsuarioHorario",
            EntidadId = id,
            DataJson = JsonSerializer.Serialize(new { uh.IdUsuario, uh.IdHorario, uh.Desde, uh.Hasta })
        });
        await _ctx.SaveChangesAsync();

        return NoContent();
    }
}
