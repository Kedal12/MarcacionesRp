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

public class AsistenciaService : IAsistenciaService
{
    private readonly ApplicationDbContext _context;

    public AsistenciaService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<AsistenciaConCompensacionDto> AnalizarAsistenciaDia(int usuarioId, DateTime fecha)
    {
        DateOnly fechaConsulta = DateOnly.FromDateTime(fecha);
        Horario horarioAsignado = await EntityFrameworkQueryableExtensions.FirstOrDefaultAsync<Horario>(((IQueryable<UsuarioHorario>)EntityFrameworkQueryableExtensions.ThenInclude<UsuarioHorario, Horario, ICollection<HorarioDetalle>>(EntityFrameworkQueryableExtensions.Include<UsuarioHorario, Horario>(((IQueryable<UsuarioHorario>)_context.UsuarioHorarios).Where((UsuarioHorario uh) => uh.IdUsuario == usuarioId && uh.Desde <= fechaConsulta && (uh.Hasta == null || uh.Hasta >= fechaConsulta)), (Expression<Func<UsuarioHorario, Horario>>)((UsuarioHorario uh) => uh.Horario)), (Expression<Func<Horario, ICollection<HorarioDetalle>>>)((Horario h) => h.Detalles))).Select((UsuarioHorario uh) => uh.Horario), default(CancellationToken));
        if (horarioAsignado == null)
        {
            throw new Exception("Usuario sin horario asignado para la fecha seleccionada");
        }
        int diaSemana = (int)fecha.DayOfWeek;
        if (diaSemana == 0)
        {
            diaSemana = 7;
        }
        HorarioDetalle detalle = horarioAsignado.Detalles.FirstOrDefault((HorarioDetalle d) => d.DiaSemana == diaSemana);
        if (detalle == null || !detalle.Laborable)
        {
            throw new Exception("Día no laborable");
        }
        List<Marcacion> source = await EntityFrameworkQueryableExtensions.ToListAsync<Marcacion>((IQueryable<Marcacion>)(from m in (IQueryable<Marcacion>)_context.Marcaciones
                                                                                                                         where m.IdUsuario == usuarioId && m.FechaHora.Date == ((DateTime)fecha).Date
                                                                                                                         orderby m.FechaHora
                                                                                                                         select m), default(CancellationToken));
        Marcacion marcacion = source.FirstOrDefault((Marcacion m) => m.Tipo == "Entrada");
        Marcacion marcacion2 = source.FirstOrDefault((Marcacion m) => m.Tipo == "Salida");
        if (marcacion == null || marcacion2 == null)
        {
            return new AsistenciaConCompensacionDto
            {
                Fecha = fecha,
                DiaSemana = ObtenerNombreDia(fecha.DayOfWeek),
                Estado = "INCOMPLETO",
                Mensaje = "Faltan marcaciones de entrada o salida"
            };
        }
        TimeSpan timeSpan = detalle.HoraEntrada ?? TimeSpan.Zero;
        TimeSpan timeSpan2 = detalle.HoraSalida ?? TimeSpan.Zero;
        int valueOrDefault = detalle.ToleranciaMin.GetValueOrDefault();
        TimeSpan timeSpan3 = timeSpan.Add(TimeSpan.FromMinutes(valueOrDefault));
        TimeSpan timeSpan4 = marcacion2.FechaHora - marcacion.FechaHora;
        TimeSpan timeSpan5 = timeSpan2 - timeSpan;
        TimeSpan timeSpan6 = ((marcacion.FechaHora.TimeOfDay > timeSpan3) ? (marcacion.FechaHora.TimeOfDay - timeSpan3) : TimeSpan.Zero);
        TimeSpan timeSpan7 = ((marcacion2.FechaHora.TimeOfDay > timeSpan2) ? (marcacion2.FechaHora.TimeOfDay - timeSpan2) : TimeSpan.Zero);
        bool flag = detalle.PermitirCompensacion ?? horarioAsignado.PermitirCompensacion;
        bool tardanzaCompensada = false;
        TimeSpan tardanzaNeta = timeSpan6;
        TimeSpan tiempoExtraNeto = timeSpan7;
        string estado;
        string mensaje;
        if (flag && timeSpan6 > TimeSpan.Zero)
        {
            if (timeSpan4 >= timeSpan5)
            {
                tardanzaCompensada = true;
                if (timeSpan7 >= timeSpan6)
                {
                    tiempoExtraNeto = timeSpan7 - timeSpan6;
                    tardanzaNeta = TimeSpan.Zero;
                    estado = "COMPENSADO";
                    mensaje = $"Tardanza de {timeSpan6.TotalMinutes:F0} min compensada con tiempo extra";
                }
                else
                {
                    tardanzaNeta = timeSpan6 - timeSpan7;
                    tiempoExtraNeto = TimeSpan.Zero;
                    estado = "PARCIALMENTE_COMPENSADO";
                    mensaje = $"Tardanza parcialmente compensada. Quedan {tardanzaNeta.TotalMinutes:F0} min";
                }
            }
            else
            {
                estado = "TARDE_SIN_COMPENSAR";
                mensaje = $"Tardanza de {timeSpan6.TotalMinutes:F0} min. No cumplió horario completo.";
            }
        }
        else if (timeSpan6 > TimeSpan.Zero)
        {
            estado = "TARDE";
            mensaje = $"Tardanza de {timeSpan6.TotalMinutes:F0} min (sin compensación)";
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
            HoraEntradaEsperada = timeSpan,
            HoraSalidaEsperada = timeSpan2,
            HoraEntradaReal = marcacion.FechaHora.TimeOfDay,
            HoraSalidaReal = marcacion2.FechaHora.TimeOfDay,
            MinutosTarde = timeSpan6,
            MinutosExtra = timeSpan7,
            HorasTrabajadas = timeSpan4,
            HorasEsperadas = timeSpan5,
            DiferenciaHoras = timeSpan4 - timeSpan5,
            PermiteCompensacion = flag,
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
            _ => "",
        };
    }

