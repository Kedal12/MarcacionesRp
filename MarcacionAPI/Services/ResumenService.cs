// ARCHIVO: MarcacionAPI/Services/ResumenService.cs

using MarcacionAPI.Data;
using MarcacionAPI.DTOs; // Asegúrate de que TardanzaDetalleDto esté aquí
using MarcacionAPI.Models;
using Microsoft.EntityFrameworkCore;

namespace MarcacionAPI.Services;

public interface IResumenService
{
    // Cambiado para que también devuelva los datos del resumen mensual
    Task<ResumenCompletoDto> GetResumenCompletoMes(int usuarioId, int año, int mes);
}

// DTO Auxiliar para devolver todo junto
public class ResumenCompletoDto
{
    public List<TardanzaDetalleDto> Tardanzas { get; set; } = new();
    public int TotalAusencias { get; set; } = 0;
    public int TotalRetirosTempranos { get; set; } = 0;
    public double TotalSobretiempoMin { get; set; } = 0;
}

// DTO que la App espera (basado en tardanzas.tsx)
// Si ya lo tienes definido en otro lugar, puedes borrar esta definición.
/*public class TardanzaDetalleDto
{
    public string Fecha { get; set; } = string.Empty;
    public string DiaSemana { get; set; } = string.Empty;
    public string HoraEsperada { get; set; } = string.Empty;
    public string HoraLlegada { get; set; } = string.Empty;
    public string MinutosTarde { get; set; } = string.Empty; // Formato HH:mm:ss para el front
    public bool Compensada { get; set; } = false;
}
*/

public class ResumenService : IResumenService
{
    private readonly ApplicationDbContext _context;

    public ResumenService(ApplicationDbContext context)
    {
        _context = context;
    }

