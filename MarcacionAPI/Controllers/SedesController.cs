using MarcacionAPI.Data;
using MarcacionAPI.DTOs;
using MarcacionAPI.Models; // Añadido por si acaso
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MarcacionAPI.Utils; // Para Paging y Roles
using MarcacionAPI.DTOs.Sedes; // Para DTOs de Sedes

namespace MarcacionAPI.Controllers;

// --- MODIFICADO: Roles a nivel de clase ---
[Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")] // admin y superadmin pueden acceder
[ApiController]
[Route("api/[controller]")]
public class SedesController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public SedesController(ApplicationDbContext context) => _context = context;

    // GET api/sedes?search=&page=&pageSize=
    // [Authorize(Roles = "admin,superadmin")] -> Hereda de la clase
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? search,
        [FromQuery] int page = Paging.DefaultPage,
        [FromQuery] int pageSize = Paging.DefaultPageSize)
    {
        (page, pageSize) = Paging.Normalize(page, pageSize);

        var q = _context.Sedes.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            q = q.Where(x => x.Nombre.ToLower().Contains(s));
        }

        var total = await q.CountAsync();

        // Usuarios asignados a cada sede (subconsulta traducible por EF)
        var items = await q
            .OrderBy(x => x.Nombre)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.Id,
                x.Nombre,
                x.Lat,
                x.Lon,
                Usuarios = _context.Usuarios.Count(u => u.IdSede == x.Id)
            })
            .ToListAsync();

        return Ok(new PagedResponse<object>(items, total, page, pageSize));
    }

    // GET api/sedes/all  (para combos)
    // [Authorize(Roles = "admin,superadmin")] -> Hereda de la clase
    [HttpGet("all")]
    public async Task<IActionResult> GetAll()
    {
        var items = await _context.Sedes.AsNoTracking()
            .OrderBy(x => x.Nombre)
            .Select(x => new { x.Id, x.Nombre })
            .ToListAsync();
        return Ok(items);
    }

    // GET api/sedes/{id}
    // [Authorize(Roles = "admin,superadmin")] -> Hereda de la clase
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var s = await _context.Sedes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        return s is null ? NotFound() : Ok(s);
    }

    // POST api/sedes
    // --- AÑADIDO: Restringir solo a SuperAdmin ---
    [Authorize(Roles = Roles.SuperAdmin)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SedeCreateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nombre)) return BadRequest("Nombre es obligatorio.");

        var exists = await _context.Sedes.AnyAsync(x => x.Nombre == dto.Nombre);
        if (exists) return Conflict("Ya existe una sede con ese nombre.");

        if (dto.Lat is < -90 or > 90) return BadRequest("Latitud inválida.");
        if (dto.Lon is < -180 or > 180) return BadRequest("Longitud inválida.");

        var s = new Models.Sede { Nombre = dto.Nombre.Trim(), Lat = dto.Lat, Lon = dto.Lon };
        _context.Sedes.Add(s);
        // ... (Auditoría opcional aquí) ...
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = s.Id }, s);
    }

    // PUT api/sedes/{id}
    // --- AÑADIDO: Restringir solo a SuperAdmin ---
    [Authorize(Roles = Roles.SuperAdmin)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] SedeUpdateDto dto)
    {
        var s = await _context.Sedes.FirstOrDefaultAsync(x => x.Id == id);
        if (s is null) return NotFound();

        if (string.IsNullOrWhiteSpace(dto.Nombre)) return BadRequest("Nombre es obligatorio.");
        var exists = await _context.Sedes.AnyAsync(x => x.Id != id && x.Nombre == dto.Nombre);
        if (exists) return Conflict("Ya existe una sede con ese nombre.");

        if (dto.Lat is < -90 or > 90) return BadRequest("Latitud inválida.");
        if (dto.Lon is < -180 or > 180) return BadRequest("Longitud inválida.");

        s.Nombre = dto.Nombre.Trim();
        s.Lat = dto.Lat;
        s.Lon = dto.Lon;
        // ... (Auditoría opcional aquí) ...
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // PATCH api/sedes/{id}/coordenadas
    // --- AÑADIDO: Restringir solo a SuperAdmin ---
    [Authorize(Roles = Roles.SuperAdmin)]
    [HttpPatch("{id:int}/coordenadas")]
    public async Task<IActionResult> UpdateCoords(int id, [FromBody] SedeCoordsDto dto)
    {
        var s = await _context.Sedes.FirstOrDefaultAsync(x => x.Id == id);
        if (s is null) return NotFound();

        if (dto.Lat is < -90 or > 90) return BadRequest("Latitud inválida.");
        if (dto.Lon is < -180 or > 180) return BadRequest("Longitud inválida.");

        s.Lat = dto.Lat;
        s.Lon = dto.Lon;
        // ... (Auditoría opcional aquí) ...
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // DELETE api/sedes/{id}
    // --- AÑADIDO: Restringir solo a SuperAdmin ---
    [Authorize(Roles = Roles.SuperAdmin)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var s = await _context.Sedes.FirstOrDefaultAsync(x => x.Id == id);
        if (s is null) return NotFound();

        var tieneUsuarios = await _context.Usuarios.AnyAsync(u => u.IdSede == id);
        if (tieneUsuarios) return Conflict("No se puede eliminar: la sede tiene usuarios asignados.");

        _context.Sedes.Remove(s);
        // ... (Auditoría opcional aquí) ...
        await _context.SaveChangesAsync();
        return NoContent();
    }
}