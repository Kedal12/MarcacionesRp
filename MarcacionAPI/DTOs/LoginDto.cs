using System.ComponentModel.DataAnnotations;

namespace MarcacionAPI.DTOs;

public record LoginDto(
    [Required] string Email,
    [Required] string Password
);