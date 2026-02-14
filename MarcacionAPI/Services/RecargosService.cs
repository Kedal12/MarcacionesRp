using MarcacionAPI.Data;
using Microsoft.EntityFrameworkCore;

namespace MarcacionAPI.Services;

public class RecargosService : IRecargosService
{
    private readonly ApplicationDbContext _context;

    // Ley 2466 de 2025 - Colombia
    private readonly TimeSpan InicioNocturno = new TimeSpan(19, 0, 0); // 7:00 PM

    private readonly TimeSpan FinNocturno = new TimeSpan(6, 0, 0);     // 6:00 AM

    public RecargosService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<RecargosCalculados> CalcularRecargosDia(int idUsuario, DateOnly fecha)
    {
        var resultado = new RecargosCalculados();

        try
        {
            // 1. Obtener horario programado para ese día
            var diaSemana = (int)fecha.DayOfWeek;

            var horarioDetalle = await _context.UsuarioHorarios
                .Where(uh => uh.IdUsuario == idUsuario
                          && uh.Desde <= fecha
                          && (uh.Hasta == null || uh.Hasta >= fecha))
                .Join(_context.HorarioDetalles,
                    uh => uh.IdHorario,
                    hd => hd.IdHorario,
                    (uh, hd) => hd)
                .Where(hd => hd.DiaSemana == diaSemana)
                .FirstOrDefaultAsync();

            if (horarioDetalle == null)
                return resultado; // Sin horario = sin recargos

            // 2. Obtener marcaciones del día (entrada y salida)
            var tz = GetBogotaTimeZone();
            var fechaInicio = fecha.ToDateTime(TimeOnly.MinValue);
            var fechaFin = fechaInicio.AddDays(1);

            var inicioUtc = new DateTimeOffset(fechaInicio, tz.GetUtcOffset(fechaInicio));
            var finUtc = new DateTimeOffset(fechaFin, tz.GetUtcOffset(fechaFin));

            var marcaciones = await _context.Marcaciones
                .Where(m => m.IdUsuario == idUsuario
                         && m.FechaHora >= inicioUtc.ToUniversalTime()
                         && m.FechaHora < finUtc.ToUniversalTime())
                .OrderBy(m => m.FechaHora)
                .ToListAsync();

            var entrada = marcaciones.FirstOrDefault(m => m.Tipo == "entrada");
            var salida = marcaciones.FirstOrDefault(m => m.Tipo == "salida");

            if (entrada == null || salida == null)
                return resultado; // No hay entrada/salida completa

            // 3. Convertir a hora local de Bogotá
            var entradaLocal = TimeZoneInfo.ConvertTime(entrada.FechaHora, tz).TimeOfDay;
            var salidaLocal = TimeZoneInfo.ConvertTime(salida.FechaHora, tz).TimeOfDay;

            // 4. Calcular recargos según horario programado
            resultado = CalcularRecargosPorHoras(
                entradaLocal,
                salidaLocal,
                horarioDetalle.HoraEntrada.Value,
                horarioDetalle.HoraSalida.Value
            );
        }
        catch (Exception)
        {
            // En caso de error, retornar ceros
            return new RecargosCalculados();
        }

        return resultado;
    }

    private RecargosCalculados CalcularRecargosPorHoras(
        TimeSpan entradaReal,
        TimeSpan salidaReal,
        TimeSpan inicioEsperado,
        TimeSpan finEsperado)
    {
        var resultado = new RecargosCalculados();

        // ============================================
        // CASO 1: Horas Extra (fuera del horario)
        // ============================================
        if (salidaReal > finEsperado)
        {
            var inicioExtra = finEsperado;
            var finExtra = salidaReal;

            // Fragmentar tiempo extra en diurno/nocturno
            resultado.HorasExtraDiurnas = CalcularHorasDiurnas(inicioExtra, finExtra);
            resultado.HorasExtraNocturnas = CalcularHorasNocturnas(inicioExtra, finExtra);
        }

        // ============================================
        // CASO 2: Recargo Nocturno Ordinario
        // (Dentro del horario pero después de 7 PM)
        // ============================================
        if (finEsperado > InicioNocturno)
        {
            var inicioRecargo = entradaReal > InicioNocturno ? entradaReal : InicioNocturno;
            var finRecargo = salidaReal < finEsperado ? salidaReal : finEsperado;

            if (finRecargo > inicioRecargo)
            {
                resultado.HorasRecargoNocturnoOrdinario = (finRecargo - inicioRecargo).TotalHours;
            }
        }

        return resultado;
    }

    private double CalcularHorasDiurnas(TimeSpan inicio, TimeSpan fin)
    {
        // Si todo el rango es antes de 7 PM
        if (fin <= InicioNocturno)
            return (fin - inicio).TotalHours;

        // Si cruza el límite de 7 PM, solo contar hasta las 7 PM
        if (inicio < InicioNocturno && fin > InicioNocturno)
            return (InicioNocturno - inicio).TotalHours;

        return 0;
    }

    private double CalcularHorasNocturnas(TimeSpan inicio, TimeSpan fin)
    {
        // Si todo el rango es después de 7 PM
        if (inicio >= InicioNocturno)
            return (fin - inicio).TotalHours;

        // Si cruza el límite, solo contar desde las 7 PM
        if (inicio < InicioNocturno && fin > InicioNocturno)
            return (fin - InicioNocturno).TotalHours;

        return 0;
    }

    private TimeZoneInfo GetBogotaTimeZone()
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
}