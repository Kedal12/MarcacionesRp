using System.ComponentModel.DataAnnotations;

namespace MarcacionAPI.DTOs;

public record ChangePasswordDto([Required] string CurrentPassword, [Required][MinLength(6)] string NewPassword);