using MarcacionAPI.Data;
using MarcacionAPI.DTOs;
using MarcacionAPI.Models;
using MarcacionAPI.Services;
using MarcacionAPI.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ClosedXML.Excel;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

[Authorize(Roles = $"{Roles.Admin},{Roles.SuperAdmin}")]
[ApiController]
[Route("api/[controller]")]
public class ReportesController : ControllerBase
{
    private readonly ApplicationDbContext _ctx;
    private readonly IResumenService _resumenService;

    public ReportesController(ApplicationDbContext ctx, IResumenService resumenService)
    {
        _ctx = ctx;
        _resumenService = resumenService;
    }

    private static TimeZoneInfo GetBogotaTz()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("America/Bogota"); }
        catch { return TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time"); }
    }

    private async Task<(TimeSpan? entrada, TimeSpan? salida, int tolerancia, int redondeo, int descanso)>
        ResolveHorarioDelDia(int idUsuario, DateOnly dia)
    {
        var asig = await _ctx.UsuarioHorarios.AsNoTracking()
            .Where(uh => uh.IdUsuario == idUsuario
                && uh.Desde <= dia
                && (uh.Hasta == null || uh.Hasta >= dia))
            .Select(uh => new { uh.IdHorario })
            .FirstOrDefaultAsync();
        if (asig == null) return (null, null, 0, 0, 0);

        int dow = ((int)dia.DayOfWeek + 6) % 7 + 1;

        var det = await _ctx.HorarioDetalles.AsNoTracking()
            .Where(d => d.IdHorario == asig.IdHorario && d.DiaSemana == dow)
            .Select(d => new { d.Laborable, d.HoraEntrada, d.HoraSalida, d.ToleranciaMin, d.RedondeoMin, d.DescansoMin })
            .FirstOrDefaultAsync();

        if (det == null || !det.Laborable || det.HoraEntrada is null || det.HoraSalida is null)
            return (null, null, 0, 0, 0);

        return (det.HoraEntrada, det.HoraSalida, det.ToleranciaMin ?? 0, det.RedondeoMin, det.DescansoMin);
    }

    // GET api/reportes/horas?idUsuario=&idSede=&desde=&hasta=&numeroDocumento=
    [HttpGet("horas")]
    public async Task<IActionResult> Horas([FromQuery] ReporteHorasRequestDto q)
    {
        int? idUsuarioFiltrado = q.IdUsuario;

        if (!string.IsNullOrWhiteSpace(q.NumeroDocumento))
        {
            var usuarioEncontrado = await _ctx.Usuarios
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.NumeroDocumento == q.NumeroDocumento.Trim());

            if (usuarioEncontrado != null)
            {
                // Sobreescribimos la variable local con el ID del usuario encontrado
                idUsuarioFiltrado = usuarioEncontrado.Id;
            }
            else
            {
                // Si buscó por documento y no existe, devolver vacío inmediatamente
                return Ok(new List<object>());
            }
        }

        var sedeIdFiltrada = q.IdSede;
        if (!User.IsSuperAdmin())
        {
            sedeIdFiltrada = User.GetSedeId() ?? 0;

            if (idUsuarioFiltrado.HasValue && idUsuarioFiltrado.Value > 0)
            {
                var usuarioSede = await _ctx.Usuarios.AsNoTracking()
                                    .Where(u => u.Id == idUsuarioFiltrado.Value)
                                    .Select(u => u.IdSede)
                                    .FirstOrDefaultAsync();
                if (usuarioSede == 0 || usuarioSede != sedeIdFiltrada)
                {
                    return Forbid("No puedes ver reportes de usuarios de otra sede.");
                }
            }
        }

        var fechaInicio = q.Desde?.Date ?? DateTimeOffset.MinValue.Date;
        var fechaFin = q.Hasta?.Date ?? DateTimeOffset.MaxValue.Date;
        var inicioDateOnly = DateOnly.FromDateTime(fechaInicio);
        var finDateOnly = DateOnly.FromDateTime(fechaFin);

        var feriadosLookup = await _ctx.Feriados
                                        .Where(f => f.Fecha >= inicioDateOnly && f.Fecha <= finDateOnly)
                                        .ToDictionaryAsync(f => f.Fecha, f => f);

        var ausenciasQuery = _ctx.Ausencias.AsNoTracking()
                                .Where(a => a.Estado == EstadoAusencia.Aprobada &&
                                    a.Desde <= finDateOnly &&
                                    a.Hasta >= inicioDateOnly);

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

        var marc = _ctx.Marcaciones.AsNoTracking();

        if (idUsuarioFiltrado.HasValue && idUsuarioFiltrado.Value > 0)
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
                {
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

            var (hIn, hOut, tol, _, descanso) = await ResolveHorarioDelDia(idUsuarioActual, diaActual);

            if (hIn.HasValue && hOut.HasValue)
            {
                if (primeraEntrada.HasValue)
                {
                    var localEntrada = TimeZoneInfo.ConvertTime(primeraEntrada.Value, tz);
                    var progIn = DateOnly.FromDateTime(localEntrada.Date).ToDateTime(TimeOnly.FromTimeSpan(hIn.Value));
                    var delta = (localEntrada - progIn).TotalMinutes - tol;
                    if (delta > 0) tardanzaMin = Math.Round(delta, 0);
                }
                if (ultimaSalida.HasValue)
                {
                    var localSalida = TimeZoneInfo.ConvertTime(ultimaSalida.Value, tz);
                    var progOut = DateOnly.FromDateTime(localSalida.Date).ToDateTime(TimeOnly.FromTimeSpan(hOut.Value));
                    var delta2 = (progOut - localSalida).TotalMinutes;
                    if (delta2 > 0) salidaAnticipadaMin = Math.Round(delta2, 0);

                    var extra = (localSalida - progOut).TotalMinutes;
                    if (extra > 0) extraMin = Math.Round(extra, 0);
                }
                horas = Math.Max(0, horas - (descanso / 60.0));
            }

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

        return Ok(result.OrderBy(r => ((dynamic)r).Nombre).ThenBy(r => ((dynamic)r).Dia));
    }

    // ✅ GET api/reportes/exportar-excel - Reporte completo con cálculos
    [HttpGet("exportar-excel")]
    public async Task<IActionResult> ExportarExcel(
        [FromQuery] string? numeroDocumento,
        [FromQuery] int? idSede,
        [FromQuery] DateTimeOffset? desde,
        [FromQuery] DateTimeOffset? hasta)
    {
        try
        {
            // Reutilizar completamente la lógica del endpoint /horas
            var dto = new ReporteHorasRequestDto
            {
                NumeroDocumento = numeroDocumento,
                IdSede = idSede,
                Desde = desde,
                Hasta = hasta
            };

            // Llamar al endpoint Horas para obtener los datos calculados
            var horasResult = await Horas(dto);

            if (horasResult is not OkObjectResult okResult)
            {
                return NotFound("No se encontraron datos para exportar");
            }

            var datos = okResult.Value as IEnumerable<dynamic>;
            if (datos == null || !datos.Any())
            {
                return NotFound("No se encontraron registros para exportar");
            }

            // Crear Excel
            using var workbook = new XLWorkbook();
            var worksheet = workbook.Worksheets.Add("Reporte de Horas");

            // Encabezados
            worksheet.Cell(1, 1).Value = "Usuario";
            worksheet.Cell(1, 2).Value = "Día";
            worksheet.Cell(1, 3).Value = "Nota";
            worksheet.Cell(1, 4).Value = "Primera Entrada";
            worksheet.Cell(1, 5).Value = "Última Salida";
            worksheet.Cell(1, 6).Value = "Horas (Netas)";
            worksheet.Cell(1, 7).Value = "Marc. Incompletas";
            worksheet.Cell(1, 8).Value = "Tardanza (min)";
            worksheet.Cell(1, 9).Value = "Salida Antic. (min)";
            worksheet.Cell(1, 10).Value = "Extra (min)";

            // Estilo encabezados
            var headerRange = worksheet.Range(1, 1, 1, 10);
            headerRange.Style.Font.Bold = true;
            headerRange.Style.Fill.BackgroundColor = XLColor.FromArgb(79, 129, 189);
            headerRange.Style.Font.FontColor = XLColor.White;
            headerRange.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

            // Datos
            var tz = GetBogotaTz();
            int row = 2;

            foreach (dynamic d in datos)
            {
                worksheet.Cell(row, 1).Value = d.Nombre ?? "";
                worksheet.Cell(row, 2).Value = ((DateOnly)d.Dia).ToString("dd/MM/yyyy");
                worksheet.Cell(row, 3).Value = d.NotaDia ?? "-";

                // Primera Entrada
                if (d.PrimeraEntrada != null)
                {
                    var entrada = TimeZoneInfo.ConvertTime((DateTimeOffset)d.PrimeraEntrada, tz);
                    worksheet.Cell(row, 4).Value = entrada.ToString("HH:mm:ss");
                }
                else
                {
                    worksheet.Cell(row, 4).Value = "-";
                }

                // Última Salida
                if (d.UltimaSalida != null)
                {
                    var salida = TimeZoneInfo.ConvertTime((DateTimeOffset)d.UltimaSalida, tz);
                    worksheet.Cell(row, 5).Value = salida.ToString("HH:mm:ss");
                }
                else
                {
                    worksheet.Cell(row, 5).Value = "-";
                }

                worksheet.Cell(row, 6).Value = (double)d.Horas;
                worksheet.Cell(row, 7).Value = (int)d.MarcacionesIncompletas;
                worksheet.Cell(row, 8).Value = (double)d.TardanzaMin;
                worksheet.Cell(row, 9).Value = (double)d.SalidaAnticipadaMin;
                worksheet.Cell(row, 10).Value = (double)d.ExtraMin;

                // Formato condicional para tardanzas
                if ((double)d.TardanzaMin > 0)
                {
                    worksheet.Cell(row, 8).Style.Font.FontColor = XLColor.DarkOrange;
                    worksheet.Cell(row, 8).Style.Font.Bold = true;
                }

                // Formato condicional para salidas anticipadas
                if ((double)d.SalidaAnticipadaMin > 0)
                {
                    worksheet.Cell(row, 9).Style.Font.FontColor = XLColor.DarkOrange;
                    worksheet.Cell(row, 9).Style.Font.Bold = true;
                }

                // Formato condicional para extras
                if ((double)d.ExtraMin > 0)
                {
                    worksheet.Cell(row, 10).Style.Font.FontColor = XLColor.Green;
                    worksheet.Cell(row, 10).Style.Font.Bold = true;
                }

                row++;
            }

            // Ajustar columnas
            worksheet.Columns().AdjustToContents();

            // Agregar bordes
            var dataRange = worksheet.Range(1, 1, row - 1, 10);
            dataRange.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            dataRange.Style.Border.InsideBorder = XLBorderStyleValues.Thin;

            // Generar archivo
            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            stream.Position = 0;

            var fileName = string.IsNullOrWhiteSpace(numeroDocumento)
                ? $"Reporte_Horas_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx"
                : $"Reporte_Horas_{numeroDocumento}_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";

            return File(
                stream.ToArray(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                fileName
            );
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error generando Excel: {ex.Message}");
            Console.WriteLine($"Stack trace: {ex.StackTrace}");
            return StatusCode(500, $"Error al generar el Excel: {ex.Message}");
        }
    }

    [HttpGet("tardanzas")]
    public async Task<IActionResult> ReporteTardanzas(
        [FromQuery] int año,
        [FromQuery] int mes,
        [FromQuery] int idUsuario)
    {
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

        try
        {
            var resumenCompleto = await _resumenService.GetResumenCompletoMes(idUsuario, año, mes);
            return Ok(resumenCompleto.Tardanzas);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}