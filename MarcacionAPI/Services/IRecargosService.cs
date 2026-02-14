namespace MarcacionAPI.Services;

public interface IRecargosService
{
    Task<RecargosCalculados> CalcularRecargosDia(int idUsuario, DateOnly fecha);
}

public class RecargosCalculados
{
    public double HorasExtraDiurnas { get; set; }
    public double HorasExtraNocturnas { get; set; }
    public double HorasRecargoNocturnoOrdinario { get; set; }
}