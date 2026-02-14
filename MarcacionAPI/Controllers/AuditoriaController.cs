using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MarcacionAPI.Data;
using MarcacionAPI.DTOs;
using MarcacionAPI.DTOs.Auditoria;
using MarcacionAPI.Models;
using MarcacionAPI.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MarcacionAPI.Controllers;

[Authorize(Roles = "superadmin")]
[ApiController]
[Route("api/[controller]")]
public class AuditoriaController : ControllerBase
{
	private readonly ApplicationDbContext _context;

	public AuditoriaController(ApplicationDbContext context)
	{
		_context = context;
	}

	[HttpGet]
	public async Task<ActionResult<PagedResponse<AuditoriaListadoDto>>> GetAuditorias([FromQuery] AuditoriaFiltroDto filtro)
	{
		(int, int) tuple = Paging.Normalize(filtro.Page, filtro.PageSize);
		int page = tuple.Item1;
		int pageSize = tuple.Item2;
		IQueryable<Auditoria> query = EntityFrameworkQueryableExtensions.AsNoTracking<Auditoria>((IQueryable<Auditoria>)_context.Auditorias).AsQueryable();
		if (filtro.IdUsuarioAdmin.HasValue)
		{
			query = query.Where((Auditoria a) => a.IdUsuarioAdmin == filtro.IdUsuarioAdmin.Value);
		}
		if (!string.IsNullOrWhiteSpace(filtro.Accion))
		{
			query = query.Where((Auditoria a) => a.Accion.Contains(filtro.Accion));
		}
		if (!string.IsNullOrWhiteSpace(filtro.Entidad))
		{
			query = query.Where((Auditoria a) => a.Entidad == filtro.Entidad);
		}
		if (filtro.EntidadId.HasValue)
		{
			query = query.Where((Auditoria a) => a.EntidadId == filtro.EntidadId.Value);
		}
		if (filtro.Desde.HasValue)
		{
			query = query.Where((Auditoria a) => a.Fecha >= filtro.Desde.Value);
		}
		if (filtro.Hasta.HasValue)
		{
			query = query.Where((Auditoria a) => a.Fecha <= filtro.Hasta.Value);
		}
		return Ok(new PagedResponse<AuditoriaListadoDto>(Total: await EntityFrameworkQueryableExtensions.CountAsync<Auditoria>(query, default(CancellationToken)), Items: await EntityFrameworkQueryableExtensions.ToListAsync<AuditoriaListadoDto>(from a in query.OrderByDescending((Auditoria a) => a.Fecha).Skip((page - 1) * pageSize).Take(pageSize)
			select new AuditoriaListadoDto(a.Id, a.Fecha, a.IdUsuarioAdmin, a.IdUsuarioAdmin.ToString(), a.Accion, a.Entidad, a.EntidadId, a.DataJson), default(CancellationToken)), Page: page, PageSize: pageSize));
	}
}
