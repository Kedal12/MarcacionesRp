namespace MarcacionAPI.Utils;

public static class Paging
{
	public const int DefaultPage = 1;

	public const int DefaultPageSize = 20;

	public const int MaxPageSize = 100;

	public static (int page, int pageSize) Normalize(int page, int pageSize)
	{
		if (page < 1)
		{
			page = 1;
		}
		if (pageSize < 1)
		{
			pageSize = 20;
		}
		if (pageSize > 100)
		{
			pageSize = 100;
		}
		return (page: page, pageSize: pageSize);
	}
}
