using System;
using System.Linq;
using System.Linq.Expressions;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using MarcacionAPI.Data;
using MarcacionAPI.DTOs.Horarios;
using MarcacionAPI.Models;
using MarcacionAPI.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MarcacionAPI.Controllers;

[Authorize(Roles = "admin,superadmin")]
[ApiController]
[Route("api/[controller]")]
public class AsignacionesController : ControllerBase
{
    public sealed record HorarioVigenteDto(int IdHorario, string NombreHorario, int DiaSemana, TimeSpan? HoraEntrada, TimeSpan? HoraSalida, int? ToleranciaMin, bool Laborable, int RedondeoMin, int DescansoMin);

    private readonly ApplicationDbContext _ctx;

    public AsignacionesController(ApplicationDbContext ctx)
    {
        _ctx = ctx;
    }

    private static TimeZoneInfo TzBogota()
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

    private static int DiaSemana17(DateOnly fecha)
    {
        int dayOfWeek = (int)fecha.ToDateTime(TimeOnly.MinValue).DayOfWeek;
        if (dayOfWeek != 0)
        {
            return dayOfWeek;
        }
        return 7;
    }

    private async Task<HorarioVigenteDto?> ObtenerHorarioVigenteAsync(int idUsuario, DateOnly fecha)
    {
        int dia = DiaSemana17(fecha);
        IQueryable<HorarioVigenteDto> queryable = from uh in EntityFrameworkQueryableExtensions.AsNoTracking<UsuarioHorario>((IQueryable<UsuarioHorario>)_ctx.UsuarioHorarios)
                                                  join h in EntityFrameworkQueryableExtensions.AsNoTracking<Horario>((IQueryable<Horario>)_ctx.Horarios) on uh.IdHorario equals h.Id
                                                  join hd in EntityFrameworkQueryableExtensions.AsNoTracking<HorarioDetalle>((IQueryable<HorarioDetalle>)_ctx.HorarioDetalles) on h.Id equals hd.IdHorario
                                                  where uh.IdUsuario == idUsuario && uh.Desde <= fecha && (uh.Hasta == null || uh.Hasta >= fecha) && hd.DiaSemana == dia
                                                  orderby uh.Desde descending
                                                  select new HorarioVigenteDto(h.Id, h.Nombre, hd.DiaSemana, hd.HoraEntrada, hd.HoraSalida, hd.ToleranciaMin, hd.Laborable, hd.RedondeoMin, hd.DescansoMin);
        return await EntityFrameworkQueryableExtensions.FirstOrDefaultAsync<HorarioVigenteDto>(queryable, default(CancellationToken));
    }

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] int idUsuario)
    {
        if (idUsuario <= 0)
        {
            return BadRequest("idUsuario requerido.");
        }
        if (!base.User.IsSuperAdmin())
        {
            int sedeIdAdmin = base.User.GetSedeId().GetValueOrDefault();
            int num = await EntityFrameworkQueryableExtensions.FirstOrDefaultAsync<int>(from u in EntityFrameworkQueryableExtensions.AsNoTracking<Usuario>((IQueryable<Usuario>)_ctx.Usuarios)
                                                                                        where u.Id == idUsuario
                                                                                        select u.IdSede, default(CancellationToken));
            if (num == 0 || num != sedeIdAdmin)
            {
                return Forbid("No puedes ver asignaciones de usuarios de otra sede.");
            }
        }
        return Ok(await EntityFrameworkQueryableExtensions.ToListAsync(from uh in (IQueryable<UsuarioHorario>)EntityFrameworkQueryableExtensions.Include<UsuarioHorario, Horario>(EntityFrameworkQueryableExtensions.AsNoTracking<UsuarioHorario>((IQueryable<UsuarioHorario>)_ctx.UsuarioHorarios), (Expression<Func<UsuarioHorario, Horario>>)((UsuarioHorario uh) => uh.Horario))
                                                                       where uh.IdUsuario == idUsuario
                                                                       orderby uh.Desde descending
                                                                       select new
                                                                       {
                                                                           Id = uh.Id,
                                                                           IdUsuario = uh.IdUsuario,
                                                                           IdHorario = uh.IdHorario,
                                                                           Horario = uh.Horario.Nombre,
                                                                           Desde = uh.Desde,
                                                                           Hasta = uh.Hasta
                                                                       }, default(CancellationToken)));
    }

    [HttpGet("horario-vigente")]
    public async Task<IActionResult> GetHorarioVigente([FromQuery] int idUsuario, [FromQuery] DateOnly? fecha)
    {
        if (idUsuario <= 0)
        {
            return BadRequest("idUsuario requerido.");
        }
        TimeZoneInfo destinationTimeZone = TzBogota();
        DateOnly fechaLocal = fecha ?? DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, destinationTimeZone).Date);
        if (!base.User.IsSuperAdmin())
        {
            int sedeIdAdmin = base.User.GetSedeId().GetValueOrDefault();
            int num = await EntityFrameworkQueryableExtensions.FirstOrDefaultAsync<int>(from u in EntityFrameworkQueryableExtensions.AsNoTracking<Usuario>((IQueryable<Usuario>)_ctx.Usuarios)
                                                                                        where u.Id == idUsuario
                                                                                        select u.IdSede, default(CancellationToken));
            if (num == 0 || num != sedeIdAdmin)
            {
                return Forbid("No puedes ver información de usuarios de otra sede.");
            }
        }
        HorarioVigenteDto horarioVigenteDto = await ObtenerHorarioVigenteAsync(idUsuario, fechaLocal);
        if ((object)horarioVigenteDto == null)
        {
            return NotFound("No existe asignación vigente o detalle de horario para la fecha dada.");
        }
        return Ok(horarioVigenteDto);
    }

    [HttpPost]
    public async Task<IActionResult> Asignar([FromBody] AsignarHorarioDto dto)
    {
        // 1. Validaciones iniciales
        if (dto.IdUsuario <= 0 || dto.IdHorario <= 0) return BadRequest("Ids inválidos.");
        if (dto.Hasta.HasValue && dto.Hasta.Value < dto.Desde) return BadRequest("Rango de fechas inválido.");

        // 2. Verificación de existencia
        var usuario = await _ctx.Usuarios.FirstOrDefaultAsync(u => u.Id == dto.IdUsuario && u.Activo);
        var horarioLite = await _ctx.Horarios.AsNoTracking()
            .Where(h => h.Id == dto.IdHorario && h.Activo)
            .Select(h => new { h.Id, h.IdSede, h.Nombre }).SingleOrDefaultAsync();

        if (usuario == null || horarioLite == null) return NotFound("Usuario u horario no válido.");

        // 3. Validación de permisos (Sedes)
        if (!base.User.IsSuperAdmin())
        {
            int sedeIdAdmin = base.User.GetSedeId().GetValueOrDefault();
            if (usuario.IdSede != sedeIdAdmin || (horarioLite.IdSede.HasValue && horarioLite.IdSede.Value != sedeIdAdmin))
                return Forbid("No tienes permisos para esta sede.");
        }

        // --- LÓGICA DE AJUSTE PARA ROTACIONES ---

        // Buscamos solapados (Importante: SIN AsNoTracking para poder editarlos)
        var solapados = await _ctx.UsuarioHorarios
            .Where(uh => uh.IdUsuario == dto.IdUsuario &&
                         !((uh.Hasta.HasValue && uh.Hasta.Value < dto.Desde) ||
                           (dto.Hasta.HasValue && dto.Hasta.Value < uh.Desde)))
            .ToListAsync();

        foreach (var existing in solapados)
        {
            if (dto.Desde <= existing.Desde && (dto.Hasta == null || (existing.Hasta != null && dto.Hasta >= existing.Hasta)))
            {
                _ctx.UsuarioHorarios.Remove(existing);
            }
            else if (dto.Desde > existing.Desde && (existing.Hasta == null || (dto.Hasta.HasValue && dto.Hasta.Value < existing.Hasta.Value)))
            {
                var parteFinal = new UsuarioHorario
                {
                    IdUsuario = existing.IdUsuario,
                    IdHorario = existing.IdHorario,
                    Desde = dto.Hasta.Value.AddDays(1),
                    Hasta = existing.Hasta
                };
                existing.Hasta = dto.Desde.AddDays(-1);
                _ctx.UsuarioHorarios.Add(parteFinal);
            }
            else if (dto.Desde <= existing.Desde) existing.Desde = dto.Hasta.Value.AddDays(1);
            else existing.Hasta = dto.Desde.AddDays(-1);
        }

        // *** CAMBIO CLAVE: Guardar primero los recortes ***
        await _ctx.SaveChangesAsync();

        // 6. Crear la nueva asignación
        UsuarioHorario uh = new UsuarioHorario
        {
            IdUsuario = dto.IdUsuario,
            IdHorario = dto.IdHorario,
            Desde = dto.Desde,
            Hasta = dto.Hasta
        };

        _ctx.UsuarioHorarios.Add(uh);
        await _ctx.SaveChangesAsync();

        // 7. Auditoría
        _ctx.Auditorias.Add(new Auditoria
        {
            IdUsuarioAdmin = base.User.GetUserId().GetValueOrDefault(),
            Accion = "horario.assign",
            Entidad = "UsuarioHorario",
            EntidadId = uh.Id,
            DataJson = JsonSerializer.Serialize(dto)
        });
        await _ctx.SaveChangesAsync();

        return CreatedAtAction("Get", new { idUsuario = dto.IdUsuario }, new
        {
            Id = uh.Id,
            Horario = horarioLite.Nombre,
            Desde = uh.Desde,
            Hasta = uh.Hasta
        });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        UsuarioHorario uh = await EntityFrameworkQueryableExtensions.FirstOrDefaultAsync<UsuarioHorario>((IQueryable<UsuarioHorario>)EntityFrameworkQueryableExtensions.Include<UsuarioHorario, Usuario>((IQueryable<UsuarioHorario>)_ctx.UsuarioHorarios, (Expression<Func<UsuarioHorario, Usuario>>)((UsuarioHorario u) => u.Usuario)), (Expression<Func<UsuarioHorario, bool>>)((UsuarioHorario x) => x.Id == id), default(CancellationToken));
        if (uh == null)
        {
            return NotFound();
        }
        if (!base.User.IsSuperAdmin())
        {
            int valueOrDefault = base.User.GetSedeId().GetValueOrDefault();
            if (uh.Usuario == null || uh.Usuario.IdSede != valueOrDefault)
            {
                return Forbid("No puedes eliminar asignaciones de usuarios de otra sede.");
            }
        }
        _ctx.UsuarioHorarios.Remove(uh);
        await ((DbContext)_ctx).SaveChangesAsync(default(CancellationToken));
        _ctx.Auditorias.Add(new Auditoria
        {
            IdUsuarioAdmin = base.User.GetUserId().GetValueOrDefault(),
            Accion = "horario.unassign",
            Entidad = "UsuarioHorario",
            EntidadId = id,
            DataJson = JsonSerializer.Serialize(new { uh.IdUsuario, uh.IdHorario, uh.Desde, uh.Hasta })
        });
        await ((DbContext)_ctx).SaveChangesAsync(default(CancellationToken));
        return NoContent();
    }
}