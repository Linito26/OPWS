import { useEffect, useMemo, useState } from "react";
import { http } from "../config/api";
import MapStations from "../components/MapStations";

/* =========================================
   Tipos
========================================= */
type Estacion = {
  id: number;
  codigo: string | null;
  nombre: string;
  latitud?: any;
  longitud?: any;
};
type Point = { t: string; v: number };
type SeriesMap = Record<string, Point[]>;

/* =========================================
   Constantes de series (leyenda)
========================================= */
const KEYS = [
  { key: "rainfall_mm", label: "Precipitación (mm)", color: "#059669" },
  { key: "air_temp_c", label: "Temp. aire (°C)", color: "#f43f5e" },
  { key: "air_humidity_pct", label: "Humedad relativa (%)", color: "#0ea5e9" },
  { key: "soil_moisture_pct", label: "Humedad del suelo (%)", color: "#65a30d" },
  { key: "luminosity_lx", label: "Luminosidad (lx)", color: "#f59e0b" },
] as const;

/* =========================================
   DEMO: configuración y utilidades
   - Toggle manual en UI
   - ?demo=1 en URL
   - Persistencia en localStorage
   - Estación Demo por si falla /estaciones
   - Mock determinístico por fecha + id estación
========================================= */
const DEMO_PARAM = "demo";
const DEMO_LS_KEY = "opws_demo";
const DEMO_STATION: Estacion = {
  id: -1,
  codigo: "DEMO",
  nombre: "Estación Demo",
  latitud: 15.726,  // coords cualquiera en Izabal
  longitud: -88.599,
};

function getInitialDemoFlag() {
  const url = new URL(window.location.href);
  if (url.searchParams.get(DEMO_PARAM) === "1") return true;
  const saved = localStorage.getItem(DEMO_LS_KEY);
  return saved ? saved === "1" : false;
}

function setDemoPersist(on: boolean) {
  localStorage.setItem(DEMO_LS_KEY, on ? "1" : "0");
}

/* PRNG determinístico (Mulberry32) para que el mismo día/estación
   siempre produzca la misma curva (evita “bailoteo” en cada render). */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Hash simple de string → number para seed */
function strHash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* =========================================
   Componente principal
