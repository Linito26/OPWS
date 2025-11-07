// src/pages/admin/EstacionesConfig.tsx
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
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
  elevacion_m?: any;
  notas?: string | null;
};

// Variables disponibles (tipos de medición)
const VARIABLES_DISPONIBLES = [
  { key: "rainfall_mm", label: "Precipitación (mm)" },
  { key: "air_temp_c", label: "Temperatura del aire (°C)" },
  { key: "air_humidity_pct", label: "Humedad relativa (%)" },
  { key: "soil_moisture_pct", label: "Humedad del suelo (%)" },
  { key: "luminosity_lx", label: "Luminosidad (lx)" },
];

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

  // Estado para modal de creación de estación
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEstacion, setNewEstacion] = useState({
    nombre: "",
    codigo: "",
    latitud: "",
    longitud: "",
    elevacion_m: "",
    notas: "",
    activo: true,
  });
  const [selectedVariables, setSelectedVariables] = useState<Record<string, boolean>>(
    Object.fromEntries(VARIABLES_DISPONIBLES.map(v => [v.key, true]))
  );

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

  async function handleCreateEstacion() {
    if (!newEstacion.nombre.trim()) {
      setErr("El nombre de la estación es obligatorio.");
      return;
    }

    setSaving(true);
    setErr(null);
    setSuccess(null);

    try {
      const body = {
        nombre: newEstacion.nombre.trim(),
        codigo: newEstacion.codigo.trim() || null,
        latitud: newEstacion.latitud ? Number(newEstacion.latitud) : null,
        longitud: newEstacion.longitud ? Number(newEstacion.longitud) : null,
        elevacion_m: newEstacion.elevacion_m ? Number(newEstacion.elevacion_m) : null,
        notas: newEstacion.notas.trim() || null,
        activo: newEstacion.activo,
      };

      const response = await http<{ success: boolean; estacion: Estacion }>("/admin/estaciones", {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (response?.success && response?.estacion) {
        // Agregar la nueva estación a la lista
        setEstaciones((prev) => [...prev, response.estacion]);

        // Seleccionar la nueva estación
        setSelectedId(response.estacion.id);

        // Resetear formulario
        setNewEstacion({
          nombre: "",
          codigo: "",
          latitud: "",
          longitud: "",
          elevacion_m: "",
          notas: "",
          activo: true,
        });

        // Resetear variables seleccionadas
        setSelectedVariables(
          Object.fromEntries(VARIABLES_DISPONIBLES.map(v => [v.key, true]))
        );

        setShowCreateModal(false);
        setSuccess(`Estación "${response.estacion.nombre}" creada correctamente.`);
      }
    } catch (e: any) {
      setErr(e?.message || "No se pudo crear la estación.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Selector de estación */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white/80 backdrop-blur-sm shadow-sm">
        <div className="p-5 sm:p-6 border-b">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-1">
                Configurar ubicación de estaciones
              </h3>
              <p className="text-sm text-neutral-500">
                Selecciona una estación y define su ubicación en el mapa.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors whitespace-nowrap"
            >
              ➕ Crear Nueva Estación
            </button>
          </div>
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

      {/* Modal de creación de estación */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 sm:p-6 border-b sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-neutral-900">
                Crear Nueva Estación
              </h3>
              <p className="text-sm text-neutral-500">
                Completa la información de la nueva estación meteorológica.
              </p>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Nombre de la estación <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newEstacion.nombre}
                  onChange={(e) => setNewEstacion({ ...newEstacion, nombre: e.target.value })}
                  placeholder="Ej: Estación Central"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              {/* Código */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Código (opcional)
                </label>
                <input
                  type="text"
                  value={newEstacion.codigo}
                  onChange={(e) => setNewEstacion({ ...newEstacion, codigo: e.target.value })}
                  placeholder="Ej: EST-01"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              {/* Coordenadas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Latitud
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={newEstacion.latitud}
                    onChange={(e) => setNewEstacion({ ...newEstacion, latitud: e.target.value })}
                    placeholder="Ej: 15.726"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Longitud
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={newEstacion.longitud}
                    onChange={(e) => setNewEstacion({ ...newEstacion, longitud: e.target.value })}
                    placeholder="Ej: -88.599"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>

              {/* Elevación */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Elevación (metros)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newEstacion.elevacion_m}
                  onChange={(e) => setNewEstacion({ ...newEstacion, elevacion_m: e.target.value })}
                  placeholder="Ej: 1500"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              {/* Variables disponibles */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Variables a medir
                </label>
                <div className="space-y-2">
                  {VARIABLES_DISPONIBLES.map((variable) => (
                    <label key={variable.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedVariables[variable.key]}
                        onChange={(e) =>
                          setSelectedVariables({
                            ...selectedVariables,
                            [variable.key]: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-2 focus:ring-emerald-500/30"
                      />
                      <span className="text-sm text-neutral-700">{variable.label}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                  Selecciona las variables que esta estación podrá medir
                </p>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Notas (opcional)
                </label>
                <textarea
                  value={newEstacion.notas}
                  onChange={(e) => setNewEstacion({ ...newEstacion, notas: e.target.value })}
                  placeholder="Información adicional sobre la estación..."
                  rows={3}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              {/* Activo */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newEstacion.activo}
                    onChange={(e) => setNewEstacion({ ...newEstacion, activo: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-2 focus:ring-emerald-500/30"
                  />
                  <span className="text-sm text-neutral-700">Estación activa</span>
                </label>
              </div>
            </div>

            <div className="p-5 sm:p-6 border-t flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setErr(null);
                }}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateEstacion}
                disabled={saving || !newEstacion.nombre.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Creando..." : "Crear Estación"}
              </button>
            </div>
          </div>
        </div>
      )}
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

  // Componente que actualiza el centro del mapa cuando cambia position
  function MapPositionUpdater({ position }: { position: { lat: number; lng: number } | null }) {
    const map = useMap();

    useEffect(() => {
      if (position) {
        // Usar flyTo para animación suave cuando cambia la posición
        map.flyTo([position.lat, position.lng], 13, {
          duration: 1.5, // 1.5 segundos de animación
        });
      }
    }, [position, map]);

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

        {/* Componente que actualiza el centro cuando cambia position */}
        <MapPositionUpdater position={position} />

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
