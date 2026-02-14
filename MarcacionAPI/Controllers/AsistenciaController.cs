using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using MarcacionAPI.DTOs;
using MarcacionAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MarcacionAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AsistenciaController : ControllerBase
{
	private readonly IAsistenciaService _asistenciaService;

	public AsistenciaController(IAsistenciaService asistenciaService)
	{
		_asistenciaService = asistenciaService;
	}

	[HttpGet("analizar-dia")]
	public async Task<ActionResult<AsistenciaConCompensacionDto>> AnalizarDia([FromQuery] DateTime? fecha = null)
	{
		try
		{
			string text = base.User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
			if (text == null)
			{
				return Unauthorized();
			}
			int usuarioId = int.Parse(text);
			DateTime fecha2 = fecha ?? DateTime.Today;
			return Ok(await _asistenciaService.AnalizarAsistenciaDia(usuarioId, fecha2));
		}
		catch (Exception ex)
		{
			return BadRequest(new
			{
				error = ex.Message
			});
		}
	}

	[HttpGet("analizar-mes")]
	public async Task<ActionResult<List<AsistenciaConCompensacionDto>>> AnalizarMes([FromQuery] int? año = null, [FromQuery] int? mes = null)
	{
		try
		{
			string text = base.User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
			if (text == null)
			{
				return Unauthorized();
			}
			int userId = int.Parse(text);
			int year = año ?? DateTime.Now.Year;
			int month = mes ?? DateTime.Now.Month;
			DateTime dateTime = new DateTime(year, month, 1);
			DateTime fechaFin = dateTime.AddMonths(1).AddDays(-1.0);
			List<AsistenciaConCompensacionDto> analisis = new List<AsistenciaConCompensacionDto>();
			DateTime fecha = dateTime;
			while (fecha <= fechaFin)
			{
				try
				{
					analisis.Add(await _asistenciaService.AnalizarAsistenciaDia(userId, fecha));
				}
				catch
				{
				}
				fecha = fecha.AddDays(1.0);
			}
			return Ok(analisis);
		}
		catch (Exception ex)
		{
			return BadRequest(new
			{
				error = ex.Message
			});
		}
	}
}
