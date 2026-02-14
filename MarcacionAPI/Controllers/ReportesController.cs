using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using ClosedXML.Excel;
using MarcacionAPI.Data;
using MarcacionAPI.DTOs;
using MarcacionAPI.Models;
using MarcacionAPI.Services;
using MarcacionAPI.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[Authorize(Roles = "admin,superadmin")]
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

    private async Task<(TimeSpan? entrada, TimeSpan? salida, int tolerancia, int redondeo, int descanso)> ResolveHorarioDelDia(int idUsuario, DateOnly dia)
    {
        var asig = await _ctx.UsuarioHorarios.AsNoTracking()
            .Where(uh => uh.IdUsuario == idUsuario && uh.Desde <= dia && (uh.Hasta == null || uh.Hasta >= dia))
            .Select(uh => new { uh.IdHorario })
            .FirstOrDefaultAsync();

        if (asig == null) return (null, null, 0, 0, 0);

        int dow = (int)(dia.DayOfWeek + 6) % 7 + 1;
        var d = await _ctx.HorarioDetalles.AsNoTracking()
            .Where(hd => hd.IdHorario == asig.IdHorario && hd.DiaSemana == dow)
            .Select(hd => new { hd.Laborable, hd.HoraEntrada, hd.HoraSalida, hd.ToleranciaMin, hd.RedondeoMin, hd.DescansoMin })
            .FirstOrDefaultAsync();

        if (d == null || !d.Laborable || !d.HoraEntrada.HasValue || !d.HoraSalida.HasValue)
            return (null, null, 0, 0, 0);

        return (d.HoraEntrada, d.HoraSalida, d.ToleranciaMin ?? 0, d.RedondeoMin, d.DescansoMin);
    }

    [HttpGet("horas")]
    public async Task<IActionResult> Horas([FromQuery] ReporteHorasRequestDto q)
    {
        int? idUsuarioFiltrado = q.IdUsuario;
        if (!string.IsNullOrWhiteSpace(q.NumeroDocumento))
        {
            var usuario = await _ctx.Usuarios.AsNoTracking().FirstOrDefaultAsync(u => u.NumeroDocumento == q.NumeroDocumento.Trim());
            if (usuario == null) return Ok(new List<ReporteHorasDetalladoDto>());
            idUsuarioFiltrado = usuario.Id;
        }

        int? sedeIdFiltrada = !User.IsSuperAdmin() ? User.GetSedeId() : q.IdSede;

        var inicioDO = DateOnly.FromDateTime(q.Desde?.Date ?? DateTimeOffset.MinValue.Date);
        var finDO = DateOnly.FromDateTime(q.Hasta?.Date ?? DateTimeOffset.MaxValue.Date);

        var feriadosLookup = await _ctx.Feriados
            .Where(f => f.Fecha >= inicioDO && f.Fecha <= finDO)
            .ToDictionaryAsync(f => f.Fecha);

        var ausencias = await _ctx.Ausencias.AsNoTracking()
            .Where(a => a.Estado == "aprobada" && a.Desde <= finDO && a.Hasta >= inicioDO)
            .ToListAsync();
        var ausenciasLookup = ausencias.ToLookup(a => a.IdUsuario);

        var queryMarcaciones = _ctx.Marcaciones.AsNoTracking().AsQueryable();
        if (idUsuarioFiltrado.HasValue) queryMarcaciones = queryMarcaciones.Where(m => m.IdUsuario == idUsuarioFiltrado);
        if (q.Desde.HasValue) queryMarcaciones = queryMarcaciones.Where(m => m.FechaHora >= q.Desde.Value);
        if (q.Hasta.HasValue) queryMarcaciones = queryMarcaciones.Where(m => m.FechaHora <= q.Hasta.Value);

        var raw = await (from m in queryMarcaciones
                         join u in _ctx.Usuarios.AsNoTracking() on m.IdUsuario equals u.Id
                         where (sedeIdFiltrada == null || u.IdSede == sedeIdFiltrada)
                         orderby m.IdUsuario, m.FechaHora
                         select new { m.IdUsuario, u.NombreCompleto, m.FechaHora, m.Tipo }).ToListAsync();

        TimeZoneInfo tz = GetBogotaTz();
        var resultado = new List<ReporteHorasDetalladoDto>();

        var grupos = raw.GroupBy(x => new { x.IdUsuario, Dia = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(x.FechaHora, tz).Date) });

        foreach (var g in grupos)
        {
            var dto = new ReporteHorasDetalladoDto
            {
                IdUsuario = g.Key.IdUsuario,
                Nombre = g.First().NombreCompleto,
                Dia = g.Key.Dia
            };

            DateTimeOffset? tempEntrada = null;
            foreach (var m in g.OrderBy(x => x.FechaHora))
            {
                if (m.Tipo == "entrada")
                {
                    if (tempEntrada == null) { tempEntrada = m.FechaHora; if (dto.PrimeraEntrada == null) dto.PrimeraEntrada = m.FechaHora; }
                    else { dto.MarcacionesIncompletas++; tempEntrada = m.FechaHora; }
                }
                else if (tempEntrada.HasValue)
                {
                    dto.Horas += (m.FechaHora - tempEntrada.Value).TotalHours;
                    dto.UltimaSalida = m.FechaHora;
                    tempEntrada = null;
                }
                else dto.MarcacionesIncompletas++;
            }
            if (tempEntrada.HasValue) dto.MarcacionesIncompletas++;

            // Lógica de Notas (Feriados/Ausencias)
            if (feriadosLookup.TryGetValue(dto.Dia, out var feriado))
                dto.NotaDia = feriado.Laborable ? $"Feriado Lab: {feriado.Nombre}" : $"Feriado: {feriado.Nombre}";

            var ausencia = ausenciasLookup[dto.IdUsuario].FirstOrDefault(a => dto.Dia >= a.Desde && dto.Dia <= a.Hasta);
            if (ausencia != null) dto.NotaDia = $"Ausente ({ausencia.Tipo})";

            // Cálculos de Ley Colombia
            var horario = await ResolveHorarioDelDia(dto.IdUsuario, dto.Dia);
            if (horario.entrada.HasValue && dto.PrimeraEntrada.HasValue && dto.UltimaSalida.HasValue)
            {
                var pEnt = TimeZoneInfo.ConvertTime(dto.PrimeraEntrada.Value, tz).DateTime;
                var uSal = TimeZoneInfo.ConvertTime(dto.UltimaSalida.Value, tz).DateTime;
                var hProgEnt = dto.Dia.ToDateTime(TimeOnly.FromTimeSpan(horario.entrada.Value));
                var hProgSal = dto.Dia.ToDateTime(TimeOnly.FromTimeSpan(horario.salida.Value));

                double tardanza = (pEnt - hProgEnt).TotalMinutes - horario.tolerancia;
                if (tardanza > 0) dto.TardanzaMin = Math.Round(tardanza, 0);

                double salidaAnt = (hProgSal - uSal).TotalMinutes;
                if (salidaAnt > 0) dto.SalidaAnticipadaMin = Math.Round(salidaAnt, 0);

                // Cálculo de Extras (Minuto a Minuto)
                if (uSal > hProgSal)
                {
                    for (var curr = hProgSal; curr < uSal; curr = curr.AddMinutes(1))
                    {
                        if (curr.Hour >= 19 || curr.Hour < 6) dto.HorasExtraNocturnas += 1.0 / 60.0;
                        else dto.HorasExtraDiurnas += 1.0 / 60.0;
                    }
                }
                // Recargo Nocturno Ordinario (Dentro de jornada)
                var inicioRno = pEnt > hProgEnt ? pEnt : hProgEnt;
                var finRno = uSal < hProgSal ? uSal : hProgSal;
                for (var curr = inicioRno; curr < finRno; curr = curr.AddMinutes(1))
                {
                    if (curr.Hour >= 19 || curr.Hour < 6) dto.HorasRecargoNocturnoOrdinario += 1.0 / 60.0;
                }

                dto.Horas = Math.Max(0, dto.Horas - (horario.descanso / 60.0));
            }
            dto.Horas = Math.Round(dto.Horas, 2);
            resultado.Add(dto);
        }

        return Ok(resultado.OrderBy(r => r.Nombre).ThenBy(r => r.Dia));
    }

    [HttpGet("exportar-excel")]
    public async Task<IActionResult> ExportarExcel([FromQuery] ReporteHorasRequestDto q)
    {
        var actionRes = await Horas(q);
        if (actionRes is not OkObjectResult ok || ok.Value is not IEnumerable<ReporteHorasDetalladoDto> data || !data.Any())
            return NotFound("No hay datos");

        using var book = new XLWorkbook();
        var sheet = book.Worksheets.Add("Reporte");
        string[] headers = { "Usuario", "Día", "Nota", "Entrada", "Salida", "Horas", "Incompletas", "Tardanza", "HED", "HEN", "RNO" };
        for (int i = 0; i < headers.Length; i++) sheet.Cell(1, i + 1).Value = headers[i];

        int row = 2;
        foreach (var item in data)
        {
            sheet.Cell(row, 1).Value = item.Nombre;
            sheet.Cell(row, 2).Value = item.Dia.ToString("dd/MM/yyyy");
            sheet.Cell(row, 3).Value = item.NotaDia ?? "-";
            sheet.Cell(row, 4).Value = item.PrimeraEntrada?.ToString("HH:mm") ?? "-";
            sheet.Cell(row, 5).Value = item.UltimaSalida?.ToString("HH:mm") ?? "-";
            sheet.Cell(row, 6).Value = item.Horas;
            sheet.Cell(row, 7).Value = item.MarcacionesIncompletas;
            sheet.Cell(row, 8).Value = item.TardanzaMin;
            sheet.Cell(row, 9).Value = Math.Round(item.HorasExtraDiurnas, 2);
            sheet.Cell(row, 10).Value = Math.Round(item.HorasExtraNocturnas, 2);
            sheet.Cell(row, 11).Value = Math.Round(item.HorasRecargoNocturnoOrdinario, 2);
            row++;
        }
        sheet.Columns().AdjustToContents();
        using var ms = new MemoryStream();
        book.SaveAs(ms);
        return File(ms.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Reporte.xlsx");
    }

    [HttpGet("tardanzas")]
    public async Task<IActionResult> ReporteTardanzas([FromQuery] int año, [FromQuery] int mes, [FromQuery] int idUsuario)
    {
        try { return Ok((await _resumenService.GetResumenCompletoMes(idUsuario, año, mes)).Tardanzas); }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }
}