========================================= */
export default function Panel() {
  const [estaciones, setEstaciones] = useState<Estacion[]>([]);
  const [estacionId, setEstacionId] = useState<number | null>(null);
  const [date, setDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );

  const [series, setSeries] = useState<SeriesMap>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // DEMO
  const [demoMode, setDemoMode] = useState<boolean>(getInitialDemoFlag());
  const [usingMock, setUsingMock] = useState(false);

  /* ================= Estaciones ================= */
  useEffect(() => {
    (async () => {
      try {
        const data = await http<Estacion[]>("/estaciones");
        const list = data?.length ? data : [DEMO_STATION];
        setEstaciones(list);
        if (estacionId == null) setEstacionId(list[0].id);
      } catch {
        // Si no hay API, garantizamos al menos la estación demo
        setEstaciones([DEMO_STATION]);
        setEstacionId(DEMO_STATION.id);
        setErr("No se pudieron cargar las estaciones (modo demo disponible).");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ================= Series ================= */
  useEffect(() => {
    if (!estacionId || !date) return;

    (async () => {
      setLoading(true);
      setErr(null);
      setUsingMock(false);

      const shouldMock = demoMode || estacionId === DEMO_STATION.id;

      try {
        if (shouldMock) {
          setSeries(mockDaySeries(date, estacionId));
          setUsingMock(true);
        } else {
          const from = new Date(date + "T00:00:00");
          const to = new Date(date + "T23:59:59.999");
          const qs = new URLSearchParams({
            estacionId: String(estacionId),
            from: from.toISOString(),
            to: to.toISOString(),
            keys: KEYS.map((k) => k.key).join(","),
            group: "hour",
          });
          const data = await http<SeriesMap>(`/series?${qs.toString()}`);
          const safe = data && Object.keys(data).length ? data : mockDaySeries(date, estacionId);
          setSeries(safe);
          setUsingMock(!data || !Object.values(data).some((v) => (v?.length ?? 0) > 0));
        }
      } catch (e: any) {
        // Si falla la API, llenamos con mock
        setErr(e?.message || "No se pudieron cargar las series.");
        setSeries(mockDaySeries(date, estacionId));
        setUsingMock(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [estacionId, date, demoMode]);

  /* ================= KPIs ================= */
  const summary = useMemo(() => {
    const get = (k: string) => (series[k] ?? []).map((p) => p.v);
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
    const avg = (a: number[]) => (a.length ? sum(a) / a.length : 0);
    return {
      rainfall_mm: Number(sum(get("rainfall_mm")).toFixed(1)),
      air_temp_c: Number(avg(get("air_temp_c")).toFixed(1)),
      air_humidity_pct: Number(avg(get("air_humidity_pct")).toFixed(0)),
      soil_moisture_pct: Number(avg(get("soil_moisture_pct")).toFixed(0)),
      luminosity_lx: Number(avg(get("luminosity_lx")).toFixed(0)),
    };
  }, [series]);

  /* ================= Mapa ================= */
  const selected = estaciones.find((e) => e.id === estacionId) || null;
  const center =
    selected && isNum(selected.latitud) && isNum(selected.longitud)
      ? { lat: Number(selected.latitud), lng: Number(selected.longitud) }
      : null;

  const mapMarkers = estaciones.map((e) => ({
    id: e.id,
    nombre: e.nombre + (e.codigo ? ` (${e.codigo})` : ""),
    lat: isNum(e.latitud) ? Number(e.latitud) : null,
    lng: isNum(e.longitud) ? Number(e.longitud) : null,
  }));

  /* ================= Render ================= */
  return (
    <div className="min-h-[calc(100vh-64px)]">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-r from-emerald-600 via-emerald-500 to-emerald-600" />
        <div
          className="absolute inset-0 opacity-20"
          style={{ backgroundImage: "radial-gradient(transparent 60%, #000 61%)" }}
        />
        <div className="relative px-5 sm:px-8 py-8 text-white">
          <div className="max-w-6xl mx-auto flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-white/20 grid place-items-center backdrop-blur">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M4 13c0-5 4-9 10-9h6v6c0 6-4 10-10 10S4 19 4 13Z" stroke="currentColor" strokeWidth="2" />
                <path d="M8 15c1.5-1.5 4-3 7-3" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold leading-tight">
                Panel {usingMock && <span className="text-xs align-middle ml-2 bg-black/20 rounded px-2 py-1">Demo</span>}
              </h1>
              <p className="text-white/80 text-sm">Resumen del día por estación y gráfico combinado.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Tarjeta */}
      <main className="max-w-6xl mx-auto px-5 sm:px-8 py-8">
        <div className="rounded-2xl border border-neutral-200/80 bg-white/80 backdrop-blur-sm shadow-sm">
          {/* Header */}
          <div className="p-5 sm:p-6 border-b">
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Resumen del día</h3>
                <p className="text-sm text-neutral-500">Precipitación, temperatura, humedades y luminosidad.</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Toggle DEMO */}
                <label className="flex items-center gap-2 text-sm text-neutral-700 mr-2">
                  <input
                    type="checkbox"
                    checked={demoMode}
                    onChange={(e) => {
                      setDemoMode(e.target.checked);
                      setDemoPersist(e.target.checked);
                    }}
                  />
                  Modo demo
                </label>

                <select
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                  value={estacionId ?? ""}
                  onChange={(e) => setEstacionId(Number(e.target.value))}
                >
                  {estaciones.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre} {e.codigo ? `(${e.codigo})` : ""}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Contenido */}
          <div className="p-5 sm:p-6">
            {loading && (
              <div className="mb-4 rounded-xl border border-neutral-200 bg-white/70 p-3 text-sm text-neutral-500">
                Cargando datos…
              </div>
            )}

            {err && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {err} {usingMock ? "(mostrando demo)" : ""}
              </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <Kpi title="Precipitación" value={`${fmt(summary.rainfall_mm)} mm`} color="#059669" />
              <Kpi title="Temp. aire" value={`${fmt(summary.air_temp_c)} °C`} color="#f43f5e" />
              <Kpi title="Humedad relativa" value={`${fmt(summary.air_humidity_pct)} %`} color="#0ea5e9" />
              <Kpi title="Humedad del suelo" value={`${fmt(summary.soil_moisture_pct)} %`} color="#65a30d" />
              <Kpi title="Luminosidad" value={`${fmt(summary.luminosity_lx)} lx`} color="#f59e0b" />
            </div>

            {/* Gráfica + Mapa */}
            <div className="rounded-xl border border-neutral-200 bg-white/70 p-3 sm:p-4">
              <ChartMulti series={series} height={280} />
              <div className="mt-3 mb-4 flex flex-wrap gap-3 text-xs">
                {KEYS.map(({ key, label, color }) => (
                  <span key={key} className="inline-flex items-center gap-2 text-neutral-700">
                    <span className="w-3 h-3 rounded-full" style={{ background: color }} />
                    {label}
                  </span>
                ))}
              </div>

              <div className="h-px w-full bg-neutral-200 my-2" />

              <div className="mt-3">
                <MapStations
                  center={center}
                  stations={mapMarkers}
                  height={360}
                  base="satellite"
                  showLayerToggle
                />
                {!center && (
                  <div className="mt-2 text-xs text-neutral-500">
                    La estación seleccionada no tiene coordenadas cargadas.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* =========================================
   Helpers & componentes
========================================= */
function Kpi({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-neutral-200/70 bg-white/80 backdrop-blur-sm shadow-sm p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-neutral-500">{title}</div>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      </div>
      <div className="mt-2 text-2xl font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

function fmt(n: number) {
  if (Math.abs(n) >= 1000) return new Intl.NumberFormat().format(Math.round(n));
  return String(n);
}

function ChartMulti({ series, height = 220 }: { series: SeriesMap; height?: number }) {
  const allPoints = Object.values(series).flat();
  if (allPoints.length === 0) {
    return <div className="h-[220px] grid place-items-center text-neutral-400 text-sm">Sin datos</div>;
  }
  const minT = Math.min(...allPoints.map((p) => +new Date(p.t)));
  const maxT = Math.max(...allPoints.map((p) => +new Date(p.t)));
  const minV = Math.min(...allPoints.map((p) => p.v));
  const maxV = Math.max(...allPoints.map((p) => p.v));
  const pad = 24;
  const width = 960;
  const tRange = Math.max(1, maxT - minT);
  const vRange = Math.max(1e-6, maxV - minV);
  const x = (t: string) => pad + ((+new Date(t) - minT) / tRange) * (width - pad * 2);
  const y = (v: number) => height - pad - ((v - minV) / vRange) * (height - pad * 2);
  const pathFor = (pts: Point[]) =>
    pts
      .slice()
      .sort((a, b) => +new Date(a.t) - +new Date(b.t))
      .map((p, i) => `${i ? "L" : "M"} ${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`)
      .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[280px]">
      <g stroke="#e5e7eb" strokeWidth="1">
        {[0.25, 0.5, 0.75].map((r) => (
          <line key={r} x1={pad} x2={width - pad} y1={pad + (height - pad * 2) * r} y2={pad + (height - pad * 2) * r} />
        ))}
      </g>
      {KEYS.map(({ key, color }) =>
        (series[key] ?? []).length ? (
          <path
            key={key}
            d={pathFor(series[key] as any)}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null
      )}
    </svg>
  );
}

/* =========================================
   MOCK: día determinístico y realista para palma africana
   - Temp aire: 22–34 °C con ciclo diario
   - HR: 65–95 %
   - Humedad suelo: 35–80 %
   - Luminosidad: 0 lx noche, pico ~60,000 lx mediodía (suave)
   - Lluvia: eventos esporádicos (0–6 mm/h evento)
========================================= */
function mockDaySeries(yyyy_mm_dd: string, estacionId: number | null): SeriesMap {
  // 48 puntos ~ cada 30 minutos
  const base = new Date(yyyy_mm_dd + "T00:00:00Z");
  const times = Array.from({ length: 48 }, (_, i) => new Date(+base + (i * 24 * 60 * 60 * 1000) / 47));

  // Seed = fecha + estación para que cambie por día y por estación
  const seed = strHash(`${yyyy_mm_dd}#${estacionId ?? "x"}`);
  const rnd = mulberry32(seed);
  const rand = () => rnd();

  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const sin = (i: number, period: number, phase = 0) => Math.sin((2 * Math.PI * (i + phase)) / period);

  // Curvas base
  const air = times.map((t, i) => {
    // Temperatura: base 26, amplitud 6–8, pico a las 14:00
    const amp = 6 + rand() * 2;
    const v = 26 + amp * Math.sin(((i - 14) / 48) * 2 * Math.PI);
    // Ruido suave
    return { t: t.toISOString(), v: +(v + (rand() - 0.5) * 0.8).toFixed(1) };
  });

  const hr = times.map((t, i) => {
    // HR inversa a temp + ruido
    const baseHr = 80 - 10 * Math.sin(((i - 14) / 48) * 2 * Math.PI);
    const v = clamp(baseHr + (rand() - 0.5) * 6, 65, 95);
    return { t: t.toISOString(), v: Math.round(v) };
  });

  const soil = times.map((t, i) => {
    // Humedad de suelo lenta, con pequeñas ondulaciones
    const baseSoil = 55 + 8 * sin(i, 48, 6) + 3 * sin(i, 12);
    const v = clamp(baseSoil + (rand() - 0.5) * 2, 35, 80);
    return { t: t.toISOString(), v: Math.round(v) };
  });

  const lux = times.map((t, i) => {
    // Día: campana entre ~6:00–18:00, pico ~60k
    const hour = (i / 48) * 24;
    const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    const v = Math.round(60000 * daylight + (rand() - 0.5) * 1500);
    return { t: t.toISOString(), v: Math.max(0, v) };
  });

  const rain = times.map((t) => {
    // 20% del día con chubascos; cada evento 0–3.5 mm/intervalo
    const event = rand() < 0.2 && rand() < 0.25; // más raro
    const v = event ? +(rand() * 3.5).toFixed(2) : 0;
    return { t: t.toISOString(), v };
  });

  // Si llovió, sube humedad de suelo un poco a partir de ese punto
  let acc = 0;
  for (let i = 0; i < rain.length; i++) {
    acc = Math.max(0, acc * 0.9) + rain[i].v * 0.6;
    soil[i].v = clamp(soil[i].v + acc, 35, 85);
  }

  return {
    air_temp_c: air,
    air_humidity_pct: hr,
    soil_moisture_pct: soil,
    luminosity_lx: lux,
    rainfall_mm: rain,
  };
}

function isNum(x: any): x is number {
  return typeof x === "number" && Number.isFinite(x);
}
