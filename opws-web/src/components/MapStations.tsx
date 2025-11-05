import { useMemo, useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix de íconos
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import iconRetina from "leaflet/dist/images/marker-icon-2x.png";

const DefaultIcon = L.icon({
  iconUrl: icon,
  iconRetinaUrl: iconRetina,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

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
  base?: "satellite" | "streets";
  showLayerToggle?: boolean;
};

/**
 * Componente interno que actualiza el centro del mapa cuando cambia la prop center
 */
function MapUpdater({ center }: { center: { lat: number; lng: number } | null }) {
  const map = useMap();

  useEffect(() => {
    if (center && isFiniteNumber(center.lat) && isFiniteNumber(center.lng)) {
      // Usar flyTo para animación suave
      map.flyTo([center.lat, center.lng], 14, {
        duration: 1.5, // 1.5 segundos de animación
      });
    }
  }, [center, map]);

  return null;
}

export default function MapStations({
  center,
  stations,
  height = 340,
  base = "satellite",
  showLayerToggle = true,
}: Props) {
  const [layer, setLayer] = useState<"satellite" | "streets">(base);

  const markers = useMemo(
    () => stations.filter((s) => isFiniteNumber(s.lat) && isFiniteNumber(s.lng)) as Required<MapStation>[],
    [stations]
  );

  const initialCenter = useMemo<[number, number]>(() => {
    if (center && isFiniteNumber(center.lat) && isFiniteNumber(center.lng)) {
      return [center.lat, center.lng];
    }
    if (markers.length) return [markers[0].lat!, markers[0].lng!];
    return [14.64072, -90.51327];
  }, [center, markers]);

  const tile =
    layer === "satellite"
      ? {
          url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          attribution:
            "Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
        }
      : {
          url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          attribution: "© OpenStreetMap contributors",
        };

  return (
    <div className="relative w-full overflow-hidden rounded-lg" style={{ height }}>
      {showLayerToggle && (
        <div className="absolute right-3 top-3 z-50 flex rounded-full border bg-white/90 backdrop-blur shadow">
          <button
            onClick={() => setLayer("streets")}
            className={`px-3 py-1 text-xs rounded-l-full ${
              layer === "streets" ? "bg-neutral-900 text-white" : "text-neutral-700"
            }`}
            title="Callejero"
            type="button"
          >
            Mapa
          </button>
          <button
            onClick={() => setLayer("satellite")}
            className={`px-3 py-1 text-xs rounded-r-full ${
              layer === "satellite" ? "bg-neutral-900 text-white" : "text-neutral-700"
            }`}
            title="Satélite"
            type="button"
          >
            Satélite
          </button>
        </div>
      )}

      <MapContainer
        center={initialCenter}
        zoom={14}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer url={tile.url} attribution={tile.attribution} />

        {/* Componente que actualiza el centro reactivamente */}
        <MapUpdater center={center} />

        {markers.map((s) => (
          <Marker key={s.id} position={[s.lat!, s.lng!]}>
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{s.nombre}</div>
                <div className="text-neutral-600">
                  {s.lat!.toFixed(5)}, {s.lng!.toFixed(5)}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

function isFiniteNumber(v: any): v is number {
  return typeof v === "number" && Number.isFinite(v);
}