    // 1. HELPER DE ZONA HORARIA (Movido desde el Controller)
    private static TimeZoneInfo GetBogotaTz()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("America/Bogota"); }
        catch { return TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time"); }
    }

    // 2. HELPER DE HORARIOS (Movido desde el Controller)
    private async Task<(TimeSpan? entrada, TimeSpan? salida, int tolerancia, bool laborable)>
        ResolveHorarioDelDiaSimple(int idUsuario, DateOnly dia)
    {
        var asig = await _context.UsuarioHorarios.AsNoTracking()
            .Where(uh => uh.IdUsuario == idUsuario && uh.Desde <= dia && (uh.Hasta == null || uh.Hasta >= dia))
            .Select(uh => new { uh.IdHorario })
            .FirstOrDefaultAsync();

        if (asig == null) return (null, null, 0, false);

        int dow = ((int)dia.DayOfWeek + 6) % 7 + 1;

        var det = await _context.HorarioDetalles.AsNoTracking()
            .Where(d => d.IdHorario == asig.IdHorario && d.DiaSemana == dow)
            .Select(d => new
            {
                d.Laborable,
                d.HoraEntrada,
                d.HoraSalida,
                Tol = d.ToleranciaMin ?? 0
            })
            .FirstOrDefaultAsync();

        if (det == null || !det.Laborable || det.HoraEntrada == null || det.HoraSalida == null)
            return (null, null, 0, false);

        return (det.HoraEntrada, det.HoraSalida, det.Tol, true);
    }

    private string ObtenerNombreDia(DayOfWeek dia) => dia switch
    {
        DayOfWeek.Monday => "Lunes",
        DayOfWeek.Tuesday => "Martes",
        DayOfWeek.Wednesday => "Miércoles",
        DayOfWeek.Thursday => "Jueves",
        DayOfWeek.Friday => "Viernes",
        DayOfWeek.Saturday => "Sábado",
        DayOfWeek.Sunday => "Domingo",
        _ => ""
    };

    // 3. LÓGICA DE CÁLCULO CENTRALIZADA
    public async Task<ResumenCompletoDto> GetResumenCompletoMes(int usuarioId, int año, int mes)
    {
        var tz = GetBogotaTz();
        var primerDiaMesLocal = new DateOnly(año, mes, 1);
        var ultimoDiaMesLocal = primerDiaMesLocal.AddMonths(1).AddDays(-1);

        var inicioMesUtc = TimeZoneInfo.ConvertTimeToUtc(primerDiaMesLocal.ToDateTime(TimeOnly.MinValue), tz);
        var finMesUtc = TimeZoneInfo.ConvertTimeToUtc(primerDiaMesLocal.AddMonths(1).ToDateTime(TimeOnly.MinValue), tz);

        // --- Ausencias (Cálculo rápido) ---
        int totalAusencias = await _context.Ausencias.AsNoTracking()
            .CountAsync(a => a.IdUsuario == usuarioId &&
                             a.Estado == EstadoAusencia.Aprobada &&
                             a.Hasta >= primerDiaMesLocal &&
                             a.Desde <= ultimoDiaMesLocal);

        // --- Marcaciones (Cálculo detallado) ---
        var marcacionesMes = await _context.Marcaciones.AsNoTracking()
            .Where(m => m.IdUsuario == usuarioId && m.FechaHora >= inicioMesUtc && m.FechaHora < finMesUtc)
            .OrderBy(m => m.FechaHora)
            .ToListAsync();

        var listaTardanzasDto = new List<TardanzaDetalleDto>();
        int totalRetirosTempranos = 0;
        double totalSobretiempoMin = 0;

        // Loop principal (lógica movida desde el controller)
        for (var dia = primerDiaMesLocal; dia <= ultimoDiaMesLocal; dia = dia.AddDays(1))
        {
            var (hEntrada, hSalida, tolerancia, laborable) = await ResolveHorarioDelDiaSimple(usuarioId, dia);
            if (!laborable || hEntrada == null || hSalida == null) continue;

            var inicioDiaUtc = TimeZoneInfo.ConvertTimeToUtc(dia.ToDateTime(TimeOnly.MinValue), tz);
            var finDiaUtc = inicioDiaUtc.AddDays(1);

            var marcDia = marcacionesMes.Where(m => m.FechaHora >= inicioDiaUtc && m.FechaHora < finDiaUtc).ToList();
            if (!marcDia.Any()) continue;

            var primeraEntrada = marcDia.FirstOrDefault(m => m.Tipo == "entrada");
            var ultimaSalida = marcDia.LastOrDefault(m => m.Tipo == "salida");

            // ---- Tardanza (con tolerancia) ----
            if (primeraEntrada != null)
            {
                var entLocal = TimeZoneInfo.ConvertTime(primeraEntrada.FechaHora, tz);
                var programadaConTol = dia.ToDateTime(TimeOnly.FromTimeSpan(hEntrada.Value)).AddMinutes(tolerancia);

                if (entLocal > programadaConTol)
                {
                    var programadaSinTol = dia.ToDateTime(TimeOnly.FromTimeSpan(hEntrada.Value));
                    // Corrección: Los minutos tarde se cuentan desde la hora de entrada, no desde la tolerancia
                    var minutosTardeSpan = (entLocal - programadaSinTol);

                    bool compensada = false;
                    if (ultimaSalida != null)
                    {
                        var salLocal = TimeZoneInfo.ConvertTime(ultimaSalida.FechaHora, tz);
                        var horasTrabajadas = (salLocal - entLocal).TotalMinutes;
                        var horasEsperadas = (dia.ToDateTime(TimeOnly.FromTimeSpan(hSalida.Value))
                                              - dia.ToDateTime(TimeOnly.FromTimeSpan(hEntrada.Value))).TotalMinutes;

                        if (horasTrabajadas >= horasEsperadas)
                            compensada = true;
                    }

                    // ✅ CÓDIGO CORREGIDO
                    listaTardanzasDto.Add(new TardanzaDetalleDto
                    {
                        // CS0029: Asigna DateTime (o DateOnly si tu DTO lo usa), no string
                        Fecha = dia.ToDateTime(TimeOnly.MinValue),

                        DiaSemana = ObtenerNombreDia(dia.DayOfWeek),

                        // CS0029: Asigna el TimeSpan directamente, no un string
                        HoraEsperada = hEntrada.Value,

                        // CS1503: Usa .DateTime para convertir DateTimeOffset a DateTime
                        // CS0029: Asigna el TimeSpan (TimeOfDay) directamente, no un string
                        HoraLlegada = entLocal.TimeOfDay,

                        // CS0029: Asigna el TimeSpan directamente, no un string
                        MinutosTarde = new TimeSpan(0, (int)minutosTardeSpan.TotalMinutes, 0),

                        Compensada = compensada
                    });
                }
            }

            // ---- Retiro temprano y sobretiempo ----
            if (ultimaSalida != null)
            {
                var salLocal = TimeZoneInfo.ConvertTime(ultimaSalida.FechaHora, tz);
                var salidaProg = dia.ToDateTime(TimeOnly.FromTimeSpan(hSalida.Value));

                if (salLocal < salidaProg.AddMinutes(-tolerancia))
                    totalRetirosTempranos++;

                if (salLocal > salidaProg)
                    totalSobretiempoMin += (salLocal - salidaProg).TotalMinutes;
            }
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