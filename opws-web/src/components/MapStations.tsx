import { useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix iconos en Vite
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

export type MapStation = {
  id: number;
  nombre: string;
  lat?: number | null;
  lng?: number | null;
};

type Props = {
  center: { lat: number; lng: number } | null;
  stations: MapStation[];
  height?: number;
  /** "satellite" | "streets" (por defecto satellite para look estilo Google) */
  base?: "satellite" | "streets";
  /** Si true, muestra un pequeño toggle de capas */
  showLayerToggle?: boolean;
};

export default function MapStations({
  center,
  stations,
  height = 340,
  base = "satellite",
  showLayerToggle = true,
}: Props) {
  const [layer, setLayer] = useState<"satellite" | "streets">(base);

  const markers = stations.filter(
    (s) => isFiniteNumber(s.lat) && isFiniteNumber(s.lng)
  );

  const initialCenter: LatLngExpression = useMemo(() => {
    if (center && isFiniteNumber(center.lat) && isFiniteNumber(center.lng)) {
      return [center.lat, center.lng];
    }
    if (markers.length) return [Number(markers[0].lat), Number(markers[0].lng)];
    return [14.64, -90.51]; // fallback GUA
  }, [center, markers]);

  const tile = layer === "satellite"
    // Esri World Imagery (satélite)
    ? {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution: "&copy; Esri",
      }
    // OSM (callejero)
    : {
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution: "&copy; OpenStreetMap",
      };

  return (
    <div className="relative w-full overflow-hidden rounded-lg">
      {showLayerToggle && (
        <div className="absolute right-3 top-3 z-[500] flex rounded-full border bg-white/90 backdrop-blur shadow">
          <button
            onClick={() => setLayer("streets")}
            className={`px-3 py-1 text-xs rounded-l-full ${layer === "streets" ? "bg-neutral-900 text-white" : "text-neutral-700"}`}
            title="Callejero"
            type="button"
          >
            Mapa
          </button>
          <button
            onClick={() => setLayer("satellite")}
            className={`px-3 py-1 text-xs rounded-r-full ${layer === "satellite" ? "bg-neutral-900 text-white" : "text-neutral-700"}`}
            title="Satélite"
            type="button"
          >
            Satélite
          </button>
        </div>
      )}

      <MapContainer center={initialCenter} zoom={12} style={{ width: "100%", height }}>
        <TileLayer attribution={tile.attribution} url={tile.url} />
        {markers.map((s) => (
          <Marker key={s.id} position={[s.lat as number, s.lng as number]}>
            <Popup>{s.nombre}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

function isFiniteNumber(v: any): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
