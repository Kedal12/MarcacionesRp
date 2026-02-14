using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using MarcacionAPI.Data;
using MarcacionAPI.DTOs;
using MarcacionAPI.Models;
using Microsoft.EntityFrameworkCore;

namespace MarcacionAPI.Services;

public class ResumenService : IResumenService
{
	private readonly ApplicationDbContext _context;

	public ResumenService(ApplicationDbContext context)
	{
		_context = context;
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

	private async Task<(TimeSpan? entrada, TimeSpan? salida, int tolerancia, bool laborable)> ResolveHorarioDelDiaSimple(int idUsuario, DateOnly dia)
	{
		var asig = await EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(from uh in EntityFrameworkQueryableExtensions.AsNoTracking<UsuarioHorario>((IQueryable<UsuarioHorario>)_context.UsuarioHorarios)
			where uh.IdUsuario == idUsuario && uh.Desde <= dia && (uh.Hasta == null || uh.Hasta >= dia)
			select new { uh.IdHorario }, default(CancellationToken));
		if (asig == null)
		{
			return (entrada: null, salida: null, tolerancia: 0, laborable: false);
		}
		int dow = (int)(dia.DayOfWeek + 6) % 7 + 1;
		var anon = await EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(from d in EntityFrameworkQueryableExtensions.AsNoTracking<HorarioDetalle>((IQueryable<HorarioDetalle>)_context.HorarioDetalles)
			where d.IdHorario == asig.IdHorario && d.DiaSemana == dow
			select new
			{
				Laborable = d.Laborable,
				HoraEntrada = d.HoraEntrada,
				HoraSalida = d.HoraSalida,
				Tol = (d.ToleranciaMin ?? 0)
			}, default(CancellationToken));
		if (anon == null || !anon.Laborable || !anon.HoraEntrada.HasValue || !anon.HoraSalida.HasValue)
		{
			return (entrada: null, salida: null, tolerancia: 0, laborable: false);
		}
		return (entrada: anon.HoraEntrada, salida: anon.HoraSalida, tolerancia: anon.Tol, laborable: true);
	}

	private string ObtenerNombreDia(DayOfWeek dia)
	{
		return dia switch
		{
			DayOfWeek.Monday => "Lunes", 
			DayOfWeek.Tuesday => "Martes", 
			DayOfWeek.Wednesday => "Miércoles", 
			DayOfWeek.Thursday => "Jueves", 
			DayOfWeek.Friday => "Viernes", 
			DayOfWeek.Saturday => "Sábado", 
			DayOfWeek.Sunday => "Domingo", 
			_ => "", 
		};
	}

	public async Task<ResumenCompletoDto> GetResumenCompletoMes(int usuarioId, int año, int mes)
	{
		TimeZoneInfo tz = GetBogotaTz();
		DateOnly primerDiaMesLocal = new DateOnly(año, mes, 1);
		DateOnly ultimoDiaMesLocal = primerDiaMesLocal.AddMonths(1).AddDays(-1);
		DateTime inicioMesUtc = TimeZoneInfo.ConvertTimeToUtc(primerDiaMesLocal.ToDateTime(TimeOnly.MinValue), tz);
		DateTime finMesUtc = TimeZoneInfo.ConvertTimeToUtc(primerDiaMesLocal.AddMonths(1).ToDateTime(TimeOnly.MinValue), tz);
		int totalAusencias = await EntityFrameworkQueryableExtensions.CountAsync<Ausencia>(EntityFrameworkQueryableExtensions.AsNoTracking<Ausencia>((IQueryable<Ausencia>)_context.Ausencias), (Expression<Func<Ausencia, bool>>)((Ausencia a) => a.IdUsuario == usuarioId && a.Estado == "aprobada" && a.Hasta >= primerDiaMesLocal && a.Desde <= ultimoDiaMesLocal), default(CancellationToken));
		List<Marcacion> marcacionesMes = await EntityFrameworkQueryableExtensions.ToListAsync<Marcacion>((IQueryable<Marcacion>)(from m in EntityFrameworkQueryableExtensions.AsNoTracking<Marcacion>((IQueryable<Marcacion>)_context.Marcaciones)
			where m.IdUsuario == usuarioId && m.FechaHora >= (DateTimeOffset)inicioMesUtc && m.FechaHora < (DateTimeOffset)finMesUtc
			orderby m.FechaHora
			select m), default(CancellationToken));
		List<TardanzaDetalleDto> listaTardanzasDto = new List<TardanzaDetalleDto>();
		int totalRetirosTempranos = 0;
		double totalSobretiempoMin = 0.0;
		DateOnly dia = primerDiaMesLocal;
		while (dia <= ultimoDiaMesLocal)
		{
			(TimeSpan?, TimeSpan?, int, bool) tuple = await ResolveHorarioDelDiaSimple(usuarioId, dia);
			var (timeSpan, timeSpan2, num, _) = tuple;
			if (tuple.Item4 && timeSpan.HasValue && timeSpan2.HasValue)
			{
				DateTime inicioDiaUtc = TimeZoneInfo.ConvertTimeToUtc(dia.ToDateTime(TimeOnly.MinValue), tz);
				DateTime finDiaUtc = inicioDiaUtc.AddDays(1.0);
				List<Marcacion> source = marcacionesMes.Where((Marcacion m) => m.FechaHora >= inicioDiaUtc && m.FechaHora < finDiaUtc).ToList();
				if (source.Any())
				{
					Marcacion marcacion = source.FirstOrDefault((Marcacion m) => m.Tipo == "entrada");
					Marcacion marcacion2 = source.LastOrDefault((Marcacion m) => m.Tipo == "salida");
					if (marcacion != null)
					{
						DateTimeOffset dateTimeOffset = TimeZoneInfo.ConvertTime(marcacion.FechaHora, tz);
						DateTime dateTime = dia.ToDateTime(TimeOnly.FromTimeSpan(timeSpan.Value)).AddMinutes(num);
						if (dateTimeOffset > dateTime)
						{
							DateTime dateTime2 = dia.ToDateTime(TimeOnly.FromTimeSpan(timeSpan.Value));
							TimeSpan timeSpan3 = dateTimeOffset - dateTime2;
							bool compensada = false;
							if (marcacion2 != null)
							{
								DateTimeOffset dateTimeOffset2 = TimeZoneInfo.ConvertTime(marcacion2.FechaHora, tz);
								double totalMinutes = (dateTimeOffset2 - dateTimeOffset).TotalMinutes;
								double totalMinutes2 = (dia.ToDateTime(TimeOnly.FromTimeSpan(timeSpan2.Value)) - dia.ToDateTime(TimeOnly.FromTimeSpan(timeSpan.Value))).TotalMinutes;
								if (totalMinutes >= totalMinutes2)
								{
									compensada = true;
								}
							}
							listaTardanzasDto.Add(new TardanzaDetalleDto
							{
								Fecha = dia.ToDateTime(TimeOnly.MinValue),
								DiaSemana = ObtenerNombreDia(dia.DayOfWeek),
								HoraEsperada = timeSpan.Value,
								HoraLlegada = dateTimeOffset.TimeOfDay,
								MinutosTarde = new TimeSpan(0, (int)timeSpan3.TotalMinutes, 0),
								Compensada = compensada
							});
						}
					}
					if (marcacion2 != null)
					{
						DateTimeOffset dateTimeOffset3 = TimeZoneInfo.ConvertTime(marcacion2.FechaHora, tz);
						DateTime dateTime3 = dia.ToDateTime(TimeOnly.FromTimeSpan(timeSpan2.Value));
						if (dateTimeOffset3 < dateTime3.AddMinutes(-num))
						{
							totalRetirosTempranos++;
						}
						if (dateTimeOffset3 > dateTime3)
						{
							totalSobretiempoMin += (dateTimeOffset3 - dateTime3).TotalMinutes;
						}
					}
				}
			}
			dia = dia.AddDays(1);
		}
		return new ResumenCompletoDto
		{
			Tardanzas = listaTardanzasDto,
			TotalAusencias = totalAusencias,
			TotalRetirosTempranos = totalRetirosTempranos,
			TotalSobretiempoMin = totalSobretiempoMin
		};
	}
}
