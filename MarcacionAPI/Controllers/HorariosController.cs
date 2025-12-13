using MarcacionAPI.Data;
using MarcacionAPI.DTOs;
using MarcacionAPI.DTOs.Horarios;
using MarcacionAPI.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MarcacionAPI.Utils;
using System.Text.Json;

namespace MarcacionAPI.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class HorariosController : ControllerBase
{
    private readonly ApplicationDbContext _ctx;
    private readonly ILogger<HorariosController> _logger;

    public HorariosController(ApplicationDbContext ctx, ILogger<HorariosController> logger)
    {
        _ctx = ctx;
        _logger = logger;
    }

    // ============================================================
    // GET api/horarios
    // ============================================================
    [HttpGet]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> Get()
    {
        var query = _ctx.Horarios.AsNoTracking()
            .Include(h => h.Sede)
            .AsQueryable();

        if (!User.IsSuperAdmin())
        {
            var sedeIdAdmin = User.GetSedeId() ?? 0;
            query = query.Where(h => h.IdSede == null || h.IdSede == sedeIdAdmin);
        }

        var items = await query
            .Select(h => new
            {
                h.Id,
                h.Nombre,
                h.Activo,
                h.IdSede,
                h.PermitirCompensacion,
                SedeNombre = h.Sede != null ? h.Sede.Nombre : null
            })
            .OrderBy(h => h.Nombre)
            .ToListAsync();

        return Ok(items);
    }

    // ============================================================
    // GET api/horarios/{id}
    // ============================================================
    [HttpGet("{id:int}")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> GetById(int id)
    {
        var h = await _ctx.Horarios.AsNoTracking()
            .Include(x => x.Detalles)
            .Include(x => x.Sede)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (h is null) return NotFound();

        if (!User.IsSuperAdmin())
        {
            var sedeIdAdmin = User.GetSedeId() ?? 0;
            if (h.IdSede.HasValue && h.IdSede.Value != sedeIdAdmin)
                return Forbid("No puedes ver detalles de horarios de otra sede.");
        }

        return Ok(new
        {
            h.Id,
            h.Nombre,
            h.Activo,
            h.IdSede,
            h.PermitirCompensacion,
            SedeNombre = h.Sede?.Nombre,
            Detalles = h.Detalles
                .OrderBy(d => d.DiaSemana)
                .Select(d => new
                {
                    d.Id,
                    d.DiaSemana,
                    d.Laborable,
                    HoraEntrada = d.HoraEntrada.HasValue ? d.HoraEntrada.Value.ToString(@"hh\:mm") : null,
                    HoraSalida = d.HoraSalida.HasValue ? d.HoraSalida.Value.ToString(@"hh\:mm") : null,
                    d.ToleranciaMin,
                    d.RedondeoMin,
                    d.DescansoMin,
                    d.PermitirCompensacion
                })
        });
    }

    // ============================================================
    // POST api/horarios
    // ============================================================
    [HttpPost]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> Create([FromBody] HorarioCreateDto dto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto.Nombre))
                return BadRequest("Nombre requerido.");

            var idAdmin = User.GetUserId();
            if (idAdmin is null)
                return Unauthorized();

            // Parsear horas default
            TimeSpan tEntrada = TimeSpan.FromHours(8);
            TimeSpan tSalida = TimeSpan.FromHours(17);

            if (!string.IsNullOrEmpty(dto.HoraEntradaDefault))
                TimeSpan.TryParse(dto.HoraEntradaDefault, out tEntrada);

            if (!string.IsNullOrEmpty(dto.HoraSalidaDefault))
                TimeSpan.TryParse(dto.HoraSalidaDefault, out tSalida);

            // Crear horario
            var h = new Horario
            {
                Nombre = dto.Nombre.Trim(),
                Activo = dto.Activo,
                PermitirCompensacion = dto.PermitirCompensacion
            };

