import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix de iconos (Vite no resuelve automáticamente los PNG por defecto)
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

function ClickHandler({ onChange }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onChange(Number(lat.toFixed(6)), Number(lng.toFixed(6)));
    },
  });
  return null;
}

export default function MapPicker({
  lat,
  lon,
  onChange,
  height = 320,
  zoom = 15,
}) {
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);
  // Punto por defecto (cámbialo por el de tu ciudad si quieres)
  const defaultCenter = [6.244203, -75.581211]; // Medellín aprox.
  const position = hasCoords ? [lat, lon] : defaultCenter;

  return (
    <MapContainer
      center={position}
      zoom={zoom}
      style={{ height, width: "100%", borderRadius: 8 }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      <Marker
        position={position}
        draggable
        eventHandlers={{
          dragend: (e) => {
            const p = e.target.getLatLng();
            onChange(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)));
          },
        }}
      />

      <ClickHandler onChange={onChange} />
    </MapContainer>
  );
}
