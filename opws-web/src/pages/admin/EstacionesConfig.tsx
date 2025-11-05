// src/pages/admin/EstacionesConfig.tsx
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { http } from "../../config/api";

// Fix para íconos de Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type Estacion = {
  id: number;
  codigo: string | null;
  nombre: string;
  latitud: any; // Puede venir como Decimal desde Prisma
  longitud: any; // Puede venir como Decimal desde Prisma
  activo: boolean;
};

// Helper para convertir Decimal/string a number de forma segura
function toNum(val: any): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

export default function EstacionesConfig() {
  const [estaciones, setEstaciones] = useState<Estacion[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Posición temporal para el mapa
  const [mapPosition, setMapPosition] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    loadEstaciones();
  }, []);

  async function loadEstaciones() {
    setLoading(true);
    setErr(null);
    try {
      const data = await http<Estacion[]>("/estaciones");
      setEstaciones(Array.isArray(data) ? data : []);
      if (data.length && !selectedId) {
        setSelectedId(data[0].id);
        const lat = toNum(data[0].latitud);
        const lng = toNum(data[0].longitud);
        if (lat !== null && lng !== null) {
          setMapPosition({ lat, lng });
        }
      }
    } catch (e: any) {
      setErr(e?.message || "No se pudieron cargar las estaciones.");
    } finally {
      setLoading(false);
    }
  }

  const selectedStation = estaciones.find((e) => e.id === selectedId);

  useEffect(() => {
    if (selectedStation) {
      const lat = toNum(selectedStation.latitud);
      const lng = toNum(selectedStation.longitud);
      if (lat !== null && lng !== null) {
        setMapPosition({ lat, lng });
      }
    }
  }, [selectedStation?.id]);

  async function handleSaveLocation() {
    if (!selectedId || !mapPosition) {
      setErr("Selecciona una estación y una ubicación en el mapa.");
      return;
    }

    setSaving(true);
    setErr(null);
    setSuccess(null);

    try {
      const body = { latitud: mapPosition.lat, longitud: mapPosition.lng };

      // Intentar actualizar via endpoint admin
      try {
        await http(`/admin/estaciones/${selectedId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } catch {
        // Fallback a endpoint público si admin no existe
        await http(`/estaciones/${selectedId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      }

      // Actualizar en memoria
      setEstaciones((prev) =>
        prev.map((e) =>
          e.id === selectedId ? { ...e, latitud: body.latitud, longitud: body.longitud } : e
        )
      );

      setSuccess(`Ubicación de "${selectedStation?.nombre}" actualizada correctamente.`);
    } catch (e: any) {
      setErr(e?.message || "No se pudo guardar la ubicación.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setErr("Tu navegador no soporta geolocalización.");
      return;
    }

    setErr(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMapPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setSuccess("Ubicación actual obtenida correctamente.");
      },
      (error) => {
        setErr(`Error al obtener ubicación: ${error.message}`);
      }
    );
  }

  return (
    <div className="space-y-6">
      {/* Selector de estación */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white/80 backdrop-blur-sm shadow-sm">
        <div className="p-5 sm:p-6 border-b">
          <h3 className="text-lg font-semibold text-neutral-900 mb-1">
            Configurar ubicación de estaciones
          </h3>
          <p className="text-sm text-neutral-500">
            Selecciona una estación y define su ubicación en el mapa.
          </p>
        </div>

        <div className="p-5 sm:p-6">
          {loading && <div className="text-sm text-neutral-500">Cargando estaciones…</div>}

          {err && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {err}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {success}
            </div>
          )}

          {!loading && (
            <>
              <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
                <label className="text-sm font-medium text-neutral-700">
                  Selecciona estación:
                </label>
                <select
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                  value={selectedId ?? ""}
                  onChange={(e) => setSelectedId(Number(e.target.value))}
                >
                  {estaciones.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre} {e.codigo ? `(${e.codigo})` : ""}
                    </option>
                  ))}
                </select>

                {selectedStation && (
                  <div className="text-sm text-neutral-600">
                    {(() => {
                      const lat = toNum(selectedStation.latitud);
                      const lng = toNum(selectedStation.longitud);
                      return lat !== null && lng !== null ? (
                        <span>
                          Ubicación actual: {lat.toFixed(6)}, {lng.toFixed(6)}
                        </span>
                      ) : (
                        <span className="text-orange-600">Sin ubicación definida</span>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={handleUseCurrentLocation}
                  className="px-4 py-2 text-sm rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                >
                  📍 Usar mi ubicación actual
                </button>
                <button
                  onClick={handleSaveLocation}
                  disabled={saving || !mapPosition}
                  className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Guardando..." : "💾 Guardar ubicación"}
                </button>
              </div>

              {mapPosition && (
                <div className="mb-3 text-xs text-neutral-600">
                  Ubicación seleccionada: {mapPosition.lat.toFixed(6)}, {mapPosition.lng.toFixed(6)}
                </div>
              )}

              {/* Mapa */}
              <div className="rounded-xl overflow-hidden border border-neutral-200">
                <MapWithClick
                  center={mapPosition ?? { lat: 15.726, lng: -88.599 }}
                  position={mapPosition}
                  onPositionChange={setMapPosition}
                  height={500}
                />
              </div>

              <div className="mt-3 text-xs text-neutral-500">
                💡 <strong>Instrucciones:</strong> Haz clic en el mapa para seleccionar la
                ubicación o arrastra el marcador. También puedes usar tu ubicación actual presionando
                el botón azul.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== Mapa con click y marcador ===== */
function MapWithClick({
  center,
  position,
  onPositionChange,
  height = 400,
}: {
  center: { lat: number; lng: number };
  position: { lat: number; lng: number } | null;
  onPositionChange: (pos: { lat: number; lng: number }) => void;
  height?: number;
}) {
  function ClickHandler() {
    useMapEvents({
      click(e) {
        onPositionChange({ lat: e.latlng.lat, lng: e.latlng.lng });
      },
    });
    return null;
  }

  return (
    <div style={{ height }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler />
        {position && (
          <Marker
            position={[position.lat, position.lng]}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const marker = e.target;
                const pos = marker.getLatLng();
                onPositionChange({ lat: pos.lat, lng: pos.lng });
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
