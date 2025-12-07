namespace MarcacionAPI.DTOs;

public record PagedResponse<T>(IEnumerable<T> Items, int Total, int Page, int PageSize);