            // Asignación de sede
            if (User.IsSuperAdmin())
            {
                if (dto.IdSede.HasValue && dto.IdSede.Value > 0)
                {
                    if (!await _ctx.Sedes.AnyAsync(s => s.Id == dto.IdSede.Value))
                        return BadRequest("La Sede especificada no existe.");
                    h.IdSede = dto.IdSede.Value;
                }
            }
            else
            {
                var sedeIdAdmin = User.GetSedeId() ?? 0;
                if (sedeIdAdmin == 0)
                    return Forbid("Tu cuenta de admin no está asignada a una sede.");
                h.IdSede = sedeIdAdmin;
            }

            // Generar detalles automáticamente
            h.Detalles = new List<HorarioDetalle>();
            for (int dia = 1; dia <= 7; dia++)
            {
                bool esLaborable = dia <= 5;

                h.Detalles.Add(new HorarioDetalle
                {
                    DiaSemana = dia,
                    Laborable = esLaborable,
                    HoraEntrada = esLaborable ? tEntrada : null,
                    HoraSalida = esLaborable ? tSalida : null,
                    ToleranciaMin = dto.ToleranciaMinDefault,
                    DescansoMin = dto.DescansoMinDefault,
                    RedondeoMin = 0,
                    PermitirCompensacion = null
                });
            }

            _ctx.Horarios.Add(h);

            // ✅ GUARDAR PRIMERO
            await _ctx.SaveChangesAsync();

            // Auditoría (DESPUÉS de tener el ID)
            _ctx.Auditorias.Add(new Auditoria
            {
                IdUsuarioAdmin = idAdmin.Value,
                Accion = "horario.create",
                Entidad = "Horario",
                EntidadId = h.Id, // ✅ Ahora tiene ID
                DataJson = JsonSerializer.Serialize(new { h.Nombre, h.Activo, h.IdSede })
            });

            await _ctx.SaveChangesAsync();

            _logger.LogInformation("Horario creado: {Nombre} (ID: {Id})", h.Nombre, h.Id);

            return CreatedAtAction(nameof(GetById), new { id = h.Id }, new
            {
                h.Id,
                h.Nombre,
                Mensaje = "Creado con detalles por defecto."
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear horario");
            return StatusCode(500, new
            {
                mensaje = "Error al crear el horario",
                error = ex.Message,
                detalle = ex.InnerException?.Message ?? "Sin detalles"
            });
        }
    }

