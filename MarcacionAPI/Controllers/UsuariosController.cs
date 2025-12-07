using MarcacionAPI.Data;
using MarcacionAPI.DTOs;
using MarcacionAPI.Models;
using MarcacionAPI.Utils; // ← Para usar IsSuperAdmin() y GetSedeId()
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace MarcacionAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "superadmin,admin")] // ← Cambiado: ahora acepta ambos roles
public class UsuariosController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public UsuariosController(ApplicationDbContext context) => _context = context;

    // GET /api/usuarios?search=&idSede=&page=1&pageSize=10
    [HttpGet]
    public async Task<ActionResult<PagedResponse<UsuarioListadoDto>>> Get(
        [FromQuery] string? search,
        [FromQuery] int? idSede,
        [FromQuery] int page = Paging.DefaultPage,
        [FromQuery] int pageSize = Paging.DefaultPageSize)
    {
        (page, pageSize) = Paging.Normalize(page, pageSize);

        var q = _context.Usuarios
            .Include(u => u.Sede)
            .AsNoTracking()
            .Where(u => u.Activo) // Solo usuarios activos
            .AsQueryable();

        // *** FILTRO POR SEDE ***
        if (!User.IsSuperAdmin())
        {
            // Admin de sede: solo ve usuarios de su sede
            var sedeId = User.GetSedeId() ?? 0;
            q = q.Where(u => u.IdSede == sedeId);
        }
        else if (idSede.HasValue && idSede.Value > 0)
        {
            // Superadmin: puede filtrar por sede opcional
            q = q.Where(u => u.IdSede == idSede.Value);
        }

        // Filtro de búsqueda
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            q = q.Where(u =>
                u.NombreCompleto.ToLower().Contains(s) ||
                u.Email.ToLower().Contains(s));
        }

        var total = await q.CountAsync();

        var items = await q
            .OrderBy(u => u.NombreCompleto)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new UsuarioListadoDto
            {
                Id = u.Id,
                NombreCompleto = u.NombreCompleto,
                Email = u.Email,
                Rol = u.Rol,
                IdSede = u.IdSede,
                SedeNombre = u.Sede!.Nombre,
                Activo = u.Activo
            })
            .ToListAsync();

        return Ok(new PagedResponse<UsuarioListadoDto>(items, total, page, pageSize));
    }

    // GET /api/usuarios/{id}
    [HttpGet("{id:int}")]
    public async Task<ActionResult<UsuarioListadoDto>> GetById(int id)
    {
        var u = await _context.Usuarios
            .Include(x => x.Sede)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id);

        if (u is null) return NotFound();

        // *** VERIFICAR ACCESO POR SEDE ***
        if (!User.IsSuperAdmin())
        {
            var sedeId = User.GetSedeId() ?? -1;
            if (u.IdSede != sedeId)
                return Forbid(); // Admin no puede ver usuarios de otra sede
        }

        return Ok(new UsuarioListadoDto
        {
            Id = u.Id,
            NombreCompleto = u.NombreCompleto,
            Email = u.Email,
            Rol = u.Rol,
            IdSede = u.IdSede,
            SedeNombre = u.Sede!.Nombre,
            Activo = u.Activo
        });
    }

    // POST /api/usuarios/{id}/reset-password
    [HttpPost("{id:int}/reset-password")]
    public async Task<IActionResult> ResetPassword(int id, [FromBody] ResetPasswordDto dto)
    {
        var u = await _context.Usuarios.FirstOrDefaultAsync(x => x.Id == id);
        if (u is null) return NotFound();

        // *** VERIFICAR ACCESO POR SEDE ***
        if (!User.IsSuperAdmin())
        {
            var sedeId = User.GetSedeId() ?? -1;
            if (u.IdSede != sedeId)
                return Forbid(); // Admin no puede resetear contraseña de otra sede
        }

        if (dto.NewPassword.Length < 6)
            return BadRequest("La nueva contraseña es muy corta (mínimo 6 caracteres).");

        u.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);

        // Auditoría
        var idAdminClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(idAdminClaim))
            return Unauthorized("No se pudo identificar al administrador.");

        _context.Auditorias.Add(new Auditoria
        {
            IdUsuarioAdmin = int.Parse(idAdminClaim),
            Accion = "usuario.resetpass",
            Entidad = "Usuario",
            EntidadId = u.Id,
            DataJson = "{\"note\":\"reset desde panel\"}"
        });

        await _context.SaveChangesAsync();
        return NoContent();
    }

    // POST /api/usuarios
    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] UsuarioCrearDto dto)
    {
        if (await _context.Usuarios.AnyAsync(u => u.Email == dto.Email))
            return BadRequest("El email ya está registrado.");

        // *** RESTRICCIONES POR ROL ***
        if (!User.IsSuperAdmin())
        {
            // Admin de sede: fuerza IdSede a su propia sede
            var sedeId = User.GetSedeId() ?? 0;
            if (sedeId == 0)
                return Unauthorized("No se pudo identificar la sede del administrador.");

            dto.IdSede = sedeId;

            // Admin solo puede crear empleados (no otros admin)
            if (!string.Equals(dto.Rol, "empleado", StringComparison.OrdinalIgnoreCase))
                return Forbid("Solo puedes crear usuarios con rol 'empleado'.");
        }
        else
        {
            // Superadmin: puede crear cualquier rol (empleado, admin, superadmin)
            if (dto.Rol is not ("empleado" or "admin" or "superadmin"))
                return BadRequest("Rol inválido (empleado/admin/superadmin).");
        }

        var sedeExiste = await _context.Sedes.AnyAsync(s => s.Id == dto.IdSede);
        if (!sedeExiste) return BadRequest("La sede indicada no existe.");

        var nuevo = new Usuario
        {
            NombreCompleto = dto.NombreCompleto.Trim(),
            Email = dto.Email.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            Rol = dto.Rol.ToLowerInvariant(),
            IdSede = dto.IdSede,
            Activo = true
        };

        _context.Usuarios.Add(nuevo);

        // Auditoría
        var idAdminClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.IsNullOrWhiteSpace(idAdminClaim))
        {
            _context.Auditorias.Add(new Auditoria
            {
                IdUsuarioAdmin = int.Parse(idAdminClaim),
                Accion = "usuario.create",
                Entidad = "Usuario",
                EntidadId = nuevo.Id,
                DataJson = System.Text.Json.JsonSerializer.Serialize(new { nuevo.Email, nuevo.Rol, nuevo.IdSede })
            });
        }

        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = nuevo.Id }, new { nuevo.Id });
    }

    // PUT /api/usuarios/{id}
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Actualizar(int id, [FromBody] UsuarioActualizarDto dto)
    {
        var u = await _context.Usuarios.FirstOrDefaultAsync(x => x.Id == id);
        if (u is null) return NotFound();

        // *** VERIFICAR ACCESO POR SEDE ***
        if (!User.IsSuperAdmin())
        {
            var sedeId = User.GetSedeId() ?? -1;
            if (u.IdSede != sedeId)
                return Forbid("No puedes editar usuarios de otra sede.");

            // Admin no puede cambiar la sede del usuario
            if (dto.IdSede != u.IdSede)
                return BadRequest("No puedes cambiar la sede del usuario.");

            // Admin solo puede asignar rol 'empleado'
            if (!string.Equals(dto.Rol, "empleado", StringComparison.OrdinalIgnoreCase))
                return Forbid("Solo puedes asignar el rol 'empleado'.");
        }
        else
        {
            // Superadmin: validar rol y sede
            if (dto.Rol is not ("empleado" or "admin" or "superadmin"))
                return BadRequest("Rol inválido (empleado/admin/superadmin).");

            var sedeExiste = await _context.Sedes.AnyAsync(s => s.Id == dto.IdSede);
            if (!sedeExiste) return BadRequest("La sede indicada no existe.");
        }

        u.NombreCompleto = dto.NombreCompleto.Trim();
        u.Rol = dto.Rol.ToLowerInvariant();
        u.IdSede = dto.IdSede;
        u.Activo = dto.Activo;

        // Auditoría
        var idAdminClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.IsNullOrWhiteSpace(idAdminClaim))
        {
            _context.Auditorias.Add(new Auditoria
            {
                IdUsuarioAdmin = int.Parse(idAdminClaim),
                Accion = "usuario.update",
                Entidad = "Usuario",
                EntidadId = u.Id,
                DataJson = System.Text.Json.JsonSerializer.Serialize(dto)
            });
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }

    // PATCH /api/usuarios/{id}/estado
    [HttpPatch("{id:int}/estado")]
    public async Task<IActionResult> CambiarEstado(int id, [FromBody] CambiarEstadoDto body)
    {
        var u = await _context.Usuarios.FirstOrDefaultAsync(x => x.Id == id);
        if (u is null) return NotFound();

        // *** VERIFICAR ACCESO POR SEDE ***
        if (!User.IsSuperAdmin())
        {
            var sedeId = User.GetSedeId() ?? -1;
            if (u.IdSede != sedeId)
                return Forbid("No puedes cambiar el estado de usuarios de otra sede.");
        }

        u.Activo = body.Activo;

        // Auditoría
        var idAdminClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.IsNullOrWhiteSpace(idAdminClaim))
        {
            _context.Auditorias.Add(new Auditoria
            {
                IdUsuarioAdmin = int.Parse(idAdminClaim),
                Accion = "usuario.togglestate",
                Entidad = "Usuario",
                EntidadId = u.Id,
                DataJson = System.Text.Json.JsonSerializer.Serialize(body)
            });
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }

    // DELETE /api/usuarios/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Eliminar(int id)
    {
        var u = await _context.Usuarios.FirstOrDefaultAsync(x => x.Id == id);
        if (u is null) return NotFound();

        // *** VERIFICAR ACCESO POR SEDE ***
        if (!User.IsSuperAdmin())
        {
            var sedeId = User.GetSedeId() ?? -1;
            if (u.IdSede != sedeId)
                return Forbid("No puedes eliminar usuarios de otra sede.");
        }

        var idAdminClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(idAdminClaim))
            return Unauthorized("No se pudo identificar al administrador.");

        _context.Usuarios.Remove(u);

        // Auditoría
        _context.Auditorias.Add(new Auditoria
        {
            IdUsuarioAdmin = int.Parse(idAdminClaim),
            Accion = "usuario.delete",
            Entidad = "Usuario",
            EntidadId = id,
            DataJson = System.Text.Json.JsonSerializer.Serialize(new { u.NombreCompleto, u.Email })
        });

        await _context.SaveChangesAsync();
        return NoContent();
    }

    public record ResetPasswordDto(string NewPassword);
}