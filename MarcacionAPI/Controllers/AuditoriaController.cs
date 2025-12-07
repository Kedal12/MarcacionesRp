using MarcacionAPI.Data;
using MarcacionAPI.DTOs;
using MarcacionAPI.DTOs.Auditoria;
using MarcacionAPI.Utils; // Para Paging y Roles
using MarcacionAPI.Models; // Para PagedResponse
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic; // Para PagedResponse

namespace MarcacionAPI.Controllers;

// --- MODIFICADO: Restringido solo a SuperAdmin ---
[Authorize(Roles = Roles.SuperAdmin)]
[ApiController]
[Route("api/[controller]")]
public class AuditoriaController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public AuditoriaController(ApplicationDbContext context)
    {
        _context = context;
    }

    // GET /api/auditoria
    /// <summary>
    /// Obtiene los registros de auditoría con filtros y paginación.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<PagedResponse<AuditoriaListadoDto>>> GetAuditorias(
        [FromQuery] AuditoriaFiltroDto filtro)
    {
        (int page, int pageSize) = Paging.Normalize(filtro.Page, filtro.PageSize);

        var query = _context.Auditorias.AsNoTracking()
                                // Opcional: Si quieres mostrar el nombre del admin que hizo la acción,
                                // necesitarías añadir la relación virtual en Auditoria.cs
                                // y hacer .Include(a => a.UsuarioAdmin)
                                .AsQueryable();

        // SuperAdmin puede ver todo, así que no aplicamos filtro de sede.

        // Aplicar filtros (usando filtro original)
        if (filtro.IdUsuarioAdmin.HasValue)
            query = query.Where(a => a.IdUsuarioAdmin == filtro.IdUsuarioAdmin.Value);
        if (!string.IsNullOrWhiteSpace(filtro.Accion))
            query = query.Where(a => a.Accion.Contains(filtro.Accion));
        if (!string.IsNullOrWhiteSpace(filtro.Entidad))
            query = query.Where(a => a.Entidad == filtro.Entidad);
        if (filtro.EntidadId.HasValue)
            query = query.Where(a => a.EntidadId == filtro.EntidadId.Value);
        if (filtro.Desde.HasValue)
            query = query.Where(a => a.Fecha >= filtro.Desde.Value);
        if (filtro.Hasta.HasValue)
            query = query.Where(a => a.Fecha <= filtro.Hasta.Value);

        // Contar total ANTES de paginar
        var total = await query.CountAsync();

        // Ordenar, paginar y seleccionar DTO
        var items = await query
                                .OrderByDescending(a => a.Fecha) // Más recientes primero
                                .Skip((page - 1) * pageSize)
                                .Take(pageSize)
                                .Select(a => new AuditoriaListadoDto(
                                    a.Id,
                                    a.Fecha,
                                    a.IdUsuarioAdmin,
                                    // Si incluyes UsuarioAdmin: a.UsuarioAdmin != null ? a.UsuarioAdmin.NombreCompleto : a.IdUsuarioAdmin.ToString(),
                                    a.IdUsuarioAdmin.ToString(), // Placeholder simple
                                    a.Accion,
                                    a.Entidad,
                                    a.EntidadId,
                                    a.DataJson
                                ))
                                .ToListAsync();

        return Ok(new PagedResponse<AuditoriaListadoDto>(items, total, page, pageSize));
    }
}