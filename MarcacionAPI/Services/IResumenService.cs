using System.Threading.Tasks;

namespace MarcacionAPI.Services;

public interface IResumenService
{
	Task<ResumenCompletoDto> GetResumenCompletoMes(int usuarioId, int año, int mes);
}
