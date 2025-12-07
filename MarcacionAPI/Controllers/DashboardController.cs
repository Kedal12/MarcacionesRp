// ARCHIVO: MarcacionAPI/Controllers/DashboardController.cs

using MarcacionAPI.Data;
using MarcacionAPI.DTOs;
using MarcacionAPI.DTOs.Dashboard;
using MarcacionAPI.Models;
using MarcacionAPI.Services;
using MarcacionAPI.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace MarcacionAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly ApplicationDbContext _ctx;
    private readonly IResumenService _resumenService;

    public DashboardController(ApplicationDbContext ctx, IResumenService resumenService)
    {
        _ctx = ctx;
        _resumenService = resumenService;
    }

    // ===================== Helpers =====================

    private static TimeZoneInfo GetBogotaTz()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("America/Bogota"); }
        catch { return TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time"); }
    }

    /// <summary>
    /// Resuelve (para métricas web) la configuración de horario del día:
    /// horas esperadas y tolerancias.
    /// </summary>
    private async Task<(TimeSpan? entrada, TimeSpan? salida, int toleranciaMin, int descansoMin)>
        ResolveHorarioDelDia(int idUsuario, DateOnly dia)
    {
        var asig = await _ctx.UsuarioHorarios.AsNoTracking()
            .Where(uh => uh.IdUsuario == idUsuario &&
                         uh.Desde <= dia &&
                         (uh.Hasta == null || uh.Hasta >= dia))
            .Select(uh => new { uh.IdHorario })
            .FirstOrDefaultAsync();

        if (asig == null) return (null, null, 0, 0);

        // Lunes=1 .. Domingo=7
        int dow = ((int)dia.DayOfWeek + 6) % 7 + 1;

        var det = await _ctx.HorarioDetalles.AsNoTracking()
            .Where(d => d.IdHorario == asig.IdHorario && d.DiaSemana == dow)
            .Select(d => new { d.Laborable, d.HoraEntrada, d.HoraSalida, d.ToleranciaMin, d.DescansoMin })
            .FirstOrDefaultAsync();

        if (det == null || !det.Laborable || det.HoraEntrada is null || det.HoraSalida is null)
            return (null, null, 0, 0);

        return (det.HoraEntrada, det.HoraSalida, det.ToleranciaMin ?? 0, det.DescansoMin);
    }

    /// <summary>
    /// Calcula ausencias del mes para un usuario:
    /// - Ausencias aprobadas (tabla Ausencias)
    /// - Inasistencias derivadas: día laborable sin ninguna marcación (excluye feriados y aprobadas)
    /// </summary>
    private async Task<List<AusenciaDetalleItemDto>> ComputeAusenciasMesAsync(int userId, int A, int M)
    {
        var tz = GetBogotaTz();

        var desdeLocal = new DateOnly(A, M, 1);
        var hastaLocal = desdeLocal.AddMonths(1).AddDays(-1);

        // Ventana UTC exacta del mes local
        var desdeUtc = TimeZoneInfo.ConvertTimeToUtc(desdeLocal.ToDateTime(TimeOnly.MinValue), tz);
        var hastaUtc = TimeZoneInfo.ConvertTimeToUtc(hastaLocal.AddDays(1).ToDateTime(TimeOnly.MinValue), tz);

        // Asignaciones vigentes
        var asign = await _ctx.UsuarioHorarios.AsNoTracking()
            .Where(uh => uh.IdUsuario == userId &&
                         uh.Desde <= hastaLocal &&
                         (uh.Hasta == null || uh.Hasta >= desdeLocal))
            .Select(uh => new { uh.IdHorario, uh.Desde, uh.Hasta })
            .ToListAsync();
        if (asign.Count == 0) return new();

        var horarioIds = asign.Select(a => a.IdHorario).Distinct().ToList();

        // Días laborables por horario
        var detalles = await _ctx.HorarioDetalles.AsNoTracking()
            .Where(d => horarioIds.Contains(d.IdHorario) && d.Laborable)
            .Select(d => new { d.IdHorario, d.DiaSemana })
            .ToListAsync();

        // Feriados del mes
        var feriadoSet = new HashSet<DateOnly>(
            await _ctx.Feriados.AsNoTracking()
                .Where(f => f.Fecha >= desdeLocal && f.Fecha <= hastaLocal)
                .Select(f => f.Fecha)
                .ToListAsync()
        );

        // Ausencias aprobadas en rango
        var aprobadas = await _ctx.Ausencias.AsNoTracking()
            .Where(a => a.IdUsuario == userId &&
                        a.Estado == EstadoAusencia.Aprobada &&
                        a.Hasta >= desdeLocal && a.Desde <= hastaLocal)
            .Select(a => new { a.Id, a.Tipo, a.Desde, a.Hasta, a.Observacion })
            .OrderBy(a => a.Desde)
            .ToListAsync();

        // Fechas cubiertas por aprobadas
        var aprobadasFechas = new HashSet<DateOnly>();
        foreach (var a in aprobadas)
            for (var d = a.Desde; d <= a.Hasta; d = d.AddDays(1))
                aprobadasFechas.Add(d);

        // Marcaciones del mes -> fechas locales
        var marcasLocalDates = (await _ctx.Marcaciones.AsNoTracking()
                .Where(m => m.IdUsuario == userId &&
                            m.FechaHora >= desdeUtc && m.FechaHora < hastaUtc)
                .Select(m => m.FechaHora)
                .ToListAsync())
            .Select(dt => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(dt, tz).Date))
            .ToHashSet();

        // Lunes=1..Domingo=7
        static int Dow(DateOnly d) => ((int)d.DayOfWeek + 6) % 7 + 1;

        var result = new List<AusenciaDetalleItemDto>();

        // 1) Aprobadas
        foreach (var a in aprobadas)
        {
            result.Add(new AusenciaDetalleItemDto
            {
                Id = a.Id,
                Tipo = a.Tipo,
                Desde = a.Desde.ToString("yyyy-MM-dd"),
                Hasta = a.Hasta.ToString("yyyy-MM-dd"),
                Observacion = a.Observacion
            });
        }

        // 2) Inasistencias derivadas
        for (var dia = desdeLocal; dia <= hastaLocal; dia = dia.AddDays(1))
        {
            var asig = asign.FirstOrDefault(a => a.Desde <= dia && (a.Hasta == null || a.Hasta >= dia));
            if (asig is null) continue;

            // ¿Es laborable según detalle?
            if (!detalles.Any(d => d.IdHorario == asig.IdHorario && d.DiaSemana == Dow(dia)))
                continue;

            // Excluir feriados y aprobadas
            if (feriadoSet.Contains(dia) || aprobadasFechas.Contains(dia))
                continue;

            // Sin ninguna marcación local ese día -> inasistencia
            if (!marcasLocalDates.Contains(dia))
            {
                result.Add(new AusenciaDetalleItemDto
                {
                    Id = A * 10000 + M * 100 + dia.Day, // id sintético estable
                    Tipo = "Inasistencia",
                    Desde = dia.ToString("yyyy-MM-dd"),
                    Hasta = dia.ToString("yyyy-MM-dd"),
                    Observacion = "Día laborable sin marcaciones"
                });
            }
        }

        return result.OrderBy(r => r.Desde).ToList();
    }

    // ===================== 3. MÉTRICAS (WEB ADMIN) =====================

    [Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
    [HttpGet("metrics")]
    public async Task<ActionResult<DashboardMetricsResponseDto>> GetMetrics(
        [FromQuery] DateOnly date, [FromQuery] int? idSede = null)
    {
        var sedeIdFiltrada = idSede;
        if (!User.IsSuperAdmin())
            sedeIdFiltrada = User.GetSedeId() ?? 0;

        var tz = GetBogotaTz();
        var inicioDiaUtc = TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(TimeOnly.MinValue), tz);
        var finDiaUtc = inicioDiaUtc.AddDays(1);

        var usuariosQuery = _ctx.Usuarios.AsNoTracking().Where(u => u.Activo);
        if (sedeIdFiltrada is > 0)
            usuariosQuery = usuariosQuery.Where(u => u.IdSede == sedeIdFiltrada.Value);

        var usuariosIds = await usuariosQuery.Select(u => u.Id).ToListAsync();
        if (usuariosIds.Count == 0)
            return Ok(new DashboardMetricsResponseDto(0, 0, 0, 0, 0, new()));

        var marcacionesHoy = await _ctx.Marcaciones.AsNoTracking()
            .Where(m => m.FechaHora >= inicioDiaUtc && m.FechaHora < finDiaUtc &&
                        usuariosIds.Contains(m.IdUsuario))
            .OrderBy(m => m.FechaHora)
            .ToListAsync();

        int marcacionesHoyCount = marcacionesHoy.Count;

        // Nota: En tu BD el tipo puede ser "entrada"/"salida" (minúsculas)
        var presentesIds = marcacionesHoy
            .Where(m => m.Tipo == "entrada")
            .Select(m => m.IdUsuario)
            .Distinct()
            .ToList();

        int presentes = presentesIds.Count;
        int sinSalida = presentesIds.Count(id =>
            marcacionesHoy.LastOrDefault(m => m.IdUsuario == id)?.Tipo == "entrada");
        int ausentes = usuariosIds.Count(id => !presentesIds.Contains(id));
        int tarde = 0;
        var top = new List<TardanzaDto>();

        var usuariosConEntrada = await usuariosQuery
            .Where(u => presentesIds.Contains(u.Id))
            .Select(u => new { u.Id, u.NombreCompleto })
            .ToListAsync();

        foreach (var u in usuariosConEntrada)
        {
            var firstIn = marcacionesHoy.FirstOrDefault(m => m.IdUsuario == u.Id && m.Tipo == "entrada");
            if (firstIn is null) continue;

            var (hIn, _, tol, _) = await ResolveHorarioDelDia(u.Id, date);
            if (hIn is null) continue;

            var entradaLocal = TimeZoneInfo.ConvertTime(firstIn.FechaHora, tz);
            var progTol = date.ToDateTime(TimeOnly.FromTimeSpan(hIn.Value)).AddMinutes(tol);

            if (entradaLocal > progTol)
            {
                tarde++;
                var min = Math.Round((entradaLocal - progTol).TotalMinutes, 0);
                top.Add(new TardanzaDto(u.Id, u.NombreCompleto, hIn.Value, firstIn.FechaHora, min));
            }
        }

        return Ok(new DashboardMetricsResponseDto(
            presentes, ausentes, tarde, sinSalida, marcacionesHoyCount,
            top.OrderByDescending(x => x.MinutosTarde).Take(10).ToList()
        ));
    }

    // ===================== 4. ENDPOINTS APP MÓVIL =====================

    [HttpGet("resumen-mensual-usuario")]
    [Authorize]
    public async Task<ActionResult<ResumenMensualDto>> GetResumenMensualUsuario(
        [FromQuery] int? año, [FromQuery] int? mes)
    {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(idStr) || !int.TryParse(idStr, out var userId))
            return Unauthorized("No se pudo identificar al usuario desde el token.");

        var tz = GetBogotaTz();
        var nowLocal = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, tz);
        int A = año ?? nowLocal.Year;
        int M = mes ?? nowLocal.Month;

        var primerDiaMesLocal = new DateOnly(A, M, 1);
        var ultimoDiaMesLocal = primerDiaMesLocal.AddMonths(1).AddDays(-1);

        var usuario = await _ctx.Usuarios.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId);
        if (usuario == null) return NotFound("Usuario no encontrado.");

        // Resumen base (tardanzas, retiros, sobretiempo…)
        var resumenCompleto = await _resumenService.GetResumenCompletoMes(userId, A, M);

        // Ausencias del mes (aprobadas + inasistencias derivadas)
        var ausenciasMes = await ComputeAusenciasMesAsync(userId, A, M);
        int totalAusencias = ausenciasMes.Count;

        // Tardanzas no compensadas en minutos
        int totalTardanzas = resumenCompleto.Tardanzas.Count;
        int tardanzasCompensadas = resumenCompleto.Tardanzas.Count(t => t.Compensada);
        int minutosTardanzaNoComp = 0;
        foreach (var t in resumenCompleto.Tardanzas.Where(t => !t.Compensada))
            minutosTardanzaNoComp += (int)t.MinutosTarde.TotalMinutes;

        var sobretiempoFormateado =
            TimeSpan.FromMinutes(resumenCompleto.TotalSobretiempoMin).ToString(@"hh\:mm");
        string periodoStr =
            $"{primerDiaMesLocal:dd MMM}. - {ultimoDiaMesLocal:dd MMM yyyy}".ToUpper();

        var dto = new ResumenMensualDto(
            NombreCompleto: usuario.NombreCompleto,
            Cargo: "",
            Documento: "",
            FechaInicioLaboral: "",
            PeriodoActual: periodoStr,
            TotalAusencias: totalAusencias, // 👈 ahora incluye inasistencias derivadas
            TotalTardanzas: totalTardanzas,
            TotalDescansosExtendidos: 0,
            TotalRetirosTempranos: resumenCompleto.TotalRetirosTempranos,
            Sobretiempo: sobretiempoFormateado,
            TardanzasCompensadas: tardanzasCompensadas,
            TiempoTotalTardanzas: minutosTardanzaNoComp
        );

        return Ok(dto);
    }

    [Authorize]
    [HttpGet("tardanzas-detalle-mes")]
    public async Task<ActionResult<List<TardanzaDetalleDto>>> GetTardanzasDetalleMes(
        [FromQuery] int? año, [FromQuery] int? mes)
    {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(idStr, out var userId)) return Unauthorized();

        var tz = GetBogotaTz();
        var nowLocal = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, tz);
        int A = año ?? nowLocal.Year;
        int M = mes ?? nowLocal.Month;

        var resumenCompleto = await _resumenService.GetResumenCompletoMes(userId, A, M);
        return Ok(resumenCompleto.Tardanzas);
    }

    [Authorize]
    [HttpGet("ausencias-detalle-mes")]
    public async Task<ActionResult<List<AusenciaDetalleItemDto>>> GetAusenciasDetalleMes(
        [FromQuery] int? año, [FromQuery] int? mes)
    {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(idStr, out var userId)) return Unauthorized();

        var tz = GetBogotaTz();
        var nowLocal = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, tz);
        int A = año ?? nowLocal.Year;
        int M = mes ?? nowLocal.Month;

        var lista = await ComputeAusenciasMesAsync(userId, A, M);
        return Ok(lista);
    }
}