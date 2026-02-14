namespace MarcacionAPI.DTOs;

public class HabilitarBiometriaDto
{
    public string NumeroDocumento { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string DeviceId { get; set; } = string.Empty;
    public string DeviceModel { get; set; } = string.Empty;
}

public class MarcacionBiometricaDto
{
    public decimal Latitud { get; set; }
    public decimal Longitud { get; set; }
    public string Tipo { get; set; } = string.Empty;
    public bool BiometriaValidada { get; set; }
    public string DeviceId { get; set; } = string.Empty;
}

public class BiometriaStatusDto
{
    public bool Habilitada { get; set; }
    public DateTime? FechaRegistro { get; set; }
    public string? DispositivoRegistrado { get; set; }
}