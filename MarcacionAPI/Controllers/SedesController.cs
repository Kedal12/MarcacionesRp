using System;
using System.Linq;
using System.Linq.Expressions;
using System.Security.Claims;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using MarcacionAPI.Data;
using MarcacionAPI.DTOs;
using MarcacionAPI.DTOs.Sedes;
using MarcacionAPI.Models;
using MarcacionAPI.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace MarcacionAPI.Controllers;

[Authorize(Roles = "admin,superadmin")]
[ApiController]
[Route("api/[controller]")]
public class SedesController : ControllerBase
{
	private readonly ApplicationDbContext _context;

	private readonly ILogger<SedesController> _logger;

	public SedesController(ApplicationDbContext context, ILogger<SedesController> logger)
	{
		_context = context;
		_logger = logger;
	}

	[HttpGet]
	public async Task<IActionResult> Get([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
	{
		(int, int) tuple = Paging.Normalize(page, pageSize);
		page = tuple.Item1;
		pageSize = tuple.Item2;
		IQueryable<Sede> q = EntityFrameworkQueryableExtensions.AsNoTracking<Sede>((IQueryable<Sede>)_context.Sedes).AsQueryable();
		if (!string.IsNullOrWhiteSpace(search))
		{
			string s = search.Trim().ToLower();
			q = q.Where((Sede x) => x.Nombre.ToLower().Contains(s));
		}
		return Ok(new PagedResponse<object>(Total: await EntityFrameworkQueryableExtensions.CountAsync<Sede>(q, default(CancellationToken)), Items: await EntityFrameworkQueryableExtensions.ToListAsync(from x in q.OrderBy((Sede x) => x.Nombre).Skip((page - 1) * pageSize).Take(pageSize)
			select new
			{
				Id = x.Id,
				Nombre = x.Nombre,
				Lat = x.Lat,
				Lon = x.Lon,
				Usuarios = ((IQueryable<Usuario>)_context.Usuarios).Count((Usuario u) => u.IdSede == x.Id)
			}, default(CancellationToken)), Page: page, PageSize: pageSize));
	}

	[HttpGet("all")]
	public async Task<IActionResult> GetAll()
	{
		return Ok(await EntityFrameworkQueryableExtensions.ToListAsync(from x in EntityFrameworkQueryableExtensions.AsNoTracking<Sede>((IQueryable<Sede>)_context.Sedes)
			orderby x.Nombre
			select new { x.Id, x.Nombre }, default(CancellationToken)));
	}

	[HttpGet("{id:int}")]
	public async Task<IActionResult> GetById(int id)
	{
		Sede sede = await EntityFrameworkQueryableExtensions.FirstOrDefaultAsync<Sede>(EntityFrameworkQueryableExtensions.AsNoTracking<Sede>((IQueryable<Sede>)_context.Sedes), (Expression<Func<Sede, bool>>)((Sede x) => x.Id == id), default(CancellationToken));
		IActionResult result;
		if (sede != null)
		{
			IActionResult actionResult = Ok(sede);
			result = actionResult;
		}
		else
		{
			IActionResult actionResult = NotFound();
			result = actionResult;
		}
		return result;
	}

	[Authorize(Roles = "superadmin")]
	[HttpPost]
	public async Task<IActionResult> Create([FromBody] SedeCreateDto dto)
	{
		try
		{
			if (string.IsNullOrWhiteSpace(dto.Nombre))
			{
				return BadRequest("Nombre es obligatorio.");
			}
			if (await EntityFrameworkQueryableExtensions.AnyAsync<Sede>((IQueryable<Sede>)_context.Sedes, (Expression<Func<Sede, bool>>)((Sede x) => x.Nombre == dto.Nombre), default(CancellationToken)))
			{
				return Conflict("Ya existe una sede con ese nombre.");
			}
			decimal? lat = dto.Lat;
			bool flag;
			if (lat.HasValue)
			{
				decimal valueOrDefault = lat.GetValueOrDefault();
				if (valueOrDefault < -90m || valueOrDefault > 90m)
				{
					flag = true;
					goto IL_01b9;
				}
			}
			flag = false;
			goto IL_01b9;
			IL_01b9:
			if (flag)
			{
				return BadRequest("Latitud inválida.");
			}
			lat = dto.Lon;
			if (lat.HasValue)
			{
				decimal valueOrDefault = lat.GetValueOrDefault();
				if (valueOrDefault < -180m || valueOrDefault > 180m)
				{
					flag = true;
					goto IL_0220;
				}
			}
			flag = false;
			goto IL_0220;
			IL_0220:
			if (flag)
			{
				return BadRequest("Longitud inválida.");
			}
			Sede s = new Sede
			{
				Nombre = dto.Nombre.Trim(),
				Lat = dto.Lat,
				Lon = dto.Lon
			};
			_context.Sedes.Add(s);
			await ((DbContext)_context).SaveChangesAsync(default(CancellationToken));
			string s2 = base.User.FindFirstValue("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
			if (int.TryParse(s2, out var result))
			{
				_context.Auditorias.Add(new Auditoria
				{
					IdUsuarioAdmin = result,
					Accion = "sede.create",
					Entidad = "Sede",
					EntidadId = s.Id,
					DataJson = JsonSerializer.Serialize(new { s.Nombre, s.Lat, s.Lon })
				});
				await ((DbContext)_context).SaveChangesAsync(default(CancellationToken));
			}
			_logger.LogInformation("Sede creada: {Nombre} (ID: {Id})", s.Nombre, s.Id);
			return CreatedAtAction("GetById", new
			{
				id = s.Id
			}, s);
		}
		catch (DbUpdateException ex)
		{
			DbUpdateException ex2 = ex;
			_logger.LogError((Exception?)(object)ex2, "Error de base de datos al crear sede");
			return StatusCode(500, new
			{
				mensaje = "Error al guardar en la base de datos",
				error = (((Exception)(object)ex2).InnerException?.Message ?? ((Exception)(object)ex2).Message)
			});
		}
		catch (Exception ex3)
		{
			_logger.LogError(ex3, "Error inesperado al crear sede");
			return StatusCode(500, new
			{
				mensaje = "Error interno del servidor",
				error = ex3.Message,
				detalle = (ex3.InnerException?.Message ?? "Sin detalles")
			});
		}
	}

	[Authorize(Roles = "superadmin")]
	[HttpPut("{id:int}")]
	public async Task<IActionResult> Update(int id, [FromBody] SedeUpdateDto dto)
	{
		try
		{
			Sede s = await EntityFrameworkQueryableExtensions.FirstOrDefaultAsync<Sede>((IQueryable<Sede>)_context.Sedes, (Expression<Func<Sede, bool>>)((Sede x) => x.Id == id), default(CancellationToken));
			if (s == null)
			{
				return NotFound();
			}
			if (string.IsNullOrWhiteSpace(dto.Nombre))
			{
				return BadRequest("Nombre es obligatorio.");
			}
			if (await EntityFrameworkQueryableExtensions.AnyAsync<Sede>((IQueryable<Sede>)_context.Sedes, (Expression<Func<Sede, bool>>)((Sede x) => x.Id != id && x.Nombre == dto.Nombre), default(CancellationToken)))
			{
				return Conflict("Ya existe una sede con ese nombre.");
			}
			decimal? lat = dto.Lat;
			bool flag;
			if (lat.HasValue)
			{
				decimal valueOrDefault = lat.GetValueOrDefault();
				if (valueOrDefault < -90m || valueOrDefault > 90m)
				{
					flag = true;
					goto IL_0303;
				}
			}
			flag = false;
			goto IL_0303;
			IL_0303:
			if (flag)
			{
				return BadRequest("Latitud inválida.");
			}
			lat = dto.Lon;
			if (lat.HasValue)
			{
				decimal valueOrDefault = lat.GetValueOrDefault();
				if (valueOrDefault < -180m || valueOrDefault > 180m)
				{
					flag = true;
					goto IL_036a;
				}
			}
			flag = false;
			goto IL_036a;
			IL_036a:
			if (flag)
			{
				return BadRequest("Longitud inválida.");
			}
			s.Nombre = dto.Nombre.Trim();
			s.Lat = dto.Lat;
			s.Lon = dto.Lon;
			string s2 = base.User.FindFirstValue("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
			if (int.TryParse(s2, out var result))
			{
				_context.Auditorias.Add(new Auditoria
				{
					IdUsuarioAdmin = result,
					Accion = "sede.update",
					Entidad = "Sede",
					EntidadId = s.Id,
					DataJson = JsonSerializer.Serialize(dto)
				});
			}
			await ((DbContext)_context).SaveChangesAsync(default(CancellationToken));
			_logger.LogInformation("Sede actualizada: {Id}", id);
			return NoContent();
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error al actualizar sede {Id}", id);
			return StatusCode(500, new
			{
				mensaje = "Error al actualizar la sede",
				error = ex.Message
			});
		}
	}

	[Authorize(Roles = "superadmin")]
	[HttpPatch("{id:int}/coordenadas")]
	public async Task<IActionResult> UpdateCoords(int id, [FromBody] SedeCoordsDto dto)
	{
		try
		{
			Sede sede = await EntityFrameworkQueryableExtensions.FirstOrDefaultAsync<Sede>((IQueryable<Sede>)_context.Sedes, (Expression<Func<Sede, bool>>)((Sede x) => x.Id == id), default(CancellationToken));
			if (sede == null)
			{
				return NotFound();
			}
			decimal? lat = dto.Lat;
			bool flag;
			if (lat.HasValue)
			{
				decimal valueOrDefault = lat.GetValueOrDefault();
				if (valueOrDefault < -90m || valueOrDefault > 90m)
				{
					flag = true;
					goto IL_016e;
				}
			}
			flag = false;
			goto IL_016e;
			IL_01d0:
			if (flag)
			{
				return BadRequest("Longitud inválida.");
			}
			sede.Lat = dto.Lat;
			sede.Lon = dto.Lon;
			string s = base.User.FindFirstValue("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
			if (int.TryParse(s, out var result))
			{
				_context.Auditorias.Add(new Auditoria
				{
					IdUsuarioAdmin = result,
					Accion = "sede.update-coords",
					Entidad = "Sede",
					EntidadId = sede.Id,
					DataJson = JsonSerializer.Serialize(dto)
				});
			}
			await ((DbContext)_context).SaveChangesAsync(default(CancellationToken));
			_logger.LogInformation("Coordenadas de sede {Id} actualizadas", id);
			return NoContent();
			IL_016e:
			if (flag)
			{
				return BadRequest("Latitud inválida.");
			}
			lat = dto.Lon;
			if (lat.HasValue)
			{
				decimal valueOrDefault = lat.GetValueOrDefault();
				if (valueOrDefault < -180m || valueOrDefault > 180m)
				{
					flag = true;
					goto IL_01d0;
				}
			}
			flag = false;
			goto IL_01d0;
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error al actualizar coordenadas de sede {Id}", id);
			return StatusCode(500, new
			{
				mensaje = "Error al actualizar las coordenadas",
				error = ex.Message
			});
		}
	}

	[Authorize(Roles = "superadmin")]
	[HttpDelete("{id:int}")]
	public async Task<IActionResult> Delete(int id)
	{
		try
		{
			Sede s = await EntityFrameworkQueryableExtensions.FirstOrDefaultAsync<Sede>((IQueryable<Sede>)_context.Sedes, (Expression<Func<Sede, bool>>)((Sede x) => x.Id == id), default(CancellationToken));
			if (s == null)
			{
				return NotFound();
			}
			if (await EntityFrameworkQueryableExtensions.AnyAsync<Usuario>((IQueryable<Usuario>)_context.Usuarios, (Expression<Func<Usuario, bool>>)((Usuario u) => u.IdSede == id), default(CancellationToken)))
			{
				return Conflict("No se puede eliminar: la sede tiene usuarios asignados.");
			}
			var sedeData = new { s.Id, s.Nombre };
			_context.Sedes.Remove(s);
			string s2 = base.User.FindFirstValue("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
			if (int.TryParse(s2, out var result))
			{
				_context.Auditorias.Add(new Auditoria
				{
					IdUsuarioAdmin = result,
					Accion = "sede.delete",
					Entidad = "Sede",
					EntidadId = id,
					DataJson = JsonSerializer.Serialize(sedeData)
				});
			}
			await ((DbContext)_context).SaveChangesAsync(default(CancellationToken));
			_logger.LogWarning("Sede eliminada: {Id} - {Nombre}", id, sedeData.Nombre);
			return NoContent();
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error al eliminar sede {Id}", id);
			return StatusCode(500, new
			{
				mensaje = "Error al eliminar la sede",
				error = ex.Message
			});
		}
	}
}