    // Dentro de AsistenciaService.cs
    public class RecargosResultado
    {
        public double HorasExtraDiurnas { get; set; }
        public double HorasExtraNocturnas { get; set; }
        public double RecargosNocturnosOrdinarios { get; set; }
    }

    private RecargosResultado CalcularRecargosColombianos(TimeSpan entrada, TimeSpan salida, TimeSpan finProgramado)
    {
        var resultado = new RecargosResultado();
        TimeSpan limiteNocturno = new TimeSpan(19, 0, 0); // 7:00 PM (Nueva Ley)

        // 1. Calcular Horas Extra Totales (Si salió después de lo programado)
        if (salida > finProgramado)
        {
            TimeSpan totalExtra = salida - finProgramado;

            // HED: Extra laborada antes de las 7 PM
            if (finProgramado < limiteNocturno)
            {
                TimeSpan finHED = salida > limiteNocturno ? limiteNocturno : salida;
                resultado.HorasExtraDiurnas = (finHED - finProgramado).TotalHours;
            }

            // HEN: Extra laborada después de las 7 PM
            if (salida > limiteNocturno)
            {
                TimeSpan inicioHEN = finProgramado > limiteNocturno ? finProgramado : limiteNocturno;
                resultado.HorasExtraNocturnas = (salida - inicioHEN).TotalHours;
            }
        }

        // 2. Recargos Nocturnos Ordinarios (Dentro del horario pero después de las 7 PM)
        if (finProgramado > limiteNocturno && entrada < finProgramado)
        {
            TimeSpan inicioRecargo = entrada > limiteNocturno ? entrada : limiteNocturno;
            resultado.RecargosNocturnosOrdinarios = (finProgramado - inicioRecargo).TotalHours;
        }

        return resultado;
    }
}