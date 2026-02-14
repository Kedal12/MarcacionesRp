using System;
using System.Collections.Generic;
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
using Microsoft.Extensions.Logging;

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

	[HttpGet]
	[Authorize(Roles = "admin,superadmin")]
	public async Task<IActionResult> Get()
	{
		IQueryable<Horario> source = ((IEnumerable<Horario>)EntityFrameworkQueryableExtensions.Include<Horario, Sede>(EntityFrameworkQueryableExtensions.AsNoTracking<Horario>((IQueryable<Horario>)_ctx.Horarios), (Expression<Func<Horario, Sede>>)((Horario h) => h.Sede))).AsQueryable();
		if (!base.User.IsSuperAdmin())
		{
			int sedeIdAdmin = base.User.GetSedeId().GetValueOrDefault();
			source = source.Where((Horario h) => h.IdSede == (int?)null || h.IdSede == (int?)sedeIdAdmin);
		}
		return Ok(await EntityFrameworkQueryableExtensions.ToListAsync(from h in source
			select new
			{
				Id = h.Id,
				Nombre = h.Nombre,
				Activo = h.Activo,
				IdSede = h.IdSede,
				PermitirCompensacion = h.PermitirCompensacion,
				SedeNombre = ((h.Sede != null) ? h.Sede.Nombre : null)
			} into h
			orderby h.Nombre
			select h, default(CancellationToken)));
	}

	[HttpGet("{id:int}")]
	[Authorize(Roles = "admin,superadmin")]
	public async Task<IActionResult> GetById(int id)
	{
		Horario horario = await EntityFrameworkQueryableExtensions.FirstOrDefaultAsync<Horario>((IQueryable<Horario>)EntityFrameworkQueryableExtensions.Include<Horario, Sede>((IQueryable<Horario>)EntityFrameworkQueryableExtensions.Include<Horario, ICollection<HorarioDetalle>>(EntityFrameworkQueryableExtensions.AsNoTracking<Horario>((IQueryable<Horario>)_ctx.Horarios), (Expression<Func<Horario, ICollection<HorarioDetalle>>>)((Horario x) => x.Detalles)), (Expression<Func<Horario, Sede>>)((Horario x) => x.Sede)), (Expression<Func<Horario, bool>>)((Horario x) => x.Id == id), default(CancellationToken));
		if (horario == null)
		{
			return NotFound();
		}
		if (!base.User.IsSuperAdmin())
		{
			int valueOrDefault = base.User.GetSedeId().GetValueOrDefault();
			if (horario.IdSede.HasValue && horario.IdSede.Value != valueOrDefault)
			{
				return Forbid("No puedes ver detalles de horarios de otra sede.");
			}
		}
		return Ok(new
		{
			Id = horario.Id,
			Nombre = horario.Nombre,
			Activo = horario.Activo,
			IdSede = horario.IdSede,
			PermitirCompensacion = horario.PermitirCompensacion,
			SedeNombre = horario.Sede?.Nombre,
			Detalles = from d in horario.Detalles
				orderby d.DiaSemana
				select new
				{
					Id = d.Id,
					DiaSemana = d.DiaSemana,
					Laborable = d.Laborable,
					HoraEntrada = (d.HoraEntrada.HasValue ? d.HoraEntrada.Value.ToString("hh\\:mm") : null),
					HoraSalida = (d.HoraSalida.HasValue ? d.HoraSalida.Value.ToString("hh\\:mm") : null),
					ToleranciaMin = d.ToleranciaMin,
					RedondeoMin = d.RedondeoMin,
					DescansoMin = d.DescansoMin,
					PermitirCompensacion = d.PermitirCompensacion
				}
		});
	}

	[HttpPost]
	[Authorize(Roles = "admin,superadmin")]
	public async Task<IActionResult> Create([FromBody] HorarioCreateDto dto)
	{
		try
		{
			if (string.IsNullOrWhiteSpace(dto.Nombre))
			{
				return BadRequest("Nombre requerido.");
			}
			int? idAdmin = base.User.GetUserId();
			if (!idAdmin.HasValue)
			{
				return Unauthorized();
			}
			TimeSpan tEntrada = TimeSpan.FromHours(8.0);
			TimeSpan tSalida = TimeSpan.FromHours(17.0);
			if (!string.IsNullOrEmpty(dto.HoraEntradaDefault))
			{
				TimeSpan.TryParse(dto.HoraEntradaDefault, out tEntrada);
			}
			if (!string.IsNullOrEmpty(dto.HoraSalidaDefault))
			{
				TimeSpan.TryParse(dto.HoraSalidaDefault, out tSalida);
			}
			Horario h = new Horario
			{
				Nombre = dto.Nombre.Trim(),
				Activo = dto.Activo,
				PermitirCompensacion = dto.PermitirCompensacion
			};
			if (base.User.IsSuperAdmin())
			{
				if (dto.IdSede.HasValue && dto.IdSede.Value > 0)
				{
					if (!(await EntityFrameworkQueryableExtensions.AnyAsync<Sede>((IQueryable<Sede>)_ctx.Sedes, (Expression<Func<Sede, bool>>)((Sede s) => s.Id == dto.IdSede.Value), default(CancellationToken))))
					{
						return BadRequest("La Sede especificada no existe.");
					}
					h.IdSede = dto.IdSede.Value;
				}
			}
			else
			{
				int valueOrDefault = base.User.GetSedeId().GetValueOrDefault();
				if (valueOrDefault == 0)
				{
					return Forbid("Tu cuenta de admin no está asignada a una sede.");
				}
				h.IdSede = valueOrDefault;
			}
			h.Detalles = new List<HorarioDetalle>();
			for (int num = 1; num <= 7; num++)
			{
				bool flag = num <= 5;
				h.Detalles.Add(new HorarioDetalle
				{
					DiaSemana = num,
					Laborable = flag,
					HoraEntrada = (flag ? new TimeSpan?(tEntrada) : ((TimeSpan?)null)),
					HoraSalida = (flag ? new TimeSpan?(tSalida) : ((TimeSpan?)null)),
					ToleranciaMin = dto.ToleranciaMinDefault,
					DescansoMin = dto.DescansoMinDefault,
					RedondeoMin = 0,
					PermitirCompensacion = null
				});
			}
			_ctx.Horarios.Add(h);
			await ((DbContext)_ctx).SaveChangesAsync(default(CancellationToken));
			_ctx.Auditorias.Add(new Auditoria
			{
				IdUsuarioAdmin = idAdmin.Value,
				Accion = "horario.create",
				Entidad = "Horario",
				EntidadId = h.Id,
				DataJson = JsonSerializer.Serialize(new { h.Nombre, h.Activo, h.IdSede })
			});
			await ((DbContext)_ctx).SaveChangesAsync(default(CancellationToken));
			_logger.LogInformation("Horario creado: {Nombre} (ID: {Id})", h.Nombre, h.Id);
			return CreatedAtAction("GetById", new
			{
				id = h.Id
			}, new
			{
				Id = h.Id,
				Nombre = h.Nombre,
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
				detalle = (ex.InnerException?.Message ?? "Sin detalles")
			});
		}
	}

	[HttpPut("{id:int}")]
	[Authorize(Roles = "admin,superadmin")]
	public async Task<IActionResult> Update(int id, [FromBody] HorarioUpdateDto dto)
	{
		try
		{
			Horario h = await EntityFrameworkQueryableExtensions.FirstOrDefaultAsync<Horario>((IQueryable<Horario>)_ctx.Horarios, (Expression<Func<Horario, bool>>)((Horario x) => x.Id == id), default(CancellationToken));
			if (h == null)
			{
				return NotFound();
			}
			int? idAdmin = base.User.GetUserId();
			if (!idAdmin.HasValue)
			{
				return Unauthorized();
			}
			if (!base.User.IsSuperAdmin())
			{
				int valueOrDefault = base.User.GetSedeId().GetValueOrDefault();
				if (h.IdSede != valueOrDefault)
				{
					return Forbid("No puedes editar horarios globales o de otra sede.");
				}
				if (dto.IdSede.HasValue && dto.IdSede != valueOrDefault)
				{
					return BadRequest("No puedes cambiar la sede a una distinta.");
				}
			}
			else if (dto.IdSede.HasValue && dto.IdSede.Value > 0)
			{
				if (!(await EntityFrameworkQueryableExtensions.AnyAsync<Sede>((IQueryable<Sede>)_ctx.Sedes, (Expression<Func<Sede, bool>>)((Sede s) => s.Id == dto.IdSede.Value), default(CancellationToken))))
				{
					return BadRequest("La Sede indicada no existe.");
				}
				h.IdSede = dto.IdSede.Value;
			}
			else
			{
				h.IdSede = null;
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
			await ((DbContext)_ctx).SaveChangesAsync(default(CancellationToken));
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

	[HttpPut("{id:int}/detalles")]
	[Authorize(Roles = "admin,superadmin")]
	public async Task<IActionResult> UpsertDetalles(int id, [FromBody] HorarioUpsertDetallesDto dto)
	{
		try
		{
			Horario horario = await EntityFrameworkQueryableExtensions.FirstOrDefaultAsync<Horario>((IQueryable<Horario>)EntityFrameworkQueryableExtensions.Include<Horario, ICollection<HorarioDetalle>>((IQueryable<Horario>)_ctx.Horarios, (Expression<Func<Horario, ICollection<HorarioDetalle>>>)((Horario x) => x.Detalles)), (Expression<Func<Horario, bool>>)((Horario x) => x.Id == id), default(CancellationToken));
			if (horario == null)
			{
				return NotFound();
			}
			int? userId = base.User.GetUserId();
			if (!userId.HasValue)
			{
				return Unauthorized();
			}
			if (!base.User.IsSuperAdmin())
			{
				int valueOrDefault = base.User.GetSedeId().GetValueOrDefault();
				if (horario.IdSede != valueOrDefault)
				{
					return Forbid("No puedes editar detalles de horarios globales o de otra sede.");
				}
			}
			if (dto.Detalles.Any((HorarioDetalleDto d) => d.DiaSemana < 1 || d.DiaSemana > 7))
			{
				return BadRequest("DiaSemana inválido (1..7).");
			}
			if (dto.Detalles.Select((HorarioDetalleDto d) => d.DiaSemana).Distinct().Count() != dto.Detalles.Count)
			{
				return BadRequest("Días repetidos en detalles.");
			}
			_ctx.HorarioDetalles.RemoveRange((IEnumerable<HorarioDetalle>)horario.Detalles);
			foreach (HorarioDetalleDto detalle in dto.Detalles)
			{
				if (detalle.Laborable && (!detalle.HoraEntrada.HasValue || !detalle.HoraSalida.HasValue))
				{
					return BadRequest($"Día {detalle.DiaSemana}: falta HoraEntrada/HoraSalida.");
				}
				if (detalle.Laborable && detalle.HoraEntrada >= detalle.HoraSalida)
				{
					return BadRequest($"Día {detalle.DiaSemana}: HoraEntrada debe ser < HoraSalida.");
				}
				horario.Detalles.Add(new HorarioDetalle
				{
					DiaSemana = detalle.DiaSemana,
					Laborable = detalle.Laborable,
					HoraEntrada = detalle.HoraEntrada,
					HoraSalida = detalle.HoraSalida,
					ToleranciaMin = (detalle.ToleranciaMin.HasValue ? new int?(Math.Max(0, detalle.ToleranciaMin.Value)) : ((int?)null)),
					RedondeoMin = Math.Max(0, detalle.RedondeoMin),
					DescansoMin = Math.Max(0, detalle.DescansoMin),
					PermitirCompensacion = detalle.PermitirCompensacion
				});
			}
			_ctx.Auditorias.Add(new Auditoria
			{
				IdUsuarioAdmin = userId.Value,
				Accion = "horario.update.detalles",
				Entidad = "Horario",
				EntidadId = horario.Id,
				DataJson = JsonSerializer.Serialize(dto.Detalles)
			});
			await ((DbContext)_ctx).SaveChangesAsync(default(CancellationToken));
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

	[HttpDelete("{id:int}")]
	[Authorize(Roles = "admin,superadmin")]
	public async Task<IActionResult> Delete(int id)
	{
		try
		{
			Horario h = await EntityFrameworkQueryableExtensions.FirstOrDefaultAsync<Horario>((IQueryable<Horario>)_ctx.Horarios, (Expression<Func<Horario, bool>>)((Horario x) => x.Id == id), default(CancellationToken));
			if (h == null)
			{
				return NotFound();
			}
			int? idAdmin = base.User.GetUserId();
			if (!idAdmin.HasValue)
			{
				return Unauthorized();
			}
			if (!base.User.IsSuperAdmin())
			{
				int valueOrDefault = base.User.GetSedeId().GetValueOrDefault();
				if (h.IdSede != valueOrDefault)
				{
					return Forbid("No puedes eliminar horarios globales o de otra sede.");
				}
			}
			if (await EntityFrameworkQueryableExtensions.AnyAsync<UsuarioHorario>((IQueryable<UsuarioHorario>)_ctx.UsuarioHorarios, (Expression<Func<UsuarioHorario, bool>>)((UsuarioHorario uh) => uh.IdHorario == id), default(CancellationToken)))
			{
				return Conflict("No se puede eliminar: hay usuarios con este horario asignado.");
			}
			var value = new { h.Id, h.Nombre, h.IdSede };
			_ctx.Horarios.Remove(h);
			_ctx.Auditorias.Add(new Auditoria
			{
				IdUsuarioAdmin = idAdmin.Value,
				Accion = "horario.delete",
				Entidad = "Horario",
				EntidadId = id,
				DataJson = JsonSerializer.Serialize(value)
			});
			await ((DbContext)_ctx).SaveChangesAsync(default(CancellationToken));
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

	[HttpGet("mis-horarios-semana")]
	[Authorize]
	public async Task<IActionResult> GetMisHorariosSemana([FromQuery] string desdeISO, [FromQuery] string hastaISO)
	{
		int? idUsuario = base.User.GetUserId();
		if (!idUsuario.HasValue)
		{
			return Unauthorized();
		}
		if (!DateTimeOffset.TryParse(desdeISO, out var result) || !DateTimeOffset.TryParse(hastaISO, out var result2))
		{
			return BadRequest("Formato de fecha inválido. Se espera ISO string.");
		}
		DateOnly diaInicio = DateOnly.FromDateTime(result.Date);
		DateOnly diaFin = DateOnly.FromDateTime(result2.Date);
		List<DateOnly> diasRango = new List<DateOnly>();
		DateOnly dateOnly = diaInicio;
		while (dateOnly <= diaFin)
		{
			diasRango.Add(dateOnly);
			dateOnly = dateOnly.AddDays(1);
		}
		List<int> diasSemana = diasRango.Select(Dow).Distinct().ToList();
		var asignaciones = await EntityFrameworkQueryableExtensions.ToListAsync(from uh in EntityFrameworkQueryableExtensions.AsNoTracking<UsuarioHorario>((IQueryable<UsuarioHorario>)_ctx.UsuarioHorarios)
			where uh.IdUsuario == ((int?)idUsuario).Value && uh.Desde <= diaFin && (uh.Hasta == null || uh.Hasta >= diaInicio)
			select new { uh.IdHorario, uh.Desde, uh.Hasta } into uh
			orderby uh.Desde
			select uh, default(CancellationToken));
		if (asignaciones.Count == 0)
		{
			return Ok(new
			{
				items = new List<HorarioDetalleResponseDto>()
			});
		}
		List<int> horarioIds = asignaciones.Select(a => a.IdHorario).Distinct().ToList();
		var dictionary = (from x in await EntityFrameworkQueryableExtensions.ToListAsync(from d in EntityFrameworkQueryableExtensions.AsNoTracking<HorarioDetalle>((IQueryable<HorarioDetalle>)_ctx.HorarioDetalles)
				join h in EntityFrameworkQueryableExtensions.AsNoTracking<Horario>((IQueryable<Horario>)_ctx.Horarios) on d.IdHorario equals h.Id
				join s in EntityFrameworkQueryableExtensions.AsNoTracking<Sede>((IQueryable<Sede>)_ctx.Sedes) on h.IdSede equals s.Id into sj
				from s in sj.DefaultIfEmpty()
				where horarioIds.Contains(d.IdHorario) && diasSemana.Contains(d.DiaSemana)
				select new
				{
					IdHorario = d.IdHorario,
					DiaSemana = d.DiaSemana,
					Laborable = d.Laborable,
					HoraEntrada = d.HoraEntrada,
					HoraSalida = d.HoraSalida,
					ToleranciaMin = d.ToleranciaMin,
					RedondeoMin = d.RedondeoMin,
					DescansoMin = d.DescansoMin,
					HorarioNombre = h.Nombre,
					SedeNombre = s.Nombre
				}, default(CancellationToken))
			group x by new { x.IdHorario, x.DiaSemana }).ToDictionary(g => (IdHorario: g.Key.IdHorario, DiaSemana: g.Key.DiaSemana), g => g.First());
		List<HorarioDetalleResponseDto> list = new List<HorarioDetalleResponseDto>();
		foreach (DateOnly dia in diasRango)
		{
			var anon = asignaciones.FirstOrDefault(a => a.Desde <= dia && (!a.Hasta.HasValue || a.Hasta >= dia));
			if (anon != null)
			{
				(int, int) key = (anon.IdHorario, Dow(dia));
				if (dictionary.TryGetValue(key, out var value) && value.Laborable && value.HoraEntrada.HasValue && value.HoraSalida.HasValue)
				{
					list.Add(new HorarioDetalleResponseDto
					{
						Id = dia.DayNumber,
						Dia = dia.ToString("yyyy-MM-dd"),
						Desde = value.HoraEntrada.Value.ToString("hh\\:mm\\:ss"),
						Hasta = value.HoraSalida.Value.ToString("hh\\:mm\\:ss"),
						SedeNombre = value.SedeNombre,
						Observacion = value.HorarioNombre
					});
				}
			}
		}
		return Ok(new
		{
			items = list
		});
		static int Dow(DateOnly d)
		{
			return (int)(d.DayOfWeek + 6) % 7 + 1;
		}
	}
}
