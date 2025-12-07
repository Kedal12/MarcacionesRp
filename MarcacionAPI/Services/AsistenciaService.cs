using MarcacionAPI.Data;
using MarcacionAPI.DTOs;
using System;
using Microsoft.EntityFrameworkCore; // Asegúrate de que este 'using' esté presente

namespace MarcacionAPI.Services;

public interface IAsistenciaService
{
    Task<AsistenciaConCompensacionDto> AnalizarAsistenciaDia(int usuarioId, DateTime fecha);
}

public class AsistenciaService : IAsistenciaService
{
    private readonly ApplicationDbContext _context;

    public AsistenciaService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<AsistenciaConCompensacionDto> AnalizarAsistenciaDia(int usuarioId, DateTime fecha)
    {
        // --- CORRECCIÓN DE LÓGICA DE FECHAS ---
        // Convertir la 'fecha' (DateTime) a 'DateOnly' para la consulta
        var fechaConsulta = DateOnly.FromDateTime(fecha);

        // Obtener usuario con horario
        var horarioAsignado = await _context.UsuarioHorarios
            // --- CORRECCIÓN DE CONSULTA (DateOnly y Nullable) ---
            .Where(uh => uh.IdUsuario == usuarioId &&
                         uh.Desde <= fechaConsulta &&
                         (uh.Hasta == null || uh.Hasta >= fechaConsulta)) // <-- 'Hasta' nulo significa indefinido
            .Include(uh => uh.Horario) // Carga el Horario relacionado
                .ThenInclude(h => h.Detalles) // Carga los Detalles de ESE Horario
            .Select(uh => uh.Horario) // Solo nos interesa el objeto Horario
            .FirstOrDefaultAsync();

        // El 'usuario.Horario' se reemplaza por 'horarioAsignado'
        if (horarioAsignado == null)
            throw new Exception("Usuario sin horario asignado para la fecha seleccionada");

        // Obtener configuración del día
        int diaSemana = (int)fecha.DayOfWeek;
        if (diaSemana == 0) diaSemana = 7; // Convertir Domingo (0) a 7

        var detalle = horarioAsignado.Detalles
            .FirstOrDefault(d => d.DiaSemana == diaSemana);

        if (detalle == null || !detalle.Laborable)
            throw new Exception("Día no laborable");

        // Obtener marcaciones del día
        var marcaciones = await _context.Marcaciones
            .Where(m => m.IdUsuario == usuarioId && m.FechaHora.Date == fecha.Date)
            .OrderBy(m => m.FechaHora)
            .ToListAsync();

        var entrada = marcaciones.FirstOrDefault(m => m.Tipo == "Entrada");
        var salida = marcaciones.FirstOrDefault(m => m.Tipo == "Salida");

        // Si no hay marcaciones completas, no se puede analizar
        if (entrada == null || salida == null)
        {
            return new AsistenciaConCompensacionDto
            {
                Fecha = fecha,
                DiaSemana = ObtenerNombreDia(fecha.DayOfWeek),
                Estado = "INCOMPLETO",
                Mensaje = "Faltan marcaciones de entrada o salida"
            };
        }

        // Calcular horas
        var horaEntradaEsperada = detalle.HoraEntrada ?? TimeSpan.Zero;
        var horaSalidaEsperada = detalle.HoraSalida ?? TimeSpan.Zero;
        var tolerancia = detalle.ToleranciaMin ?? 0;
        var horaLimiteEntrada = horaEntradaEsperada.Add(TimeSpan.FromMinutes(tolerancia));

        var horasTrabajadas = salida.FechaHora - entrada.FechaHora;
        var horasEsperadas = horaSalidaEsperada - horaEntradaEsperada;

        // Calcular tardanza bruta
        var minutosTarde = entrada.FechaHora.TimeOfDay > horaLimiteEntrada
            ? entrada.FechaHora.TimeOfDay - horaLimiteEntrada
            : TimeSpan.Zero;

        // Calcular tiempo extra bruto
        var minutosExtra = salida.FechaHora.TimeOfDay > horaSalidaEsperada
            ? salida.FechaHora.TimeOfDay - horaSalidaEsperada
            : TimeSpan.Zero;

        // LÓGICA DE COMPENSACIÓN
        bool permiteCompensacion = detalle.PermitirCompensacion
            ?? horarioAsignado.PermitirCompensacion;

        bool tardanzaCompensada = false;
        var tardanzaNeta = minutosTarde;
        var tiempoExtraNeto = minutosExtra;
        string estado = "PUNTUAL";
        string mensaje = "";

        if (permiteCompensacion && minutosTarde > TimeSpan.Zero)
        {
            // Si trabajó las horas completas o más, se compensa la tardanza
            if (horasTrabajadas >= horasEsperadas)
            {
                tardanzaCompensada = true;

                // Calcular compensación
                if (minutosExtra >= minutosTarde)
                {
                    // Tiene suficiente extra para compensar toda la tardanza
                    tiempoExtraNeto = minutosExtra - minutosTarde;
                    tardanzaNeta = TimeSpan.Zero;
                    estado = "COMPENSADO";
                    mensaje = $"Tardanza de {minutosTarde.TotalMinutes:F0} min compensada con tiempo extra";
                }
                else
                {
                    // Compensó parcialmente
                    tardanzaNeta = minutosTarde - minutosExtra;
                    tiempoExtraNeto = TimeSpan.Zero;
                    estado = "PARCIALMENTE_COMPENSADO";
                    mensaje = $"Tardanza parcialmente compensada. Quedan {tardanzaNeta.TotalMinutes:F0} min";
                }
            }
            else
            {
                // No trabajó las horas completas, no se compensa
                estado = "TARDE_SIN_COMPENSAR";
                mensaje = $"Tardanza de {minutosTarde.TotalMinutes:F0} min. No cumplió horario completo.";
            }
        }
        else if (minutosTarde > TimeSpan.Zero)
        {
            // No permite compensación o no hay tardanza
            estado = "TARDE";
            mensaje = $"Tardanza de {minutosTarde.TotalMinutes:F0} min (sin compensación)";
        }
        else
        {
            estado = "PUNTUAL";
            mensaje = "Asistencia puntual";
        }

        return new AsistenciaConCompensacionDto
        {
            Fecha = fecha,
            DiaSemana = ObtenerNombreDia(fecha.DayOfWeek),

            HoraEntradaEsperada = horaEntradaEsperada,
            HoraSalidaEsperada = horaSalidaEsperada,

            HoraEntradaReal = entrada.FechaHora.TimeOfDay,
            HoraSalidaReal = salida.FechaHora.TimeOfDay,

            MinutosTarde = minutosTarde,
            MinutosExtra = minutosExtra,
            HorasTrabajadas = horasTrabajadas,
            HorasEsperadas = horasEsperadas,
            DiferenciaHoras = horasTrabajadas - horasEsperadas,

            PermiteCompensacion = permiteCompensacion,
            TardanzaCompensada = tardanzaCompensada,
            TardanzaNeta = tardanzaNeta,
            TiempoExtraNeto = tiempoExtraNeto,

            Estado = estado,
            Mensaje = mensaje
        };
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
            _ => ""
        };
    }
}