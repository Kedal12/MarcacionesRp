using System.ComponentModel.DataAnnotations;

namespace MarcacionAPI.DTOs;

public record LoginMobileDto(
    [Required] string NumeroDocumento,
    [Required] string Password
);