    // ============================================================
    // PUT api/horarios/{id}
    // ============================================================
    [HttpPut("{id:int}")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> Update(int id, [FromBody] HorarioUpdateDto dto)
    {
        try
        {
            var h = await _ctx.Horarios.FirstOrDefaultAsync(x => x.Id == id);
            if (h is null)
                return NotFound();

            var idAdmin = User.GetUserId();
            if (idAdmin is null)
                return Unauthorized();

            if (!User.IsSuperAdmin())
            {
                var sedeIdAdmin = User.GetSedeId() ?? 0;
                if (h.IdSede != sedeIdAdmin)
                    return Forbid("No puedes editar horarios globales o de otra sede.");

                if (dto.IdSede.HasValue && dto.IdSede != sedeIdAdmin)
                    return BadRequest("No puedes cambiar la sede a una distinta.");
            }
            else
            {
                if (dto.IdSede.HasValue && dto.IdSede.Value > 0)
                {
                    if (!await _ctx.Sedes.AnyAsync(s => s.Id == dto.IdSede.Value))
                        return BadRequest("La Sede indicada no existe.");
                    h.IdSede = dto.IdSede.Value;
                }
                else
                {
                    h.IdSede = null;
                }
            }

            h.Nombre = dto.Nombre.Trim();
            h.Activo = dto.Activo;
            h.PermitirCompensacion = dto.PermitirCompensacion;

            _ctx.Auditorias.Add(new Auditoria
            {
                IdUsuarioAdmin = idAdmin.Value,
                Accion = "horario.update",
                Entidad = "Horario",
                EntidadId = h.Id,
                DataJson = JsonSerializer.Serialize(dto)
            });

            await _ctx.SaveChangesAsync();

            _logger.LogInformation("Horario actualizado: {Id}", id);

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar horario {Id}", id);
            return StatusCode(500, new
            {
                mensaje = "Error al actualizar el horario",
                error = ex.Message
            });
        }
    }

    // ============================================================
    // PUT api/horarios/{id}/detalles
    // ============================================================
    [HttpPut("{id:int}/detalles")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> UpsertDetalles(int id, [FromBody] HorarioUpsertDetallesDto dto)
    {
        try
        {
            var h = await _ctx.Horarios
                .Include(x => x.Detalles)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (h is null)
                return NotFound();

            var idAdmin = User.GetUserId();
            if (idAdmin is null)
                return Unauthorized();

            if (!User.IsSuperAdmin())
            {
                var sedeIdAdmin = User.GetSedeId() ?? 0;
                if (h.IdSede != sedeIdAdmin)
                    return Forbid("No puedes editar detalles de horarios globales o de otra sede.");
            }

            if (dto.Detalles.Any(d => d.DiaSemana < 1 || d.DiaSemana > 7))
                return BadRequest("DiaSemana inválido (1..7).");

            if (dto.Detalles.Select(d => d.DiaSemana).Distinct().Count() != dto.Detalles.Count)
                return BadRequest("Días repetidos en detalles.");

            // Reemplazo completo
            _ctx.HorarioDetalles.RemoveRange(h.Detalles);

            foreach (var d in dto.Detalles)
            {
                if (d.Laborable && (d.HoraEntrada is null || d.HoraSalida is null))
                    return BadRequest($"Día {d.DiaSemana}: falta HoraEntrada/HoraSalida.");

                if (d.Laborable && d.HoraEntrada >= d.HoraSalida)
                    return BadRequest($"Día {d.DiaSemana}: HoraEntrada debe ser < HoraSalida.");

                h.Detalles.Add(new HorarioDetalle
                {
                    DiaSemana = d.DiaSemana,
                    Laborable = d.Laborable,
                    HoraEntrada = d.HoraEntrada,
                    HoraSalida = d.HoraSalida,
                    ToleranciaMin = d.ToleranciaMin.HasValue ? Math.Max(0, d.ToleranciaMin.Value) : null,
                    RedondeoMin = Math.Max(0, d.RedondeoMin),
                    DescansoMin = Math.Max(0, d.DescansoMin),
                    PermitirCompensacion = d.PermitirCompensacion
                });
            }

            _ctx.Auditorias.Add(new Auditoria
            {
                IdUsuarioAdmin = idAdmin.Value,
                Accion = "horario.update.detalles",
                Entidad = "Horario",
                EntidadId = h.Id,
                DataJson = JsonSerializer.Serialize(dto.Detalles)
            });

            await _ctx.SaveChangesAsync();

            _logger.LogInformation("Detalles de horario {Id} actualizados", id);

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar detalles del horario {Id}", id);
            return StatusCode(500, new
            {
                mensaje = "Error al actualizar los detalles",
                error = ex.Message
            });
        }
    }

    // ============================================================
    // DELETE api/horarios/{id}
    // ============================================================
    [HttpDelete("{id:int}")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> Delete(int id)
    {
        try
        {
            var h = await _ctx.Horarios.FirstOrDefaultAsync(x => x.Id == id);
            if (h is null)
                return NotFound();

            var idAdmin = User.GetUserId();
            if (idAdmin is null)
                return Unauthorized();

            if (!User.IsSuperAdmin())
            {
                var sedeIdAdmin = User.GetSedeId() ?? 0;
                if (h.IdSede != sedeIdAdmin)
                    return Forbid("No puedes eliminar horarios globales o de otra sede.");
            }

            var asignado = await _ctx.UsuarioHorarios.AnyAsync(uh => uh.IdHorario == id);
            if (asignado)
                return Conflict("No se puede eliminar: hay usuarios con este horario asignado.");

            var horarioData = new { h.Id, h.Nombre, h.IdSede };

            _ctx.Horarios.Remove(h);

            _ctx.Auditorias.Add(new Auditoria
            {
                IdUsuarioAdmin = idAdmin.Value,
                Accion = "horario.delete",
                Entidad = "Horario",
                EntidadId = id,
                DataJson = JsonSerializer.Serialize(horarioData)
            });

            await _ctx.SaveChangesAsync();

            _logger.LogWarning("Horario eliminado: {Id} - {Nombre}", id, h.Nombre);

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar horario {Id}", id);
            return StatusCode(500, new
            {
                mensaje = "Error al eliminar el horario",
                error = ex.Message
            });
        }
    }

    // ============================================================
    // GET api/horarios/mis-horarios-semana (APP MÓVIL)
    // ============================================================
    [HttpGet("mis-horarios-semana")]
    [Authorize]
    public async Task<IActionResult> GetMisHorariosSemana(
        [FromQuery] string desdeISO,
        [FromQuery] string hastaISO)
    {
        var idUsuario = User.GetUserId();
        if (idUsuario is null)
            return Unauthorized();

        if (!DateTimeOffset.TryParse(desdeISO, out var desde) ||
            !DateTimeOffset.TryParse(hastaISO, out var hasta))
        {
            return BadRequest("Formato de fecha inválido. Se espera ISO string.");
        }

        var diaInicio = DateOnly.FromDateTime(desde.Date);
        var diaFin = DateOnly.FromDateTime(hasta.Date);

        var diasRango = new List<DateOnly>();
        for (var d = diaInicio; d <= diaFin; d = d.AddDays(1))
            diasRango.Add(d);

        int Dow(DateOnly d) => ((int)d.DayOfWeek + 6) % 7 + 1;
        var diasSemana = diasRango.Select(Dow).Distinct().ToList();

        var asignaciones = await _ctx.UsuarioHorarios.AsNoTracking()
            .Where(uh => uh.IdUsuario == idUsuario.Value &&
                         uh.Desde <= diaFin &&
                         (uh.Hasta == null || uh.Hasta >= diaInicio))
            .Select(uh => new { uh.IdHorario, uh.Desde, uh.Hasta })
            .OrderBy(uh => uh.Desde)
            .ToListAsync();

        if (asignaciones.Count == 0)
            return Ok(new { items = new List<HorarioDetalleResponseDto>() });

        var horarioIds = asignaciones.Select(a => a.IdHorario).Distinct().ToList();

        var detalles = await (
            from d in _ctx.HorarioDetalles.AsNoTracking()
            join h in _ctx.Horarios.AsNoTracking() on d.IdHorario equals h.Id
            join s in _ctx.Sedes.AsNoTracking() on h.IdSede equals s.Id into sj
            from s in sj.DefaultIfEmpty()
            where horarioIds.Contains(d.IdHorario) && diasSemana.Contains(d.DiaSemana)
            select new
            {
                d.IdHorario,
                d.DiaSemana,
                d.Laborable,
                d.HoraEntrada,
                d.HoraSalida,
                d.ToleranciaMin,
                d.RedondeoMin,
                d.DescansoMin,
                HorarioNombre = h.Nombre,
                SedeNombre = (string?)s!.Nombre
            }
        ).ToListAsync();

        var detallesLookup = detalles
            .GroupBy(x => new { x.IdHorario, x.DiaSemana })
            .ToDictionary(g => (g.Key.IdHorario, g.Key.DiaSemana), g => g.First());

        var resultados = new List<HorarioDetalleResponseDto>();

        foreach (var dia in diasRango)
        {
            var vigente = asignaciones.FirstOrDefault(a =>
                a.Desde <= dia && (a.Hasta == null || a.Hasta >= dia));

            if (vigente is null) continue;

            var key = (vigente.IdHorario, Dow(dia));
            if (!detallesLookup.TryGetValue(key, out var det)) continue;

            if (det.Laborable && det.HoraEntrada.HasValue && det.HoraSalida.HasValue)
            {
                resultados.Add(new HorarioDetalleResponseDto
                {
                    Id = dia.DayNumber,
                    Dia = dia.ToString("yyyy-MM-dd"),
                    Desde = det.HoraEntrada.Value.ToString(@"hh\:mm\:ss"),
                    Hasta = det.HoraSalida.Value.ToString(@"hh\:mm\:ss"),
                    SedeNombre = det.SedeNombre,
                    Observacion = det.HorarioNombre
                });
            }
        }

        return Ok(new { items = resultados });
    }
}