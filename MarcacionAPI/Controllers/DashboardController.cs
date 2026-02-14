using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using MarcacionAPI.Data;
using MarcacionAPI.DTOs;
using MarcacionAPI.DTOs.Dashboard;
using MarcacionAPI.Models;
using MarcacionAPI.Services;
using MarcacionAPI.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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

	private static TimeZoneInfo GetBogotaTz()
	{
		try
		{
			return TimeZoneInfo.FindSystemTimeZoneById("America/Bogota");
		}
		catch
		{
			return TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
		}
	}

	private async Task<(TimeSpan? entrada, TimeSpan? salida, int toleranciaMin, int descansoMin)> ResolveHorarioDelDia(int idUsuario, DateOnly dia)
	{
		var asig = await EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(from uh in EntityFrameworkQueryableExtensions.AsNoTracking<UsuarioHorario>((IQueryable<UsuarioHorario>)_ctx.UsuarioHorarios)
			where uh.IdUsuario == idUsuario && uh.Desde <= dia && (uh.Hasta == null || uh.Hasta >= dia)
			select new { uh.IdHorario }, default(CancellationToken));
		if (asig == null)
		{
			return (entrada: null, salida: null, toleranciaMin: 0, descansoMin: 0);
		}
		int dow = (int)(dia.DayOfWeek + 6) % 7 + 1;
		var anon = await EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(from d in EntityFrameworkQueryableExtensions.AsNoTracking<HorarioDetalle>((IQueryable<HorarioDetalle>)_ctx.HorarioDetalles)
			where d.IdHorario == asig.IdHorario && d.DiaSemana == dow
			select new { d.Laborable, d.HoraEntrada, d.HoraSalida, d.ToleranciaMin, d.DescansoMin }, default(CancellationToken));
		if (anon == null || !anon.Laborable || !anon.HoraEntrada.HasValue || !anon.HoraSalida.HasValue)
		{
			return (entrada: null, salida: null, toleranciaMin: 0, descansoMin: 0);
		}
		return (entrada: anon.HoraEntrada, salida: anon.HoraSalida, toleranciaMin: anon.ToleranciaMin.GetValueOrDefault(), descansoMin: anon.DescansoMin);
	}

	private async Task<List<AusenciaDetalleItemDto>> ComputeAusenciasMesAsync(int userId, int A, int M)
	{
		TimeZoneInfo tz = GetBogotaTz();
		DateOnly desdeLocal = new DateOnly(A, M, 1);
		DateOnly hastaLocal = desdeLocal.AddMonths(1).AddDays(-1);
		DateTime desdeUtc = TimeZoneInfo.ConvertTimeToUtc(desdeLocal.ToDateTime(TimeOnly.MinValue), tz);
		DateTime hastaUtc = TimeZoneInfo.ConvertTimeToUtc(hastaLocal.AddDays(1).ToDateTime(TimeOnly.MinValue), tz);
		var asign = await EntityFrameworkQueryableExtensions.ToListAsync(from uh in EntityFrameworkQueryableExtensions.AsNoTracking<UsuarioHorario>((IQueryable<UsuarioHorario>)_ctx.UsuarioHorarios)
			where uh.IdUsuario == userId && uh.Desde <= hastaLocal && (uh.Hasta == null || uh.Hasta >= desdeLocal)
			select new { uh.IdHorario, uh.Desde, uh.Hasta }, default(CancellationToken));
		if (asign.Count == 0)
		{
			return new List<AusenciaDetalleItemDto>();
		}
		List<int> horarioIds = asign.Select(a => a.IdHorario).Distinct().ToList();
		var detalles = await EntityFrameworkQueryableExtensions.ToListAsync(from d in EntityFrameworkQueryableExtensions.AsNoTracking<HorarioDetalle>((IQueryable<HorarioDetalle>)_ctx.HorarioDetalles)
			where horarioIds.Contains(d.IdHorario) && d.Laborable
			select new { d.IdHorario, d.DiaSemana }, default(CancellationToken));
		HashSet<DateOnly> feriadoSet = new HashSet<DateOnly>(await EntityFrameworkQueryableExtensions.ToListAsync<DateOnly>(from f in EntityFrameworkQueryableExtensions.AsNoTracking<Feriado>((IQueryable<Feriado>)_ctx.Feriados)
			where f.Fecha >= desdeLocal && f.Fecha <= hastaLocal
			select f.Fecha, default(CancellationToken)));
		var aprobadas = await EntityFrameworkQueryableExtensions.ToListAsync(from a in EntityFrameworkQueryableExtensions.AsNoTracking<Ausencia>((IQueryable<Ausencia>)_ctx.Ausencias)
			where a.IdUsuario == userId && a.Estado == "aprobada" && a.Hasta >= desdeLocal && a.Desde <= hastaLocal
			select new { a.Id, a.Tipo, a.Desde, a.Hasta, a.Observacion } into a
			orderby a.Desde
			select a, default(CancellationToken));
		HashSet<DateOnly> aprobadasFechas = new HashSet<DateOnly>();
		foreach (var item in aprobadas)
		{
			DateOnly dateOnly = item.Desde;
			while (dateOnly <= item.Hasta)
			{
				aprobadasFechas.Add(dateOnly);
				dateOnly = dateOnly.AddDays(1);
			}
		}
		HashSet<DateOnly> hashSet = (await EntityFrameworkQueryableExtensions.ToListAsync<DateTimeOffset>(from m in EntityFrameworkQueryableExtensions.AsNoTracking<Marcacion>((IQueryable<Marcacion>)_ctx.Marcaciones)
			where m.IdUsuario == userId && m.FechaHora >= (DateTimeOffset)desdeUtc && m.FechaHora < (DateTimeOffset)hastaUtc
			select m.FechaHora, default(CancellationToken))).Select((DateTimeOffset dt) => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(dt, tz).Date)).ToHashSet();
		List<AusenciaDetalleItemDto> list = new List<AusenciaDetalleItemDto>();
		foreach (var item2 in aprobadas)
		{
			list.Add(new AusenciaDetalleItemDto
			{
				Id = item2.Id,
				Tipo = item2.Tipo,
				Desde = item2.Desde.ToString("yyyy-MM-dd"),
				Hasta = item2.Hasta.ToString("yyyy-MM-dd"),
				Observacion = item2.Observacion
			});
		}
		DateOnly dia = desdeLocal;
		while (dia <= hastaLocal)
		{
			var asig = asign.FirstOrDefault(a => a.Desde <= dia && (!a.Hasta.HasValue || a.Hasta >= dia));
			if (asig != null && detalles.Any(d => d.IdHorario == asig.IdHorario && d.DiaSemana == Dow(dia)) && !feriadoSet.Contains(dia) && !aprobadasFechas.Contains(dia) && !hashSet.Contains(dia))
			{
				list.Add(new AusenciaDetalleItemDto
				{
					Id = A * 10000 + M * 100 + dia.Day,
					Tipo = "Inasistencia",
					Desde = dia.ToString("yyyy-MM-dd"),
					Hasta = dia.ToString("yyyy-MM-dd"),
					Observacion = "Día laborable sin marcaciones"
				});
			}
			dia = dia.AddDays(1);
		}
		return list.OrderBy((AusenciaDetalleItemDto r) => r.Desde).ToList();
		static int Dow(DateOnly d)
		{
			return (int)(d.DayOfWeek + 6) % 7 + 1;
		}
	}

	[Authorize(Roles = "admin,superadmin")]
	[HttpGet("metrics")]
	public async Task<ActionResult<DashboardMetricsResponseDto>> GetMetrics([FromQuery] DateOnly date, [FromQuery] int? idSede = null)
	{
		if (!base.User.IsSuperAdmin())
		{
			idSede = base.User.GetSedeId().GetValueOrDefault();
		}
		TimeZoneInfo tz = GetBogotaTz();
		DateTime inicioDiaUtc = TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(TimeOnly.MinValue), tz);
		DateTime finDiaUtc = inicioDiaUtc.AddDays(1.0);
		IQueryable<Usuario> usuariosQuery = from usuario in EntityFrameworkQueryableExtensions.AsNoTracking<Usuario>((IQueryable<Usuario>)_ctx.Usuarios)
			where usuario.Activo
			select usuario;
		if (idSede.HasValue && idSede.GetValueOrDefault() > 0)
		{
			usuariosQuery = usuariosQuery.Where((Usuario usuario) => usuario.IdSede == ((int?)idSede).Value);
		}
		List<int> usuariosIds = await EntityFrameworkQueryableExtensions.ToListAsync<int>(usuariosQuery.Select((Usuario usuario) => usuario.Id), default(CancellationToken));
		if (usuariosIds.Count == 0)
		{
			return Ok(new DashboardMetricsResponseDto(0, 0, 0, 0, 0, new List<TardanzaDto>()));
		}
		List<Marcacion> marcacionesHoy = await EntityFrameworkQueryableExtensions.ToListAsync<Marcacion>((IQueryable<Marcacion>)(from m in EntityFrameworkQueryableExtensions.AsNoTracking<Marcacion>((IQueryable<Marcacion>)_ctx.Marcaciones)
			where m.FechaHora >= (DateTimeOffset)inicioDiaUtc && m.FechaHora < (DateTimeOffset)finDiaUtc && usuariosIds.Contains(m.IdUsuario)
			orderby m.FechaHora
			select m), default(CancellationToken));
		int marcacionesHoyCount = marcacionesHoy.Count;
		List<int> presentesIds = (from m in marcacionesHoy
			where m.Tipo == "entrada"
			select m.IdUsuario).Distinct().ToList();
		int presentes = presentesIds.Count;
		int sinSalida = presentesIds.Count((int id) => marcacionesHoy.LastOrDefault((Marcacion m) => m.IdUsuario == id)?.Tipo == "entrada");
		int ausentes = usuariosIds.Count((int id) => !presentesIds.Contains(id));
		int tarde = 0;
		List<TardanzaDto> top = new List<TardanzaDto>();
		foreach (var u in await EntityFrameworkQueryableExtensions.ToListAsync(from usuario in usuariosQuery
			where presentesIds.Contains(usuario.Id)
			select new { usuario.Id, usuario.NombreCompleto }, default(CancellationToken)))
		{
			Marcacion firstIn = marcacionesHoy.FirstOrDefault((Marcacion m) => m.IdUsuario == u.Id && m.Tipo == "entrada");
			if (firstIn == null)
			{
				continue;
			}
			var (timeSpan, _, num, _) = await ResolveHorarioDelDia(u.Id, date);
			if (timeSpan.HasValue)
			{
				DateTimeOffset dateTimeOffset = TimeZoneInfo.ConvertTime(firstIn.FechaHora, tz);
				DateTime dateTime = date.ToDateTime(TimeOnly.FromTimeSpan(timeSpan.Value)).AddMinutes(num);
				if (dateTimeOffset > dateTime)
				{
					tarde++;
					double minutosTarde = Math.Round((dateTimeOffset - dateTime).TotalMinutes, 0);
					top.Add(new TardanzaDto(u.Id, u.NombreCompleto, timeSpan.Value, firstIn.FechaHora, minutosTarde));
				}
			}
		}
		return Ok(new DashboardMetricsResponseDto(presentes, ausentes, tarde, sinSalida, marcacionesHoyCount, top.OrderByDescending((TardanzaDto x) => x.MinutosTarde).Take(10).ToList()));
	}

	[HttpGet("resumen-mensual-usuario")]
	[Authorize]
	public async Task<ActionResult<ResumenMensualDto>> GetResumenMensualUsuario([FromQuery] int? año, [FromQuery] int? mes)
	{
		string text = base.User.FindFirstValue("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
		if (string.IsNullOrEmpty(text) || !int.TryParse(text, out var userId))
		{
			return Unauthorized("No se pudo identificar al usuario desde el token.");
		}
		TimeZoneInfo bogotaTz = GetBogotaTz();
		DateTimeOffset dateTimeOffset = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, bogotaTz);
		int A = año ?? dateTimeOffset.Year;
		int M = mes ?? dateTimeOffset.Month;
		DateOnly primerDiaMesLocal = new DateOnly(A, M, 1);
		DateOnly ultimoDiaMesLocal = primerDiaMesLocal.AddMonths(1).AddDays(-1);
		Usuario usuario = await EntityFrameworkQueryableExtensions.FirstOrDefaultAsync<Usuario>(EntityFrameworkQueryableExtensions.AsNoTracking<Usuario>((IQueryable<Usuario>)_ctx.Usuarios), (Expression<Func<Usuario, bool>>)((Usuario u) => u.Id == userId), default(CancellationToken));
		if (usuario == null)
		{
			return NotFound("Usuario no encontrado.");
		}
		ResumenCompletoDto resumenCompleto = await _resumenService.GetResumenCompletoMes(userId, A, M);
		int count = (await ComputeAusenciasMesAsync(userId, A, M)).Count;
		int count2 = resumenCompleto.Tardanzas.Count;
		int tardanzasCompensadas = resumenCompleto.Tardanzas.Count((TardanzaDetalleDto t) => t.Compensada);
		int num = 0;
		foreach (TardanzaDetalleDto item in resumenCompleto.Tardanzas.Where((TardanzaDetalleDto t) => !t.Compensada))
		{
			num += (int)item.MinutosTarde.TotalMinutes;
		}
		string sobretiempo = TimeSpan.FromMinutes(resumenCompleto.TotalSobretiempoMin).ToString("hh\\:mm");
		string periodoActual = $"{primerDiaMesLocal:dd MMM}. - {ultimoDiaMesLocal:dd MMM yyyy}".ToUpper();
		ResumenMensualDto value = new ResumenMensualDto(usuario.NombreCompleto, "", "", "", periodoActual, count, count2, 0, resumenCompleto.TotalRetirosTempranos, sobretiempo, tardanzasCompensadas, num);
		return Ok(value);
	}

	[Authorize]
	[HttpGet("tardanzas-detalle-mes")]
	public async Task<ActionResult<List<TardanzaDetalleDto>>> GetTardanzasDetalleMes([FromQuery] int? año, [FromQuery] int? mes)
	{
		string s = base.User.FindFirstValue("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
		if (!int.TryParse(s, out var result))
		{
			return Unauthorized();
		}
		TimeZoneInfo bogotaTz = GetBogotaTz();
		DateTimeOffset dateTimeOffset = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, bogotaTz);
		int año2 = año ?? dateTimeOffset.Year;
		int mes2 = mes ?? dateTimeOffset.Month;
		return Ok((await _resumenService.GetResumenCompletoMes(result, año2, mes2)).Tardanzas);
	}

	[Authorize]
	[HttpGet("ausencias-detalle-mes")]
	public async Task<ActionResult<List<AusenciaDetalleItemDto>>> GetAusenciasDetalleMes([FromQuery] int? año, [FromQuery] int? mes)
	{
		string s = base.User.FindFirstValue("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
		if (!int.TryParse(s, out var result))
		{
			return Unauthorized();
		}
		TimeZoneInfo bogotaTz = GetBogotaTz();
		DateTimeOffset dateTimeOffset = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, bogotaTz);
		int a = año ?? dateTimeOffset.Year;
		int m = mes ?? dateTimeOffset.Month;
		return Ok(await ComputeAusenciasMesAsync(result, a, m));
	}
}
