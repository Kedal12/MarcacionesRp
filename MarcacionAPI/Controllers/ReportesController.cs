using MarcacionAPI.Data;
using MarcacionAPI.DTOs;
using MarcacionAPI.Models;
using MarcacionAPI.Services; // AÑADIDO: Para IResumenService
using MarcacionAPI.Utils; // Para UserExtensions
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

[Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")] // Solo admins
[ApiController]
[Route("api/[controller]")]
public class ReportesController : ControllerBase
{
    private readonly ApplicationDbContext _ctx;

    // --- AÑADIDO: Inyección de IResumenService ---
    private readonly IResumenService _resumenService;

    public ReportesController(ApplicationDbContext ctx, IResumenService resumenService)
    {
        _ctx = ctx;
        _resumenService = resumenService; // AÑADIDO
    }

    // --- FIN AÑADIDO ---

    // Helper para obtener TimeZoneInfo (sin cambios)
    private static TimeZoneInfo GetBogotaTz()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("America/Bogota"); }
        catch { return TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time"); } // Fallback para Windows
    }

    // Helper para resolver el horario del día (sin cambios)
    private async Task<(TimeSpan? entrada, TimeSpan? salida, int tolerancia, int redondeo, int descanso)>
        ResolveHorarioDelDia(int idUsuario, DateOnly dia)
    {
        // busca asignación vigente
        var asig = await _ctx.UsuarioHorarios.AsNoTracking()
            .Where(uh => uh.IdUsuario == idUsuario
                && uh.Desde <= dia
                && (uh.Hasta == null || uh.Hasta >= dia))
            .Select(uh => new { uh.IdHorario })
            .FirstOrDefaultAsync();
        if (asig == null) return (null, null, 0, 0, 0);

        // Determina el día de la semana (Lunes=1..Domingo=7)
        int dow = ((int)dia.DayOfWeek + 6) % 7 + 1; // Lunes=1..Domingo=7

        var det = await _ctx.HorarioDetalles.AsNoTracking()
            .Where(d => d.IdHorario == asig.IdHorario && d.DiaSemana == dow)
            .Select(d => new { d.Laborable, d.HoraEntrada, d.HoraSalida, d.ToleranciaMin, d.RedondeoMin, d.DescansoMin })
            .FirstOrDefaultAsync();

        if (det == null || !det.Laborable || det.HoraEntrada is null || det.HoraSalida is null)
            return (null, null, 0, 0, 0); // No laborable o sin detalle

        // --- CORRECCIÓN LÍNEA 54 ---
        // Se añade '?? 0' a ToleranciaMin para convertir 'int?' a 'int'
        return (det.HoraEntrada, det.HoraSalida, det.ToleranciaMin ?? 0, det.RedondeoMin, det.DescansoMin);
        // --- FIN CORRECCIÓN ---
    }

    // GET api/reportes/horas?idUsuario=&idSede=&desde=&hasta=
    [HttpGet("horas")]
    public async Task<IActionResult> Horas([FromQuery] ReporteHorasRequestDto q)
    {
        // --- LÓGICA DE SEDE AÑADIDA ---
        var sedeIdFiltrada = q.IdSede;
        var idUsuarioFiltrado = q.IdUsuario;

        if (!User.IsSuperAdmin())
        {
            // Forzar el filtro de sede al del admin
            sedeIdFiltrada = User.GetSedeId() ?? 0;

            // Si el admin (no superadmin) intenta filtrar por un usuario específico,
            // verificar que ese usuario pertenezca a SU sede.
            if (idUsuarioFiltrado.HasValue && idUsuarioFiltrado.Value > 0)
            {
                var usuarioSede = await _ctx.Usuarios.AsNoTracking()
                                    .Where(u => u.Id == idUsuarioFiltrado.Value)
                                    .Select(u => u.IdSede)
                                    .FirstOrDefaultAsync();
                if (usuarioSede == 0 || usuarioSede != sedeIdFiltrada)
                {
                    // El admin intenta ver un usuario que no es de su sede.
                    return Forbid("No puedes ver reportes de usuarios de otra sede.");
                }
            }
        }
        // --- FIN LÓGICA DE SEDE ---

        // Define el rango de fechas para buscar feriados y ausencias
        var fechaInicio = q.Desde?.Date ?? DateTimeOffset.MinValue.Date;
        var fechaFin = q.Hasta?.Date ?? DateTimeOffset.MaxValue.Date;
        var inicioDateOnly = DateOnly.FromDateTime(fechaInicio);
        var finDateOnly = DateOnly.FromDateTime(fechaFin);

        // --- 1. OBTENER FERIADOS DEL RANGO ---
        var feriadosLookup = await _ctx.Feriados
                                        .Where(f => f.Fecha >= inicioDateOnly && f.Fecha <= finDateOnly)
                                        .ToDictionaryAsync(f => f.Fecha, f => f);

        // --- 2. OBTENER AUSENCIAS APROBADAS DEL RANGO ---
        var ausenciasQuery = _ctx.Ausencias.AsNoTracking()
                                .Where(a => a.Estado == EstadoAusencia.Aprobada &&
                                    a.Desde <= finDateOnly &&
                                    a.Hasta >= inicioDateOnly);

        // Aplicar filtros validados
        if (idUsuarioFiltrado is > 0)
        {
            ausenciasQuery = ausenciasQuery.Where(a => a.IdUsuario == idUsuarioFiltrado.Value);
        }
        else if (sedeIdFiltrada is > 0)
        {
            ausenciasQuery = ausenciasQuery.Include(a => a.Usuario)
                                        .Where(a => a.Usuario != null && a.Usuario.IdSede == sedeIdFiltrada.Value);
        }

        var ausenciasLookup = (await ausenciasQuery.ToListAsync())
                                    .ToLookup(a => a.IdUsuario, a => a);
        // --- FIN OBTENER AUSENCIAS ---

        // --- 3. OBTENER MARCACIONES (usando filtros validados) ---
        var marc = _ctx.Marcaciones.AsNoTracking();

        if (idUsuarioFiltrado is > 0)
        {
            marc = marc.Where(m => m.IdUsuario == idUsuarioFiltrado.Value);
        }

        if (sedeIdFiltrada is > 0)
        {
            marc =
                from m in marc
                join u in _ctx.Usuarios.AsNoTracking() on m.IdUsuario equals u.Id
                where u.IdSede == sedeIdFiltrada.Value
                select m;
        }

        if (q.Desde.HasValue) marc = marc.Where(m => m.FechaHora >= q.Desde.Value);
        if (q.Hasta.HasValue) marc = marc.Where(m => m.FechaHora <= q.Hasta.Value);

        var raw = await (
            from m in marc
            join u in _ctx.Usuarios.AsNoTracking() on m.IdUsuario equals u.Id
            orderby m.IdUsuario, m.FechaHora
            select new { m.IdUsuario, u.NombreCompleto, m.FechaHora, m.Tipo }
        ).ToListAsync();
        // --- FIN OBTENER MARCACIONES ---

        // --- 4. PROCESAR Y GENERAR REPORTE ---
        var tz = GetBogotaTz();
        var result = new List<object>();

        foreach (var grp in raw.GroupBy(x => new { x.IdUsuario, Dia = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(x.FechaHora, tz).Date) }))
        {
            var idUsuarioActual = grp.Key.IdUsuario;
            var diaActual = grp.Key.Dia;
            var nombre = raw.First(x => x.IdUsuario == idUsuarioActual).NombreCompleto;
            var orden = grp.OrderBy(x => x.FechaHora).ToList();

            DateTimeOffset? entrada = null;
            double horas = 0;
            int incompletas = 0;
            DateTimeOffset? primeraEntrada = null;
            DateTimeOffset? ultimaSalida = null;
            string? notaDia = null;
            double tardanzaMin = 0, salidaAnticipadaMin = 0, extraMin = 0;

            foreach (var m in orden)
            {
                if (m.Tipo == "entrada")
                {
                    if (entrada == null)
                    {
                        entrada = m.FechaHora;
                        primeraEntrada ??= m.FechaHora;
                    }
                    else
                    {
                        incompletas++; entrada = m.FechaHora;
                    }
                }
                else
                { // salida
                    if (entrada != null)
                    {
                        horas += (m.FechaHora - entrada.Value).TotalHours;
                        ultimaSalida = m.FechaHora;
                        entrada = null;
                    }
                    else
                    {
                        incompletas++;
                    }
                }
            }
            if (entrada != null) incompletas++;

            // --- VERIFICAR FERIADO Y AUSENCIA ---
            Feriado? feriadoDelDia = null;
            Ausencia? ausenciaDelDia = null;

            if (feriadosLookup.TryGetValue(diaActual, out feriadoDelDia))
            {
                if (!feriadoDelDia.Laborable)
                {
                    notaDia = $"Feriado: {feriadoDelDia.Nombre}";
                    goto FinCalculosDia;
                }
                else
                {
                    notaDia = $"Feriado Laborable: {feriadoDelDia.Nombre}";
                }
            }

            if (notaDia == null || (feriadoDelDia != null && feriadoDelDia.Laborable))
            {
                ausenciaDelDia = ausenciasLookup[idUsuarioActual]
                                    .FirstOrDefault(a => diaActual >= a.Desde && diaActual <= a.Hasta);
                if (ausenciaDelDia != null)
                {
                    notaDia = $"Ausente ({ausenciaDelDia.Tipo})";
                    goto FinCalculosDia;
                }
            }
            // --- FIN VERIFICAR ---

            // --- Si NO es feriado no laborable NI ausencia, calcula horario ---
            var (hIn, hOut, tol, _, descanso) = await ResolveHorarioDelDia(idUsuarioActual, diaActual);

            if (hIn.HasValue && hOut.HasValue)
            {
                if (primeraEntrada.HasValue)
                {
                    var localEntrada = TimeZoneInfo.ConvertTime(primeraEntrada.Value, tz);
                    // --- CORRECCIÓN: Convertir DateTime a DateOnly ANTES de llamar ToDateTime ---
                    var progIn = DateOnly.FromDateTime(localEntrada.Date).ToDateTime(TimeOnly.FromTimeSpan(hIn.Value));
                    // --- FIN CORRECCIÓN ---
                    var delta = (localEntrada - progIn).TotalMinutes - tol;
                    if (delta > 0) tardanzaMin = Math.Round(delta, 0);
                }
                if (ultimaSalida.HasValue)
                {
                    var localSalida = TimeZoneInfo.ConvertTime(ultimaSalida.Value, tz);
                    // --- CORRECCIÓN: Convertir DateTime a DateOnly ANTES de llamar ToDateTime ---
                    var progOut = DateOnly.FromDateTime(localSalida.Date).ToDateTime(TimeOnly.FromTimeSpan(hOut.Value));
                    // --- FIN CORRECCIÓN ---
                    var delta2 = (progOut - localSalida).TotalMinutes;
                    if (delta2 > 0) salidaAnticipadaMin = Math.Round(delta2, 0);

                    var extra = (localSalida - progOut).TotalMinutes;
                    if (extra > 0) extraMin = Math.Round(extra, 0);
                }
                horas = Math.Max(0, horas - (descanso / 60.0));
            }
        // --- FIN CÁLCULO HORARIO ---

        FinCalculosDia:

            result.Add(new
            {
                IdUsuario = idUsuarioActual,
                Nombre = nombre,
                Dia = diaActual,
                NotaDia = notaDia,
                PrimeraEntrada = primeraEntrada,
                UltimaSalida = ultimaSalida,
                Horas = Math.Round(horas, 2),
                MarcacionesIncompletas = incompletas,
                TardanzaMin = tardanzaMin,
                SalidaAnticipadaMin = salidaAnticipadaMin,
                ExtraMin = extraMin
            });
        }
        // --- FIN PROCESAR ---

        return Ok(result.OrderBy(r => ((dynamic)r).Nombre).ThenBy(r => ((dynamic)r).Dia));
    }

    // --- AÑADIDO: Nuevo Endpoint para Reporte de Tardanzas ---
    /// <summary>
    /// Obtiene un reporte de tardanzas (no compensadas) para un usuario en un mes específico.
    /// </summary>
    [HttpGet("tardanzas")]
    public async Task<IActionResult> ReporteTardanzas(
        [FromQuery] int año,
        [FromQuery] int mes,
        [FromQuery] int idUsuario)
    {
        // --- 1. Seguridad de Sede (lógica similar a /horas) ---
        if (!User.IsSuperAdmin())
        {
            var sedeIdAdmin = User.GetSedeId();
            var usuarioSede = await _ctx.Usuarios.AsNoTracking()
                                .Where(u => u.Id == idUsuario)
                                .Select(u => u.IdSede)
                                .FirstOrDefaultAsync();

            if (usuarioSede == 0 || usuarioSede != sedeIdAdmin)
            {
                return Forbid("No puedes ver reportes de usuarios de otra sede.");
            }
        }
        // --- Fin Seguridad ---

        // --- 2. Llamar al servicio ---
        try
        {
            var resumenCompleto = await _resumenService.GetResumenCompletoMes(idUsuario, año, mes);
            return Ok(resumenCompleto.Tardanzas);
        }
        catch (Exception ex)
        {
            // Captura errores del servicio (ej. "Usuario sin horario")
            return BadRequest(new { error = ex.Message });
        }
    }

    // --- FIN AÑADIDO ---
}