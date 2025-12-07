using MarcacionAPI.DTOs;
using MarcacionAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Security.Claims; // Necesario para 'ClaimTypes'
using System.Threading.Tasks;

namespace MarcacionAPI.Controllers; // Añadido el namespace

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

    /// <summary>
    /// Analiza la asistencia de un día con lógica de compensación
    /// </summary>
    [HttpGet("analizar-dia")]
    public async Task<ActionResult<AsistenciaConCompensacionDto>> AnalizarDia(
        [FromQuery] DateTime? fecha = null)
    {
        try
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userIdStr == null) return Unauthorized();

            var userId = int.Parse(userIdStr);
            var fechaConsulta = fecha ?? DateTime.Today;

            var analisis = await _asistenciaService.AnalizarAsistenciaDia(userId, fechaConsulta);
            return Ok(analisis);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Analiza la asistencia de un mes completo
    /// </summary>
    [HttpGet("analizar-mes")]
    public async Task<ActionResult<List<AsistenciaConCompensacionDto>>> AnalizarMes(
        [FromQuery] int? año = null,
        [FromQuery] int? mes = null)
    {
        try
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userIdStr == null) return Unauthorized();

            var userId = int.Parse(userIdStr);
            var añoConsulta = año ?? DateTime.Now.Year;
            var mesConsulta = mes ?? DateTime.Now.Month;

            var fechaInicio = new DateTime(añoConsulta, mesConsulta, 1);
            var fechaFin = fechaInicio.AddMonths(1).AddDays(-1);

            var analisis = new List<AsistenciaConCompensacionDto>();

            for (var fecha = fechaInicio; fecha <= fechaFin; fecha = fecha.AddDays(1))
            {
                try
                {
                    var dia = await _asistenciaService.AnalizarAsistenciaDia(userId, fecha);
                    analisis.Add(dia);
                }
                catch
                {
                    // Día no laborable, sin horario asignado o sin marcaciones.
                    // No es un error, simplemente no se añade al reporte.
                    continue;
                }
            }

            return Ok(analisis);
        }
        catch (Exception ex)
        {
            // Este es un error general del endpoint
            return BadRequest(new { error = ex.Message });
        }
    }
}