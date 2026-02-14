namespace MarcacionAPI.DTOs;

public class LoginBiometricoDto
{
    public string NumeroDocumento { get; set; } = string.Empty;
    public string HuellaCapturada { get; set; } = string.Empty; // Cambiar byte[] por string si es necesario
}