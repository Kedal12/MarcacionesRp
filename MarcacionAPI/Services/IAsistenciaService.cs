using System;
using System.Threading.Tasks;
using MarcacionAPI.DTOs;

namespace MarcacionAPI.Services;

public interface IAsistenciaService
{
	Task<AsistenciaConCompensacionDto> AnalizarAsistenciaDia(int usuarioId, DateTime fecha);
}
