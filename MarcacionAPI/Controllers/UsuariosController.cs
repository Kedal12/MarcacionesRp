using MarcacionAPI.Data;
using MarcacionAPI.DTOs;
using MarcacionAPI.Models;
using MarcacionAPI.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using ClosedXML.Excel;

namespace MarcacionAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "superadmin,admin")]
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
            .Where(u => u.Activo)
            .AsQueryable();

        // *** FILTRO POR SEDE ***
        if (!User.IsSuperAdmin())
        {
            var sedeId = User.GetSedeId() ?? 0;
            q = q.Where(u => u.IdSede == sedeId);
        }
        else if (idSede.HasValue && idSede.Value > 0)
        {
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
                SedeNombre = u.Sede != null ? u.Sede.Nombre : "Sin sede",
                TipoDocumento = u.TipoDocumento ?? "",
                NumeroDocumento = u.NumeroDocumento ?? "",
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
                return Forbid();
        }

        return Ok(new UsuarioListadoDto
        {
            Id = u.Id,
            NombreCompleto = u.NombreCompleto,
            Email = u.Email,
            Rol = u.Rol,
            IdSede = u.IdSede,
            SedeNombre = u.Sede != null ? u.Sede.Nombre : "Sin sede",
            TipoDocumento = u.TipoDocumento ?? "",
            NumeroDocumento = u.NumeroDocumento ?? "",
            Activo = u.Activo
        });
    }

    // ===========================================
    // ✅ NUEVO: EXPORTAR USUARIOS A EXCEL
    // ===========================================
    [HttpGet("exportar-excel")]
    public async Task<IActionResult> ExportarExcel(
        [FromQuery] string? search,
        [FromQuery] int? idSede)
    {
        try
        {
            var q = _context.Usuarios
                .Include(u => u.Sede)
                .AsNoTracking()
                .Where(u => u.Activo)
                .AsQueryable();

            // Filtro por sede
            if (!User.IsSuperAdmin())
            {
                var sedeId = User.GetSedeId() ?? 0;
                q = q.Where(u => u.IdSede == sedeId);
            }
            else if (idSede.HasValue && idSede.Value > 0)
            {
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

            var datos = await q
                .OrderBy(u => u.NombreCompleto)
                .Select(u => new
                {
                    u.Id,
                    u.NombreCompleto,
                    u.Email,
                    TipoDocumento = u.TipoDocumento ?? "-",
                    NumeroDocumento = u.NumeroDocumento ?? "-",
                    u.Rol,
                    SedeNombre = u.Sede != null ? u.Sede.Nombre : "Sin sede",
                    u.Activo
                })
                .ToListAsync();

            if (!datos.Any())
            {
                return NotFound("No se encontraron usuarios para exportar");
            }

            // Crear Excel con ClosedXML
            using var workbook = new XLWorkbook();
            var worksheet = workbook.Worksheets.Add("Usuarios");

            // Encabezados
            worksheet.Cell(1, 1).Value = "ID";
            worksheet.Cell(1, 2).Value = "Nombre Completo";
            worksheet.Cell(1, 3).Value = "Email";
            worksheet.Cell(1, 4).Value = "Tipo Doc.";
            worksheet.Cell(1, 5).Value = "No. Documento";
            worksheet.Cell(1, 6).Value = "Rol";
            worksheet.Cell(1, 7).Value = "Sede";
            worksheet.Cell(1, 8).Value = "Estado";

            // Estilo encabezados
            var headerRange = worksheet.Range(1, 1, 1, 8);
            headerRange.Style.Font.Bold = true;
            headerRange.Style.Fill.BackgroundColor = XLColor.FromArgb(79, 129, 189);
            headerRange.Style.Font.FontColor = XLColor.White;
            headerRange.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

            // Llenar datos
            int row = 2;
            foreach (var u in datos)
            {
                worksheet.Cell(row, 1).Value = u.Id;
                worksheet.Cell(row, 2).Value = u.NombreCompleto;
                worksheet.Cell(row, 3).Value = u.Email;
                worksheet.Cell(row, 4).Value = u.TipoDocumento;
                worksheet.Cell(row, 5).Value = u.NumeroDocumento;
                worksheet.Cell(row, 6).Value = u.Rol;
                worksheet.Cell(row, 7).Value = u.SedeNombre;
                worksheet.Cell(row, 8).Value = u.Activo ? "Activo" : "Inactivo";

                // Formato condicional para rol
                if (u.Rol == "superadmin")
                {
                    worksheet.Cell(row, 6).Style.Font.FontColor = XLColor.Purple;
                    worksheet.Cell(row, 6).Style.Font.Bold = true;
                }
                else if (u.Rol == "admin")
                {
                    worksheet.Cell(row, 6).Style.Font.FontColor = XLColor.Blue;
                    worksheet.Cell(row, 6).Style.Font.Bold = true;
                }

                // Formato condicional para estado
                if (u.Activo)
                {
                    worksheet.Cell(row, 8).Style.Font.FontColor = XLColor.Green;
                }
                else
                {
                    worksheet.Cell(row, 8).Style.Font.FontColor = XLColor.Red;
                }

                row++;
            }

            // Ajustar columnas
            worksheet.Columns().AdjustToContents();

            // Agregar bordes
            var dataRange = worksheet.Range(1, 1, row - 1, 8);
            dataRange.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            dataRange.Style.Border.InsideBorder = XLBorderStyleValues.Thin;

            // Generar archivo
            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            stream.Position = 0;

            var fileName = $"Usuarios_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";

            return File(
                stream.ToArray(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                fileName
            );
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error generando Excel de usuarios: {ex.Message}");
            Console.WriteLine($"Stack trace: {ex.StackTrace}");
            return StatusCode(500, $"Error al generar el Excel: {ex.Message}");
        }
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
                return Forbid();
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
            var sedeId = User.GetSedeId() ?? 0;
            if (sedeId == 0)
                return Unauthorized("No se pudo identificar la sede del administrador.");

            dto.IdSede = sedeId;

            if (!string.Equals(dto.Rol, "empleado", StringComparison.OrdinalIgnoreCase))
                return Forbid("Solo puedes crear usuarios con rol 'empleado'.");
        }
        else
        {
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
            TipoDocumento = dto.TipoDocumento ?? "",
            NumeroDocumento = dto.NumeroDocumento ?? "",
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

            if (dto.IdSede != u.IdSede)
                return BadRequest("No puedes cambiar la sede del usuario.");

            if (!string.Equals(dto.Rol, "empleado", StringComparison.OrdinalIgnoreCase))
                return Forbid("Solo puedes asignar el rol 'empleado'.");
        }
        else
        {
            if (dto.Rol is not ("empleado" or "admin" or "superadmin"))
                return BadRequest("Rol inválido (empleado/admin/superadmin).");

            var sedeExiste = await _context.Sedes.AnyAsync(s => s.Id == dto.IdSede);
            if (!sedeExiste) return BadRequest("La sede indicada no existe.");
        }

        u.NombreCompleto = dto.NombreCompleto.Trim();
        u.Rol = dto.Rol.ToLowerInvariant();
        u.IdSede = dto.IdSede;
        u.Activo = dto.Activo;
        u.TipoDocumento = dto.TipoDocumento ?? "";
        u.NumeroDocumento = dto.NumeroDocumento ?? "";

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