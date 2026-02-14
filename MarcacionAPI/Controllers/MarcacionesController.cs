using MarcacionAPI.Data;
using MarcacionAPI.DTOs;
using MarcacionAPI.Models;
using MarcacionAPI.Services;
using MarcacionAPI.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using ClosedXML.Excel;

namespace MarcacionAPI.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class MarcacionesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _config;
    private readonly ILogger<MarcacionesController> _logger;
    private readonly IRecargosService _recargosService;
    private static readonly TimeSpan VentanaAntirebote = TimeSpan.FromMinutes(3.0);

    public MarcacionesController(
        ApplicationDbContext context,
        IConfiguration config,
        ILogger<MarcacionesController> logger,
        IRecargosService recargosService)
    {
        _context = context;
        _config = config;
        _logger = logger;
        _recargosService = recargosService;
    }

    #region Helpers

    private static int? TryGetUserId(ClaimsPrincipal user)
    {
        var s = user.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(s, out var result) ? result : null;
    }

    private static TimeZoneInfo TzBogota()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("America/Bogota"); }
        catch { return TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time"); }
    }

    private (DateTimeOffset utcStart, DateTimeOffset utcEnd) GetBogotaUtcWindowToday()
    {
        var tz = TzBogota();
        var nowUtc = DateTimeOffset.UtcNow;
        var nowBog = TimeZoneInfo.ConvertTime(nowUtc, tz);
        var startBog = new DateTimeOffset(nowBog.Date, tz.GetUtcOffset(nowBog));
        var endBog = startBog.AddDays(1.0);
        return (startBog.ToUniversalTime(), endBog.ToUniversalTime());
    }

    private DateTimeOffset? ConvertToBogota(DateTimeOffset? utcDate, TimeZoneInfo tz)
    {
        if (!utcDate.HasValue) return null;
        return TimeZoneInfo.ConvertTime(utcDate.Value, tz);
    }

    #endregion Helpers

    // ========================================
    // MARCACIÓN (TRADICIONAL Y FACIAL)
    // ========================================

    [HttpPost]
    public async Task<IActionResult> CrearMarcacion([FromBody] MarcacionDto marcacionDto)
    {
        var idUsuarioStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(idUsuarioStr)) return Unauthorized();
        int idUsuario = int.Parse(idUsuarioStr);

        var tipo = marcacionDto.Tipo?.Trim().ToLowerInvariant();
        if (tipo is not ("entrada" or "salida")) return BadRequest("Tipo debe ser 'entrada' o 'salida'.");

        if (marcacionDto.Latitud is < -90 or > 90) return BadRequest("Latitud inválida.");
        if (marcacionDto.Longitud is < -180 or > 180) return BadRequest("Longitud inválida.");

        var ahoraUtc = DateTimeOffset.UtcNow;

        var usuario = await _context.Usuarios
            .Include(u => u.Sede)
            .FirstOrDefaultAsync(u => u.Id == idUsuario && u.Activo);

        if (usuario == null) return Unauthorized("Usuario no válido o inactivo.");

        // Anti-rebote
        var ultima = await _context.Marcaciones.AsNoTracking()
            .Where(m => m.IdUsuario == idUsuario)
            .OrderByDescending(m => m.FechaHora)
            .FirstOrDefaultAsync();

        if (ultima != null && ultima.Tipo == tipo)
        {
            var transcurrido = ahoraUtc - ultima.FechaHora;
            if (transcurrido < VentanaAntirebote)
            {
                var restante = VentanaAntirebote - transcurrido;
                return BadRequest($"Ya registraste una '{tipo}' hace {(int)transcurrido.TotalSeconds} segundos. Intenta de nuevo en {restante.Minutes:D2}:{restante.Seconds:D2}.");
            }
        }

        // Geocerca
        if (usuario.Sede?.Lat.HasValue == true && usuario.Sede.Lon.HasValue)
        {
            double dist = Geo.DistanceMeters((double)marcacionDto.Latitud, (double)marcacionDto.Longitud, (double)usuario.Sede.Lat.Value, (double)usuario.Sede.Lon.Value);
            int maxRadio = _config.GetValue<int?>("Marcacion:MaxDistanceMeters") ?? 50;
            if (dist > maxRadio) return BadRequest($"Fuera de geocerca: distancia {dist:F1} m > radio {maxRadio} m.");
        }

        var nueva = new Marcacion
        {
            IdUsuario = idUsuario,
            Tipo = tipo,
            LatitudMarcacion = marcacionDto.Latitud,
            LongitudMarcacion = marcacionDto.Longitud,
            FechaHora = ahoraUtc
        };

        _context.Marcaciones.Add(nueva);
        await _context.SaveChangesAsync();

        if (tipo == "salida")
        {
            await CalcularYGuardarRecargosAsync(nueva);
        }

        var tz = TzBogota();
        var response = new MarcacionResponseDto(
            nueva.Id,
            nueva.IdUsuario,
            nueva.FechaHora,
            nueva.InicioAlmuerzo,
            nueva.FinAlmuerzo,
            ConvertToBogota(nueva.FechaHora, tz)!.Value,
            ConvertToBogota(nueva.InicioAlmuerzo, tz),
            ConvertToBogota(nueva.FinAlmuerzo, tz),
            nueva.Tipo,
            nueva.LatitudMarcacion,
            nueva.LongitudMarcacion,
            nueva.TiempoAlmuerzoMinutos
        );

        return CreatedAtAction(nameof(ObtenerMarcacionPorId), new { id = nueva.Id }, response);
    }

    // ========================================
    // ✅ ENDPOINT PARA APP MÓVIL: MIS MARCACIONES
    // ========================================

    /// <summary>
    /// Obtiene las marcaciones del usuario autenticado (para app móvil)
    /// GET /api/marcaciones/mis
    /// </summary>
    [HttpGet("mis")]
    public async Task<IActionResult> GetMisMarcaciones(
        [FromQuery] DateTimeOffset? desde = null,
        [FromQuery] DateTimeOffset? hasta = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userId = TryGetUserId(User);
        if (userId == null) return Unauthorized();

        try
        {
            var tz = TzBogota();
            var query = _context.Marcaciones
                .AsNoTracking()
                .Where(m => m.IdUsuario == userId.Value);

            // Filtros de fecha
            if (desde.HasValue)
            {
                query = query.Where(m => m.FechaHora >= desde.Value);
            }
            if (hasta.HasValue)
            {
                query = query.Where(m => m.FechaHora <= hasta.Value);
            }

            var total = await query.CountAsync();

            // Primero obtenemos los datos de la BD
            var marcacionesDb = await query
                .OrderByDescending(m => m.FechaHora)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            // Luego convertimos en memoria (no en la consulta SQL)
            var marcaciones = marcacionesDb.Select(m => new
            {
                m.Id,
                m.IdUsuario,
                tipo = m.Tipo,
                fechaHoraUtc = m.FechaHora,
                fechaHoraLocal = TimeZoneInfo.ConvertTime(m.FechaHora, tz),
                latitud = m.LatitudMarcacion,
                longitud = m.LongitudMarcacion,
                inicioAlmuerzoUtc = m.InicioAlmuerzo,
                inicioAlmuerzoLocal = m.InicioAlmuerzo.HasValue 
                    ? TimeZoneInfo.ConvertTime(m.InicioAlmuerzo.Value, tz) 
                    : (DateTimeOffset?)null,
                finAlmuerzoUtc = m.FinAlmuerzo,
                finAlmuerzoLocal = m.FinAlmuerzo.HasValue 
                    ? TimeZoneInfo.ConvertTime(m.FinAlmuerzo.Value, tz) 
                    : (DateTimeOffset?)null,
                m.TiempoAlmuerzoMinutos
            }).ToList();

            return Ok(new { items = marcaciones, total });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error obteniendo marcaciones del usuario {UserId}", userId);
            return StatusCode(500, new { mensaje = "Error al obtener marcaciones" });
        }
    }

    /// <summary>
    /// Obtiene la última marcación del día del usuario autenticado
    /// GET /api/marcaciones/ultima
    /// </summary>
    [HttpGet("ultima")]
    public async Task<IActionResult> GetUltimaMarcacion()
    {
        var userId = TryGetUserId(User);
        if (userId == null) return Unauthorized();

        try
        {
            var tz = TzBogota();
            var (utcStart, utcEnd) = GetBogotaUtcWindowToday();

            var ultima = await _context.Marcaciones
                .AsNoTracking()
                .Where(m => m.IdUsuario == userId.Value && m.FechaHora >= utcStart && m.FechaHora < utcEnd)
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            if (ultima == null)
            {
                return Ok(new { hayMarcacion = false, mensaje = "No hay marcaciones hoy" });
            }

            return Ok(new
            {
                hayMarcacion = true,
                id = ultima.Id,
                tipo = ultima.Tipo,
                fechaHoraUtc = ultima.FechaHora,
                fechaHoraLocal = TimeZoneInfo.ConvertTime(ultima.FechaHora, tz),
                latitud = ultima.LatitudMarcacion,
                longitud = ultima.LongitudMarcacion
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error obteniendo última marcación");
            return StatusCode(500, new { mensaje = "Error al obtener última marcación" });
        }
    }

    /// <summary>
    /// Obtiene el estado actual de marcación del usuario (para mostrar botón correcto)
    /// GET /api/marcaciones/estado
    /// </summary>
    [HttpGet("estado")]
    public async Task<IActionResult> GetEstadoMarcacion()
    {
        var userId = TryGetUserId(User);
        if (userId == null) return Unauthorized();

        try
        {
            var tz = TzBogota();
            var (utcStart, utcEnd) = GetBogotaUtcWindowToday();

            var marcacionesHoy = await _context.Marcaciones
                .AsNoTracking()
                .Where(m => m.IdUsuario == userId.Value && m.FechaHora >= utcStart && m.FechaHora < utcEnd)
                .OrderByDescending(m => m.FechaHora)
                .ToListAsync();

            var ultima = marcacionesHoy.FirstOrDefault();
            var entrada = marcacionesHoy.FirstOrDefault(m => m.Tipo == "entrada");
            var salida = marcacionesHoy.FirstOrDefault(m => m.Tipo == "salida");

            string estado;
            string siguienteAccion;

            if (entrada == null)
            {
                estado = "sin_entrada";
                siguienteAccion = "entrada";
            }
            else if (salida == null)
            {
                estado = "entrada_registrada";
                siguienteAccion = "salida";
            }
            else
            {
                estado = "jornada_completa";
                siguienteAccion = "ninguna";
            }

            return Ok(new
            {
                estado,
                siguienteAccion,
                ultimaMarcacion = ultima != null ? new
                {
                    tipo = ultima.Tipo,
                    fechaHoraLocal = TimeZoneInfo.ConvertTime(ultima.FechaHora, tz)
                } : null,
                entrada = entrada != null ? new
                {
                    fechaHoraLocal = TimeZoneInfo.ConvertTime(entrada.FechaHora, tz)
                } : null,
                salida = salida != null ? new
                {
                    fechaHoraLocal = TimeZoneInfo.ConvertTime(salida.FechaHora, tz)
                } : null
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error obteniendo estado de marcación");
            return StatusCode(500, new { mensaje = "Error al obtener estado" });
        }
    }

    // ========================================
    // MÉTODO AUXILIAR PARA CALCULAR RECARGOS
    // ========================================

    private async Task CalcularYGuardarRecargosAsync(Marcacion marcacionSalida)
    {
        try
        {
            var fecha = DateOnly.FromDateTime(marcacionSalida.FechaHora.Date);
            var recargos = await _recargosService.CalcularRecargosDia(marcacionSalida.IdUsuario, fecha);

            var marcacionesDelDia = await _context.Marcaciones
                .Where(m => m.IdUsuario == marcacionSalida.IdUsuario && m.FechaHora.Date == marcacionSalida.FechaHora.Date)
                .ToListAsync();

            var entrada = marcacionesDelDia.FirstOrDefault(m => m.Tipo == "entrada");

            if (entrada != null)
            {
                entrada.HorasExtraDiurnas = recargos.HorasExtraDiurnas;
                entrada.HorasExtraNocturnas = recargos.HorasExtraNocturnas;
                entrada.HorasRecargoNocturnoOrdinario = recargos.HorasRecargoNocturnoOrdinario;
                entrada.RecargosCalculados = true;
            }

            marcacionSalida.HorasExtraDiurnas = recargos.HorasExtraDiurnas;
            marcacionSalida.HorasExtraNocturnas = recargos.HorasExtraNocturnas;
            marcacionSalida.HorasRecargoNocturnoOrdinario = recargos.HorasRecargoNocturnoOrdinario;
            marcacionSalida.RecargosCalculados = true;

            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calculando recargos para marcación {Id}", marcacionSalida.Id);
        }
    }

    // ========================================
    // ALMUERZO
    // ========================================

    [HttpPost("almuerzo/inicio")]
    public async Task<IActionResult> IniciarAlmuerzo([FromBody] AlmuerzoDto dto)
    {
        var idUserId = TryGetUserId(User);
        if (idUserId == null) return Unauthorized();

        var ahoraUtc = DateTimeOffset.UtcNow;
        var (utcStart, utcEnd) = GetBogotaUtcWindowToday();

        var entradaHoy = await _context.Marcaciones
            .Where(m => m.IdUsuario == idUserId && m.Tipo == "entrada" && m.FechaHora >= utcStart && m.FechaHora < utcEnd)
            .OrderByDescending(m => m.FechaHora)
            .FirstOrDefaultAsync();

        if (entradaHoy == null) return BadRequest("Debes marcar entrada primero.");

        entradaHoy.InicioAlmuerzo = ahoraUtc;
        await _context.SaveChangesAsync();

        var tz = TzBogota();
        return Ok(new
        {
            Message = "Inicio de almuerzo registrado.",
            InicioAlmuerzoLocal = ConvertToBogota(entradaHoy.InicioAlmuerzo, tz)
        });
    }

    [HttpPost("almuerzo/fin")]
    public async Task<IActionResult> FinalizarAlmuerzo([FromBody] AlmuerzoDto dto)
    {
        var idUserId = TryGetUserId(User);
        if (idUserId == null) return Unauthorized();

        var ahoraUtc = DateTimeOffset.UtcNow;
        var (utcStart, utcEnd) = GetBogotaUtcWindowToday();

        var entradaHoy = await _context.Marcaciones
            .Where(m => m.IdUsuario == idUserId && m.Tipo == "entrada" && m.FechaHora >= utcStart && m.FechaHora < utcEnd)
            .OrderByDescending(m => m.FechaHora)
            .FirstOrDefaultAsync();

        if (entradaHoy == null || !entradaHoy.InicioAlmuerzo.HasValue) return BadRequest("No has iniciado el almuerzo.");

        entradaHoy.FinAlmuerzo = ahoraUtc;
        entradaHoy.TiempoAlmuerzoMinutos = (int)(entradaHoy.FinAlmuerzo.Value - entradaHoy.InicioAlmuerzo.Value).TotalMinutes;
        await _context.SaveChangesAsync();

        var tz = TzBogota();
        return Ok(new
        {
            Message = "Almuerzo finalizado.",
            TiempoAlmuerzoMinutos = entradaHoy.TiempoAlmuerzoMinutos
        });
    }

    /// <summary>
    /// Obtiene el estado actual del almuerzo
    /// GET /api/marcaciones/almuerzo/estado
    /// </summary>
    [HttpGet("almuerzo/estado")]
    public async Task<IActionResult> GetEstadoAlmuerzo()
    {
        var userId = TryGetUserId(User);
        if (userId == null) return Unauthorized();

        try
        {
            var tz = TzBogota();
            var (utcStart, utcEnd) = GetBogotaUtcWindowToday();

            var entradaHoy = await _context.Marcaciones
                .AsNoTracking()
                .Where(m => m.IdUsuario == userId && m.Tipo == "entrada" && m.FechaHora >= utcStart && m.FechaHora < utcEnd)
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            if (entradaHoy == null)
            {
                return Ok(new
                {
                    estado = "sin_entrada",
                    message = "No has marcado entrada hoy"
                });
            }

            if (!entradaHoy.InicioAlmuerzo.HasValue)
            {
                return Ok(new
                {
                    estado = "sin_almuerzo",
                    message = "No has iniciado el almuerzo"
                });
            }

            if (!entradaHoy.FinAlmuerzo.HasValue)
            {
                return Ok(new
                {
                    estado = "almuerzo_en_curso",
                    message = "Almuerzo en curso",
                    inicioAlmuerzoUtc = entradaHoy.InicioAlmuerzo,
                    inicioAlmuerzoLocal = ConvertToBogota(entradaHoy.InicioAlmuerzo, tz)
                });
            }

            return Ok(new
            {
                estado = "almuerzo_completado",
                message = "Almuerzo completado",
                inicioAlmuerzoUtc = entradaHoy.InicioAlmuerzo,
                inicioAlmuerzoLocal = ConvertToBogota(entradaHoy.InicioAlmuerzo, tz),
                finAlmuerzoUtc = entradaHoy.FinAlmuerzo,
                finAlmuerzoLocal = ConvertToBogota(entradaHoy.FinAlmuerzo, tz),
                tiempoAlmuerzoMinutos = entradaHoy.TiempoAlmuerzoMinutos
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error obteniendo estado de almuerzo");
            return StatusCode(500, new { mensaje = "Error al obtener estado de almuerzo" });
        }
    }

    // ========================================
    // CONSULTAS Y EXCEL (ADMIN)
    // ========================================

    [HttpGet("{id:int}")]
    [Authorize(Roles = "admin,superadmin")]
    public async Task<IActionResult> ObtenerMarcacionPorId(int id)
    {
        var m = await _context.Marcaciones.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (m == null) return NotFound();

        var tz = TzBogota();
        return Ok(new MarcacionResponseDto(
            m.Id, m.IdUsuario, m.FechaHora, m.InicioAlmuerzo, m.FinAlmuerzo,
            ConvertToBogota(m.FechaHora, tz)!.Value, ConvertToBogota(m.InicioAlmuerzo, tz),
            ConvertToBogota(m.FinAlmuerzo, tz), m.Tipo, m.LatitudMarcacion,
            m.LongitudMarcacion, m.TiempoAlmuerzoMinutos
        ));
    }

    [HttpGet("exportar-excel")]
    [Authorize(Roles = "admin,superadmin")]
    public async Task<IActionResult> ExportarExcel([FromQuery] DateOnly? desde, [FromQuery] DateOnly? hasta, [FromQuery] int? idUsuario, [FromQuery] int? idSede)
    {
        try
        {
            var tz = TzBogota();
            var query = _context.Marcaciones.AsNoTracking()
                .Include(m => m.Usuario).ThenInclude(u => u.Sede).AsQueryable();

            var list = await query.OrderBy(m => m.FechaHora).ToListAsync();

            using var workbook = new XLWorkbook();
            var worksheet = workbook.Worksheets.Add("Marcaciones");

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Marcaciones.xlsx");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error Excel");
            return StatusCode(500, "Error");
        }
    }

    [HttpGet]
    [Authorize(Roles = "admin,superadmin")]
    public async Task<IActionResult> ListarMarcaciones(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? NumeroDocumento = null,
        [FromQuery] int? idSede = null,
        [FromQuery] string? tipo = null,
        [FromQuery] DateTimeOffset? desde = null,
        [FromQuery] DateTimeOffset? hasta = null)
    {
        try
        {
            var query = _context.Marcaciones
                .Include(m => m.Usuario).ThenInclude(u => u.Sede)
                .AsNoTracking().AsQueryable();

            if (!User.IsInRole("superadmin"))
            {
                var sedeIdAdmin = User.FindFirstValue("SedeId");
                if (!string.IsNullOrEmpty(sedeIdAdmin)) query = query.Where(m => m.Usuario.IdSede == int.Parse(sedeIdAdmin));
            }
            else if (idSede.HasValue) query = query.Where(m => m.Usuario.IdSede == idSede.Value);

            if (!string.IsNullOrWhiteSpace(NumeroDocumento)) query = query.Where(m => m.Usuario.NumeroDocumento.Contains(NumeroDocumento));
            if (!string.IsNullOrWhiteSpace(tipo)) query = query.Where(m => m.Tipo == tipo.ToLower());
            if (desde.HasValue) query = query.Where(m => m.FechaHora >= desde.Value);
            if (hasta.HasValue) query = query.Where(m => m.FechaHora <= hasta.Value);

            var total = await query.CountAsync();
            var marcaciones = await query.OrderByDescending(m => m.FechaHora).Skip((page - 1) * pageSize).Take(pageSize)
                .Select(m => new
                {
                    m.Id,
                    documentoUsuario = m.Usuario.NumeroDocumento,
                    nombreUsuario = m.Usuario.NombreCompleto,
                    nombreSede = m.Usuario.Sede.Nombre,
                    fechaHora = m.FechaHora,
                    tipo = m.Tipo
                }).ToListAsync();

            return Ok(new { data = marcaciones, total });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listado");
            return StatusCode(500, new { mensaje = "Error" });
        }
    }
}
