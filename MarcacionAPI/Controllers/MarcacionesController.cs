using MarcacionAPI.Data;
using MarcacionAPI.DTOs;
using MarcacionAPI.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using MarcacionAPI.Utils; // Asegúrate de que Geo, Paging y UserExtensions estén aquí

[Authorize] // Autorización general
[ApiController]
[Route("api/[controller]")]
public class MarcacionesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _config;

    private static readonly TimeSpan VentanaAntirebote = TimeSpan.FromMinutes(3);

    public MarcacionesController(ApplicationDbContext context, IConfiguration config)
    {
        _context = context;
        _config = config;
    }

    // ==== Helpers (TUYOS + NUEVO) ====
    private static int? TryGetUserId(ClaimsPrincipal user)
    {
        var s = user.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(s, out var id) ? id : null;
    }

    private static TimeZoneInfo TzBogota()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("America/Bogota"); }
        catch { return TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time"); }
    }

    // --- NUEVO HELPER REQUERIDO ---
    private (DateTimeOffset utcStart, DateTimeOffset utcEnd) GetBogotaUtcWindowToday()
    {
        var tz = TzBogota();
        var nowUtc = DateTimeOffset.UtcNow;
        var nowBog = TimeZoneInfo.ConvertTime(nowUtc, tz);
        var startBog = new DateTimeOffset(nowBog.Date, tz.GetUtcOffset(nowBog));
        var endBog = startBog.AddDays(1);
        return (startBog.ToUniversalTime(), endBog.ToUniversalTime());
    }

    // --- NUEVO HELPER DE CONVERSIÓN ---
    /// <summary>
    /// Convierte un DateTimeOffset UTC a la zona horaria de Bogotá.
    /// </summary>
    private DateTimeOffset? ConvertToBogota(DateTimeOffset? utcDate, TimeZoneInfo tz)
    {
        if (!utcDate.HasValue) return null;
        return TimeZoneInfo.ConvertTime(utcDate.Value, tz);
    }

    // ===========================================
    // 1) Crear marcación (empleado) - VERSIÓN CORREGIDA
    // ===========================================
    [HttpPost]
    public async Task<IActionResult> CrearMarcacion([FromBody] MarcacionDto marcacionDto)
    {
        // ... (Tu lógica de validación, anti-rebote y geocerca no cambia) ...
        var idUsuarioClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(idUsuarioClaim)) return Unauthorized();
        var idUsuario = int.Parse(idUsuarioClaim);

        var tipo = marcacionDto.Tipo?.Trim().ToLowerInvariant();
        if (tipo is not ("entrada" or "salida")) return BadRequest("Tipo debe ser 'entrada' o 'salida'.");
        if (marcacionDto.Latitud is < -90 or > 90) return BadRequest("Latitud inválida.");
        if (marcacionDto.Longitud is < -180 or > 180) return BadRequest("Longitud inválida.");

        var ahoraUtc = DateTimeOffset.UtcNow;

        var usuario = await _context.Usuarios.AsNoTracking()
            .Include(u => u.Sede)
            .FirstOrDefaultAsync(u => u.Id == idUsuario && u.Activo);
        if (usuario is null) return Unauthorized("Usuario no válido o inactivo.");

        var ultima = await _context.Marcaciones.AsNoTracking()
            .Where(m => m.IdUsuario == idUsuario)
            .OrderByDescending(m => m.FechaHora)
            .FirstOrDefaultAsync();

        if (ultima is not null && ultima.Tipo == tipo)
        {
            var transcurrido = ahoraUtc - ultima.FechaHora;
            if (transcurrido < VentanaAntirebote)
            {
                var restante = VentanaAntirebote - transcurrido;
                var faltan = $"{(int)restante.TotalMinutes:D2}:{restante.Seconds:D2}";
                return BadRequest($"Ya registraste una '{tipo}' hace {(int)transcurrido.TotalSeconds} segundos. Intenta de nuevo en {faltan}.");
            }
        }

        if (usuario.Sede is not null && usuario.Sede.Lat.HasValue && usuario.Sede.Lon.HasValue)
        {
            var dist = Geo.DistanceMeters(
                (double)marcacionDto.Latitud,
                (double)marcacionDto.Longitud,
                (double)usuario.Sede.Lat.Value,
                (double)usuario.Sede.Lon.Value
            );
            var maxRadioMetros = _config.GetValue<int?>("Marcacion:MaxDistanceMeters") ?? 200;
            if (dist > maxRadioMetros)
                return BadRequest($"Fuera de geocerca: distancia {dist:F1} m > radio {maxRadioMetros} m.");
        }
        else if (usuario.Sede is not null && (!usuario.Sede.Lat.HasValue || !usuario.Sede.Lon.HasValue))
        {
            // Opcional: return BadRequest("La sede asignada no tiene coordenadas configuradas para geocerca.");
        }

        var nueva = new Marcacion
        {
            IdUsuario = idUsuario,
            Tipo = tipo!,
            LatitudMarcacion = marcacionDto.Latitud,
            LongitudMarcacion = marcacionDto.Longitud,
            FechaHora = ahoraUtc // ✅ guardado en UTC
        };

        _context.Marcaciones.Add(nueva);
        await _context.SaveChangesAsync();

        // --- ✅ CAMBIO AQUÍ: Llenar el DTO con campos UTC y Locales ---
        var tz = TzBogota(); // Obtener la zona horaria

        var dto = new MarcacionResponseDto(
            nueva.Id,
            nueva.IdUsuario,

            // Campos UTC
            nueva.FechaHora,
            nueva.InicioAlmuerzo,
            nueva.FinAlmuerzo,

            // Campos Locales (convertidos)
            ConvertToBogota(nueva.FechaHora, tz)!.Value, // No puede ser nulo en creación
            ConvertToBogota(nueva.InicioAlmuerzo, tz),
            ConvertToBogota(nueva.FinAlmuerzo, tz),

            // Resto de campos
            nueva.Tipo,
            nueva.LatitudMarcacion,
            nueva.LongitudMarcacion,
            nueva.TiempoAlmuerzoMinutos
        );
        // --- FIN DEL CAMBIO ---

        return CreatedAtAction(nameof(ObtenerMarcacionPorId), new { id = nueva.Id }, dto);
    }

    // ===========================================
    // 2) Mis marcaciones (historial y “última marca”) - VERSIÓN CORREGIDA
    // ===========================================
    [Authorize]
    [HttpGet("mis")]
    public async Task<ActionResult<object>> GetMisMarcaciones(
        [FromQuery] DateTimeOffset? desde,
        [FromQuery] DateTimeOffset? hasta,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] bool desc = true)
    {
        var userId = TryGetUserId(User);
        if (userId is null) return Unauthorized();

        var tz = TzBogota();
        // ⬇️ “hoy” en Bogotá → a UTC (Lógica de filtrado no cambia)
        var nowUtc = DateTimeOffset.UtcNow;
        var nowBog = TimeZoneInfo.ConvertTime(nowUtc, tz);
        var startBog = new DateTimeOffset(nowBog.Date, tz.GetUtcOffset(nowBog));
        var endBog = startBog.AddDays(1);

        var desdeUtc = (desde ?? startBog).ToUniversalTime();
        var hastaUtc = (hasta ?? endBog).ToUniversalTime();

        var q = _context.Marcaciones.AsNoTracking()
            .Where(m => m.IdUsuario == userId.Value &&
                        m.FechaHora >= desdeUtc && m.FechaHora < hastaUtc);

        q = desc ? q.OrderByDescending(m => m.FechaHora) : q.OrderBy(m => m.FechaHora);

        var total = await q.CountAsync();

        // --- ✅ CAMBIO AQUÍ: Modificar el .Select para incluir campos Locales ---
        var items = await q.Skip((page - 1) * pageSize)
                           .Take(pageSize)
                           .Select(m => new
                           {
                               id = m.Id,
                               tipo = m.Tipo.ToLower(),
                               latitud = (double?)m.LatitudMarcacion,
                               longitud = (double?)m.LongitudMarcacion,
                               tiempoAlmuerzoMinutos = m.TiempoAlmuerzoMinutos,

                               // Campos UTC (originales)
                               fechaHora = m.FechaHora,
                               inicioAlmuerzo = m.InicioAlmuerzo,
                               finAlmuerzo = m.FinAlmuerzo,

                               // --- NUEVOS CAMPOS LOCALES (convertidos) ---
                               fechaHoraLocal = TimeZoneInfo.ConvertTime(m.FechaHora, tz),
                               inicioAlmuerzoLocal = m.InicioAlmuerzo.HasValue ? TimeZoneInfo.ConvertTime(m.InicioAlmuerzo.Value, tz) : (DateTimeOffset?)null,
                               finAlmuerzoLocal = m.FinAlmuerzo.HasValue ? TimeZoneInfo.ConvertTime(m.FinAlmuerzo.Value, tz) : (DateTimeOffset?)null
                           })
                           .ToListAsync();
        // --- FIN DEL CAMBIO ---

        return Ok(new { total, items });
    }

    // ========================================================
    // 3) ENDPOINTS DE ALMUERZO (Empleado) - VERSIÓN CORREGIDA
    // ========================================================

    [HttpPost("almuerzo/inicio")]
    public async Task<IActionResult> IniciarAlmuerzo([FromBody] AlmuerzoDto dto)
    {
        // ... (Tu lógica de validación, geocerca y guardado no cambia) ...
        var idUsuarioClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(idUsuarioClaim)) return Unauthorized();
        var idUsuario = int.Parse(idUsuarioClaim);

        if (dto.Latitud is < -90 or > 90 || dto.Longitud is < -180 or > 180) return BadRequest("Coordenadas inválidas.");

        var ahoraUtc = DateTimeOffset.UtcNow;
        var (utcStart, utcEnd) = GetBogotaUtcWindowToday();

        var entradaHoy = await _context.Marcaciones
            .Where(m => m.IdUsuario == idUsuario && m.Tipo == "entrada"
                     && m.FechaHora >= utcStart && m.FechaHora < utcEnd)
            .OrderByDescending(m => m.FechaHora)
            .FirstOrDefaultAsync();

        if (entradaHoy is null) return BadRequest("Debes marcar entrada primero antes de iniciar el almuerzo.");
        if (entradaHoy.InicioAlmuerzo.HasValue && !entradaHoy.FinAlmuerzo.HasValue)
            return BadRequest("Ya tienes un almuerzo en curso.");
        if (entradaHoy.InicioAlmuerzo.HasValue && entradaHoy.FinAlmuerzo.HasValue)
            return BadRequest("Ya registraste un almuerzo completo hoy.");

        var usuario = await _context.Usuarios
            .AsNoTracking()
            .Include(u => u.Sede)
            .FirstOrDefaultAsync(u => u.Id == idUsuario && u.Activo);

        if (usuario?.Sede?.Lat.HasValue == true && usuario.Sede.Lon.HasValue)
        {
            var dist = Geo.DistanceMeters(
                (double)dto.Latitud, (double)dto.Longitud,
                (double)usuario.Sede.Lat.Value, (double)usuario.Sede.Lon.Value
            );
            var maxRadioMetros = _config.GetValue<int?>("Marcacion:MaxDistanceMeters") ?? 200;
            if (dist > maxRadioMetros)
                return BadRequest($"Fuera de geocerca: distancia {dist:F1} m > radio {maxRadioMetros} m.");
        }

        entradaHoy.InicioAlmuerzo = ahoraUtc;
        await _context.SaveChangesAsync();

        // --- ✅ CAMBIO AQUÍ: Devolver el campo Local ---
        var tz = TzBogota();
        return Ok(new
        {
            Message = "Inicio de almuerzo registrado correctamente.",
            InicioAlmuerzo = entradaHoy.InicioAlmuerzo.Value.ToUniversalTime(), // UTC
            InicioAlmuerzoLocal = ConvertToBogota(entradaHoy.InicioAlmuerzo, tz) // LOCAL
        });
        // --- FIN DEL CAMBIO ---
    }

    [HttpPost("almuerzo/fin")]
    public async Task<IActionResult> FinalizarAlmuerzo([FromBody] AlmuerzoDto dto)
    {
        // ... (Tu lógica de validación, geocerca y guardado no cambia) ...
        var idUsuarioClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(idUsuarioClaim)) return Unauthorized();
        var idUsuario = int.Parse(idUsuarioClaim);

        if (dto.Latitud is < -90 or > 90 || dto.Longitud is < -180 or > 180) return BadRequest("Coordenadas inválidas.");

        var ahoraUtc = DateTimeOffset.UtcNow;
        var (utcStart, utcEnd) = GetBogotaUtcWindowToday();

        var entradaHoy = await _context.Marcaciones
            .Where(m => m.IdUsuario == idUsuario && m.Tipo == "entrada"
                     && m.FechaHora >= utcStart && m.FechaHora < utcEnd)
            .OrderByDescending(m => m.FechaHora)
            .FirstOrDefaultAsync();

        if (entradaHoy is null) return BadRequest("No se encontró una marcación de entrada hoy.");
        if (!entradaHoy.InicioAlmuerzo.HasValue) return BadRequest("No has iniciado el almuerzo.");
        if (entradaHoy.FinAlmuerzo.HasValue) return BadRequest("Ya finalizaste el almuerzo hoy.");

        var usuario = await _context.Usuarios
            .AsNoTracking()
            .Include(u => u.Sede)
            .FirstOrDefaultAsync(u => u.Id == idUsuario && u.Activo);

        if (usuario?.Sede?.Lat.HasValue == true && usuario.Sede.Lon.HasValue)
        {
            var dist = Geo.DistanceMeters(
                (double)dto.Latitud, (double)dto.Longitud,
                (double)usuario.Sede.Lat.Value, (double)usuario.Sede.Lon.Value
            );
            var maxRadioMetros = _config.GetValue<int?>("Marcacion:MaxDistanceMeters") ?? 200;
            if (dist > maxRadioMetros)
                return BadRequest($"Fuera de geocerca: distancia {dist:F1} m > radio {maxRadioMetros} m.");
        }

        entradaHoy.FinAlmuerzo = ahoraUtc;
        entradaHoy.TiempoAlmuerzoMinutos =
            (int)Math.Round((entradaHoy.FinAlmuerzo.Value - entradaHoy.InicioAlmuerzo.Value).TotalMinutes);

        await _context.SaveChangesAsync();

        // --- ✅ CAMBIO AQUÍ: Devolver el campo Local ---
        var tz = TzBogota();
        return Ok(new
        {
            Message = "Fin de almuerzo registrado correctamente.",
            FinAlmuerzo = entradaHoy.FinAlmuerzo.Value.ToUniversalTime(), // UTC
            FinAlmuerzoLocal = ConvertToBogota(entradaHoy.FinAlmuerzo, tz), // LOCAL
            TiempoAlmuerzoMinutos = entradaHoy.TiempoAlmuerzoMinutos
        });
        // --- FIN DEL CAMBIO ---
    }

    [HttpGet("almuerzo/estado")]
    public async Task<IActionResult> ObtenerEstadoAlmuerzo()
    {
        var idUsuarioClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(idUsuarioClaim)) return Unauthorized();
        var idUsuario = int.Parse(idUsuarioClaim);

        // --- ✅ CAMBIO AQUÍ: Añadir TzBogota ---
        var tz = TzBogota();
        // --- FIN DEL CAMBIO ---
        var (utcStart, utcEnd) = GetBogotaUtcWindowToday();

        var entradaHoy = await _context.Marcaciones.AsNoTracking()
            .Where(m => m.IdUsuario == idUsuario && m.Tipo == "entrada"
                     && m.FechaHora >= utcStart && m.FechaHora < utcEnd)
            .OrderByDescending(m => m.FechaHora)
            .FirstOrDefaultAsync();

        if (entradaHoy is null)
            return Ok(new { Estado = "sin_entrada", Message = "No has marcado entrada hoy." });

        if (!entradaHoy.InicioAlmuerzo.HasValue)
            return Ok(new { Estado = "sin_almuerzo", Message = "No has iniciado almuerzo." });

        // --- ✅ CAMBIO AQUÍ: Añadir campo Local ---
        if (!entradaHoy.FinAlmuerzo.HasValue)
            return Ok(new
            {
                Estado = "almuerzo_en_curso",
                Message = "Almuerzo en curso.",
                InicioAlmuerzo = entradaHoy.InicioAlmuerzo.Value.ToUniversalTime(), // UTC
                InicioAlmuerzoLocal = ConvertToBogota(entradaHoy.InicioAlmuerzo, tz) // LOCAL
            });
        // --- FIN DEL CAMBIO ---

        // --- ✅ CAMBIO AQUÍ: Añadir campos Locales ---
        return Ok(new
        {
            Estado = "almuerzo_completado",
            Message = "Almuerzo completado.",
            TiempoAlmuerzoMinutos = entradaHoy.TiempoAlmuerzoMinutos,
            // UTC
            InicioAlmuerzo = entradaHoy.InicioAlmuerzo.Value.ToUniversalTime(),
            FinAlmuerzo = entradaHoy.FinAlmuerzo.Value.ToUniversalTime(),
            // LOCAL
            InicioAlmuerzoLocal = ConvertToBogota(entradaHoy.InicioAlmuerzo, tz),
            FinAlmuerzoLocal = ConvertToBogota(entradaHoy.FinAlmuerzo, tz)
        });
        // --- FIN DEL CAMBIO ---
    }

    // ===========================================
    // 4) ENDPOINTS DE ADMIN - (ACTUALIZADOS)
    // ===========================================

    [HttpGet("{id:int}")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> ObtenerMarcacionPorId(int id)
    {
        var m = await _context.Marcaciones
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id);

        if (m is null) return NotFound();

        if (!User.IsSuperAdmin())
        {
            var sedeIdAdmin = User.GetSedeId() ?? 0;
            var usuarioDeMarcacion = await _context.Usuarios.AsNoTracking()
                                                .Where(u => u.Id == m.IdUsuario)
                                                .Select(u => u.IdSede)
                                                .FirstOrDefaultAsync();
            if (usuarioDeMarcacion == 0 || usuarioDeMarcacion != sedeIdAdmin)
            {
                return Forbid("No puedes ver marcaciones de usuarios de otra sede.");
            }
        }

        // --- ✅ CAMBIO AQUÍ: Llenar el DTO con campos UTC y Locales ---
        var tz = TzBogota();
        var dto = new MarcacionResponseDto(
            m.Id,
            m.IdUsuario,
            // UTC
            m.FechaHora,
            m.InicioAlmuerzo,
            m.FinAlmuerzo,
            // Local
            ConvertToBogota(m.FechaHora, tz)!.Value,
            ConvertToBogota(m.InicioAlmuerzo, tz),
            ConvertToBogota(m.FinAlmuerzo, tz),
            // Resto
            m.Tipo,
            m.LatitudMarcacion,
            m.LongitudMarcacion,
            m.TiempoAlmuerzoMinutos
        );
        // --- FIN DEL CAMBIO ---

        return Ok(dto);
    }

    [HttpGet]
    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> Listar(
       [FromQuery] int? idSede,
       [FromQuery] int? idUsuario,
       [FromQuery] DateTimeOffset? desde,
       [FromQuery] DateTimeOffset? hasta,
       [FromQuery] string? tipo,
       [FromQuery] int page = Paging.DefaultPage,
       [FromQuery] int pageSize = Paging.DefaultPageSize)
    {
        (page, pageSize) = Paging.Normalize(page, pageSize);

        // --- ✅ CAMBIO AQUÍ: Añadir TzBogota ---
        var tz = TzBogota();
        // --- FIN DEL CAMBIO ---

        var query = _context.Marcaciones.AsNoTracking().AsQueryable();

        var sedeIdFiltrada = idSede;
        if (!User.IsSuperAdmin())
        {
            sedeIdFiltrada = User.GetSedeId() ?? 0;
        }

        if (idUsuario.HasValue && idUsuario.Value > 0)
            query = query.Where(m => m.IdUsuario == idUsuario.Value);

        if (!string.IsNullOrWhiteSpace(tipo))
        {
            var t = tipo.Trim().ToLowerInvariant();
            if (t is "entrada" or "salida")
                query = query.Where(m => m.Tipo == t);
        }

        if (desde.HasValue) query = query.Where(m => m.FechaHora >= desde.Value);
        if (hasta.HasValue) query = query.Where(m => m.FechaHora <= hasta.Value);

        if (sedeIdFiltrada.HasValue && sedeIdFiltrada.Value > 0)
        {
            query =
                from m in query
                join u in _context.Usuarios.AsNoTracking() on m.IdUsuario equals u.Id
                where u.IdSede == sedeIdFiltrada.Value
                select m;
        }

        var total = await query.CountAsync();

        // --- ✅ CAMBIO AQUÍ: Modificar el .Select para incluir campos Locales ---
        var items = await query
            .OrderByDescending(m => m.FechaHora)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(m => new
            {
                m.Id,
                m.IdUsuario,
                m.Tipo,
                Latitud = m.LatitudMarcacion,
                Longitud = m.LongitudMarcacion,
                m.TiempoAlmuerzoMinutos,

                // UTC
                m.FechaHora,
                m.InicioAlmuerzo,
                m.FinAlmuerzo,

                // Locales
                fechaHoraLocal = TimeZoneInfo.ConvertTime(m.FechaHora, tz),
                inicioAlmuerzoLocal = m.InicioAlmuerzo.HasValue ? TimeZoneInfo.ConvertTime(m.InicioAlmuerzo.Value, tz) : (DateTimeOffset?)null,
                finAlmuerzoLocal = m.FinAlmuerzo.HasValue ? TimeZoneInfo.ConvertTime(m.FinAlmuerzo.Value, tz) : (DateTimeOffset?)null
            })
            .ToListAsync();
        // --- FIN DEL CAMBIO ---

        return Ok(new PagedResponse<object>(items, total, page, pageSize));
    }
}