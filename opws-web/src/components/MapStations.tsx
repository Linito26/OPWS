// opws-web/src/components/MapStations.tsx
import { useEffect, useMemo, useState } from "react";

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

type RLBundle = {
  MapContainer: any;
  TileLayer: any;
  Marker: any;
  Popup: any;
};

export default function MapStations({
  center,
  stations,
  height = 340,
  base = "satellite",
  showLayerToggle = true,
}: Props) {
  const [layer, setLayer] = useState<"satellite" | "streets">(base);
  const [rl, setRL] = useState<RLBundle | null>(null);

  // Carga dinámica sólo en cliente + fix de íconos
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [{ MapContainer, TileLayer, Marker, Popup }, L] = await Promise.all([
        import("react-leaflet"),
        import("leaflet"),
      ]);

      // Fix íconos por defecto en Vite
      const iconUrl = new URL("leaflet/dist/images/marker-icon.png", import.meta.url).toString();
      const iconRetinaUrl = new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).toString();
      const shadowUrl = new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).toString();
      (L as any).Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

      if (mounted) setRL({ MapContainer, TileLayer, Marker, Popup });
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const markers = useMemo(
    () => stations.filter((s) => isFiniteNumber(s.lat) && isFiniteNumber(s.lng)) as Required<MapStation>[],
    [stations]
  );

  const initialCenter = useMemo<[number, number]>(() => {
    if (center && isFiniteNumber(center.lat) && isFiniteNumber(center.lng)) {
      return [center.lat, center.lng];
    }
    if (markers.length) return [markers[0].lat!, markers[0].lng!];
    // Fallback Guatemala
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

  // Si aún no cargó react-leaflet
  if (!rl) {
    return (
      <div
        className="rounded-xl border border-neutral-200 bg-white/60 grid place-items-center text-sm text-neutral-500"
        style={{ height }}
      >
        Cargando mapa…
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup } = rl;

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
        scrollWheelZoom
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer url={tile.url} attribution={tile.attribution} />
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
