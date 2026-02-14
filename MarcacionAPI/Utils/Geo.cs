using System;

namespace MarcacionAPI.Utils;

public static class Geo
{
	private const double R = 6371000.0;

	private static double ToRad(double deg)
	{
		return Math.PI * deg / 180.0;
	}

	public static double DistanceMeters(double lat1, double lon1, double lat2, double lon2)
	{
		double num = ToRad(lat2 - lat1);
		double num2 = ToRad(lon2 - lon1);
		double num3 = Math.Sin(num / 2.0) * Math.Sin(num / 2.0) + Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2)) * Math.Sin(num2 / 2.0) * Math.Sin(num2 / 2.0);
		double num4 = 2.0 * Math.Atan2(Math.Sqrt(num3), Math.Sqrt(1.0 - num3));
		return 6371000.0 * num4;
	}
}
