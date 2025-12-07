namespace MarcacionAPI.Utils;

public static class Geo
{
    // Radio medio de la Tierra en metros
    private const double R = 6371000;

    private static double ToRad(double deg) => Math.PI * deg / 180.0;

    /// <summary>
    /// Distancia en metros entre dos puntos (lat/lon en grados)
    /// </summary>
    public static double DistanceMeters(double lat1, double lon1, double lat2, double lon2)
    {
        var dLat = ToRad(lat2 - lat1);
        var dLon = ToRad(lon2 - lon1);

        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return R * c;
    }
}