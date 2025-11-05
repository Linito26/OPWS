// src/pages/Sensores.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { http } from "../config/api";
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  Area,
  BarChart,
  Bar,
} from "recharts";

/* ===== catálogo de sensores ===== */
const SENSORS = [
  { key: "rainfall_mm",       label: "Precipitación",     unit: "mm",  color: "#06b6d4", decimals: 2, chart: "bar"  as const },
  { key: "air_temp_c",        label: "Temp. aire",        unit: "°C",  color: "#ef4444", decimals: 1, chart: "line" as const },
  { key: "air_humidity_pct",  label: "Humedad relativa",  unit: "%",   color: "#3b82f6", decimals: 0, chart: "line" as const },
  { key: "soil_moisture_pct", label: "Humedad del suelo", unit: "%",   color: "#84cc16", decimals: 0, chart: "line" as const },
  { key: "luminosity_lx",     label: "Luminosidad",       unit: "min", color: "#f59e0b", decimals: 0, chart: "bar"  as const },
] as const;

type SensorKey = typeof SENSORS[number]["key"];

type Estacion = { id: number; codigo: string | null; nombre: string };
type Point = { t: string; v: number };
type SeriesMap = Record<SensorKey, Point[]>;

type Preset = "1d" | "7d" | "14d" | "30d" | "custom" | "48h";
type Group = "raw" | "hour" | "day";

/* ===== parámetros de cálculo para luminosidad ===== */
const LUX_ON_THRESHOLD = 100; // umbral de "hay luz" (lx)

export default function Sensores() {
  const [estaciones, setEstaciones] = useState<Estacion[]>([]);
  const [estacionId, setEstacionId] = useState<number | null>(null);

  // Filtros de tiempo
  const [preset, setPreset] = useState<Preset>("48h");
  const [fromDate, setFromDate] = useState<string>(() => isoDateDaysAgo(2));
  const [toDate, setToDate] = useState<string>(() => isoDateDaysAgo(0));
  const [group, setGroup] = useState<Group>("hour");

  // selección de sensores (todos activos)
  const [active, setActive] = useState<Record<SensorKey, boolean>>(
    () => Object.fromEntries(SENSORS.map(s => [s.key, true])) as Record<SensorKey, boolean>
  );

  // datos
  const [series, setSeries] = useState<SeriesMap>({} as SeriesMap);
  const [lumRaw, setLumRaw] = useState<Point[]>([]); // luminosidad en bruto
  const [loading, setLoading] = useState(false);

  // cargar estaciones
  useEffect(() => {
    (async () => {
      try {
        const data = await http<Estacion[]>("/estaciones");
        setEstaciones(data);
        if (data.length && estacionId == null) setEstacionId(data[0].id);
      } catch {
        setEstaciones([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // rango calculado segun preset
  const { fromISO, toISO } = useMemo(() => {
    if (preset === "custom") {
      const f = new Date(`${fromDate}T00:00:00`);
      const t = new Date(`${toDate}T23:59:59`);
      return { fromISO: f.toISOString(), toISO: t.toISOString() };
    }
    const now = new Date();
    const t = new Date(now);
    const f = new Date(now);
    const days =
      preset === "1d" ? 1 :
      preset === "7d" ? 7 :
      preset === "14d" ? 14 :
      preset === "30d" ? 30 : 2; // "48h"
    f.setDate(now.getDate() - (days - 1));
    f.setHours(0, 0, 0, 0);
    t.setHours(23, 59, 59, 999);
    return { fromISO: f.toISOString(), toISO: t.toISOString() };
  }, [preset, fromDate, toDate]);

  // cargar series cuando cambian filtros/estacion
  useEffect(() => {
    if (!estacionId) return;
    (async () => {
      setLoading(true);
      try {
        // 1) todas las series según group elegido
        const qs = new URLSearchParams({
          estacionId: String(estacionId),
          keys: SENSORS.map(s => s.key).join(","),
          from: fromISO,
          to: toISO,
          group,
        });
        const data = await http<SeriesMap>(`/series?${qs.toString()}`);
        setSeries(fillMissingKeys(data));

        // 2) RAW para luminosidad->minutos
        if (group === "raw") {
          setLumRaw(data.luminosity_lx ?? []);
        } else {
          const qsRaw = new URLSearchParams({
            estacionId: String(estacionId),
            keys: "luminosity_lx",
            from: fromISO,
            to: toISO,
            group: "raw",
          });
          const lumOnly = await http<Pick<SeriesMap, "luminosity_lx">>(`/series?${qsRaw.toString()}`);
          setLumRaw(lumOnly.luminosity_lx ?? []);
        }
      } catch {
        // mock para ver el diseño
        const mock = mockRangeSeries(fromISO, toISO, group);
        setSeries(mock);
        setLumRaw(mock.luminosity_lx);
      } finally {
        setLoading(false);
      }
    })();
  }, [estacionId, fromISO, toISO, group]);

  /* datos transformados para gráfica (luminosidad => minutos) */
  const transformed = useMemo(() => {
    const out: Record<string, { data: { ts: number; value: number }[]; unit: string }> = {};
    for (const s of SENSORS) {
      if (s.key === "luminosity_lx") {
        const t = transformLuminosityToMinutes(lumRaw, group, LUX_ON_THRESHOLD);
        out[s.key] = { data: t, unit: "min" };
      } else if (s.key === "rainfall_mm") {
        const pts = (series[s.key] ?? []).map(p => ({ ts: +new Date(p.t), value: Math.max(0, p.v) }));
        out[s.key] = { data: pts, unit: "mm" };
      } else {
        out[s.key] = {
          data: (series[s.key] ?? []).map(p => ({ ts: +new Date(p.t), value: p.v })),
          unit: s.unit,
        };
      }
    }
    return out;
  }, [series, lumRaw, group]);

  /* ===== Exportar XLSX (todas las series activas) ===== */
  async function exportXLSX() {
    const dateLabel = `${fromISO.slice(0,10)}_a_${toISO.slice(0,10)}`;
    try {
      // carga dinámica para no inflar el bundle
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      for (const s of SENSORS) {
        if (!active[s.key]) continue;
        const pack = transformed[s.key];
        const rows = (pack?.data ?? []).map(r => ({
          FechaHoraISO: new Date(r.ts).toISOString(),
          Valor: r.value,
          Unidad: pack?.unit || s.unit,
        }));
        const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Nota: "Sin datos en el rango" }]);
        XLSX.utils.book_append_sheet(wb, ws, s.label.slice(0,31));
      }

      XLSX.writeFile(wb, `OPWS_series_${dateLabel}.xlsx`);
    } catch (e) {
      console.warn("xlsx no disponible, exportando CSV de respaldo.", e);
      // fallback: un CSV por sensor (combinado en uno con separador entre hojas)
      let csv = `OPWS Export ${dateLabel}\n`;
      for (const s of SENSORS) {
        if (!active[s.key]) continue;
        const pack = transformed[s.key];
        csv += `\n=== ${s.label} ===\nFechaHoraISO,Valor,Unidad\n`;
        const rows = (pack?.data ?? []).map(r =>
          `${new Date(r.ts).toISOString()},${r.value},${pack?.unit || s.unit}`
        );
        csv += rows.length ? rows.join("\n") : "Sin datos\n";
      }
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `OPWS_series_${dateLabel}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  }

  /* ===== Exportar XLSX (sensor individual) ===== */
  async function exportSingleSensor(sensorKey: SensorKey) {
    // Encontrar la configuración del sensor
    const sensorConfig = SENSORS.find(s => s.key === sensorKey);
    if (!sensorConfig) return;

    // Obtener los datos transformados del sensor
    const pack = transformed[sensorKey];
    if (!pack || !pack.data.length) {
      alert("No hay datos para exportar");
      return;
    }

    // Obtener el nombre de la estación
    const estacionNombre = estaciones.find(e => e.id === estacionId)?.nombre || "Sin estación";

    // Formato de fechas para el nombre del archivo
    const fromLabel = fromISO.slice(0, 10).replace(/-/g, "");
    const toLabel = toISO.slice(0, 10).replace(/-/g, "");

    try {
      // Carga dinámica para no inflar el bundle
      const XLSX = await import("xlsx");

      // Crear filas con la estructura: Fecha y Hora, Valor, Unidad, Estación
      const rows = pack.data.map(r => ({
        "Fecha y Hora": new Date(r.ts).toISOString(),
        "Valor": r.value,
        "Unidad": pack.unit,
        "Estación": estacionNombre,
      }));

      // Crear workbook y worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, sensorConfig.label.slice(0, 31));

      // Nombre del archivo: OPWS_[sensorLabel]_[fromDate]_[toDate].xlsx
      const fileName = `OPWS_${sensorConfig.label.replace(/\s+/g, "_")}_${fromLabel}_${toLabel}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (e) {
      console.error("Error al exportar:", e);
      alert("Error al exportar el archivo");
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)]">
      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-r from-emerald-600 via-emerald-500 to-emerald-600" />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(transparent 60%, #000 61%)" }} />
        <div className="relative px-5 sm:px-8 py-8 text-white">
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-white/20 grid place-items-center backdrop-blur">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M4 13c0-5 4-9 10-9h6v6c0 6-4 10-10 10S4 19 4 13Z" stroke="currentColor" strokeWidth="2" />
                <path d="M8 15c1.5-1.5 4-3 7-3" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold leading-tight">Sensores</h1>
              <p className="text-white/80 text-sm">Selecciona sensores, rango y agrupación. Cada sensor tiene su gráfica.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Contenido ===== */}
      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-6">
        {/* Tarjeta: filtros, chips y botón de exportación */}
        <div className="rounded-2xl border border-neutral-200/80 bg-white/85 backdrop-blur-sm shadow-sm">
          <div className="p-5 sm:p-6">
            <div className="grid gap-4 md:gap-3 md:grid-cols-12 md:items-center">
              {/* IZQUIERDA: título + chips */}
              <div className="md:col-span-7 lg:col-span-8 flex items-start md:items-center gap-3 flex-wrap">
                <h3 className="text-base sm:text-lg font-semibold text-neutral-900 shrink-0">
                  Todos los sensores
                </h3>
                <div className="hidden md:block text-neutral-300 select-none">|</div>

                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                  {SENSORS.map(s => {
                    const on = !!active[s.key];
                    return (
                      <button
                        key={s.key}
                        onClick={() => setActive(a => ({ ...a, [s.key]: !a[s.key] }))}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs sm:text-sm transition
                          ${on
                            ? "border-emerald-300 bg-emerald-50/70 text-emerald-800"
                            : "border-neutral-200 bg-neutral-50 text-neutral-500 opacity-60"
                          }`}
                        title={on ? "Ocultar" : "Mostrar"}
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* DERECHA: estación + rango + agrupación + XLSX */}
              <div className="md:col-span-5 lg:col-span-4 flex flex-wrap gap-2 sm:gap-3 items-center justify-start md:justify-end">
                <select
                  className="rounded-lg border border-neutral-300 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                  value={estacionId ?? ""}
                  onChange={(e) => setEstacionId(Number(e.target.value))}
                >
                  {estaciones.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre} {e.codigo ? `(${e.codigo})` : ""}
                    </option>
                  ))}
                </select>

                <RangePills preset={preset} setPreset={setPreset} />

                {preset === "custom" && (
                  <>
                    <input
                      type="date"
                      className="rounded-lg border border-neutral-300 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                    <span className="text-neutral-400 text-sm">→</span>
                    <input
                      type="date"
                      className="rounded-lg border border-neutral-300 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </>
                )}

                <select
                  className="rounded-lg border border-neutral-300 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                  value={group}
                  onChange={(e) => setGroup(e.target.value as Group)}
                >
                  <option value="raw">Bruto</option>
                  <option value="hour">Cada hora</option>
                  <option value="day">Diario</option>
                </select>

                <button
                  onClick={exportXLSX}
                  className="ml-1 px-3 py-2 text-sm rounded-md border bg-white hover:bg-neutral-50"
                  title="Exportar todas las series activas en XLSX"
                >
                  Exportar todos (XLSX)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Gráficas */}
        {loading ? (
          <div className="rounded-2xl border border-neutral-200/80 bg-white/80 backdrop-blur-sm shadow-sm p-6">
            <div className="h-[220px] rounded bg-neutral-200/60 animate-pulse" />
          </div>
        ) : (
          <div className="space-y-6">
            {SENSORS.map(s => {
              if (!active[s.key]) return null;
              const pack = transformed[s.key];
              const data = pack?.data ?? [];
              const finalUnit = pack?.unit ?? s.unit;

              return (
                <ChartCard
                key={s.key}
                title={`${s.label} (${finalUnit})`}
                unit={finalUnit}
                color={s.color}
                decimals={s.decimals}
                data={data}
                chart={s.chart}
                fileBase={`opws_${s.key}`}
                onExportSingle={() => exportSingleSensor(s.key)}
                estacionNombre={estaciones.find(e => e.id === estacionId)?.nombre || "OPWS"}
              />
              );
            })}
            {Object.values(active).every(v => !v) && (
              <div className="rounded-xl border border-neutral-200 bg-white/80 p-6 text-sm text-neutral-500">
                Activa al menos un sensor para ver sus gráficas.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/* ====== Subcomponentes ====== */

function RangePills({
  preset,
  setPreset,
}: {
  preset: Preset;
  setPreset: (p: Preset) => void;
}) {
  const base = "px-3 py-1.5 rounded-full text-xs sm:text-sm border transition";
  const active = "bg-neutral-900 text-white border-neutral-900";
  const idle = "border-neutral-300 hover:bg-neutral-100 text-neutral-700";
  return (
    <div className="flex items-center gap-1.5">
      {(["1d", "48h", "7d", "14d", "30d"] as Preset[]).map(p => (
        <button
          key={p}
          onClick={() => setPreset(p)}
          className={`${base} ${preset === p ? active : idle}`}
        >
          {p === "1d" ? "1 día" : p === "48h" ? "48 horas" : p === "7d" ? "7 días" : p === "14d" ? "14 días" : "30 días"}
        </button>
      ))}
      <button onClick={() => setPreset("custom")} className={`${base} ${preset === "custom" ? active : idle}`}>
        Personalizado
      </button>
    </div>
  );
}

// Tooltip personalizado más profesional
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  const date = new Date(label);
  const dateStr = date.toLocaleDateString("es-GT", { 
    day: "2-digit", 
    month: "short", 
    year: "numeric" 
  });
  const timeStr = date.toLocaleTimeString("es-GT", { 
    hour: "2-digit", 
    minute: "2-digit" 
  });

  return (
    <div className="bg-white/95 backdrop-blur-sm border border-neutral-200 rounded-lg shadow-lg px-4 py-3">
      <p className="text-xs font-medium text-neutral-500 mb-1">
        {dateStr} {timeStr}
      </p>
      <p className="text-sm font-semibold text-neutral-900">
        {payload[0].name}: {payload[0].value}
      </p>
    </div>
  );
}

function ChartCard({
  title,
  unit,
  color,
  decimals = 2,
  data,
  chart = "line",
  fileBase = "opws_chart",
  onExportSingle,
  estacionNombre = "OPWS",
}: {
  title: string;
  unit: string;
  color: string;
  decimals?: number;
  data: { ts: number; value: number }[];
  chart?: "line" | "bar";
  fileBase?: string;
  onExportSingle?: () => void;
  estacionNombre?: string;
}) {
  const id = useMemo(() => `g${Math.random().toString(36).slice(2)}`, []);
  const holderRef = useRef<HTMLDivElement>(null);

  const fmtTick = (ms: number) => {
    const d = new Date(ms);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm} ${hh}:${min}`;
  };

  const fmtVal = (n: number) => (decimals === 0 ? Math.round(n) : Number(n).toFixed(decimals));
  const barSize = Math.max(4, Math.min(20, Math.floor(800 / Math.max(1, data.length))));

  const downloadPNG = async () => {
    const svg = holderRef.current?.querySelector("svg");
    if (!svg) return;

    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const rect = svg.getBoundingClientRect();
      const scale = 3;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(rect.width * scale));
      canvas.height = Math.max(1, Math.round(rect.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${fileBase}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
        URL.revokeObjectURL(url);
      }, "image/png", 0.95);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  };

  // Calcular estadísticas
  const stats = useMemo(() => {
    if (!data.length) return null;
    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return { min, max, avg };
  }, [data]);

  return (
    <div className="rounded-2xl border border-neutral-200/60 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-linear-to-r from-neutral-50 to-white px-6 py-4 border-b border-neutral-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-1 h-8 rounded-full" 
              style={{ backgroundColor: color }}
            />
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                {estacionNombre} • {data.length} registros
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {stats && (
              <div className="hidden sm:flex items-center gap-4 mr-4 text-xs">
                <div className="text-center">
                  <p className="text-neutral-500">Mín</p>
                  <p className="font-semibold text-neutral-900">
                    {fmtVal(stats.min)} {unit}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-neutral-500">Prom</p>
                  <p className="font-semibold text-neutral-900">
                    {fmtVal(stats.avg)} {unit}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-neutral-500">Máx</p>
                  <p className="font-semibold text-neutral-900">
                    {fmtVal(stats.max)} {unit}
                  </p>
                </div>
              </div>
            )}
            
            {onExportSingle && data.length > 0 && (
              <button
                onClick={onExportSingle}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200"
                title="Exportar a Excel"
              >
                📊 Excel
              </button>
            )}
            <button
              onClick={downloadPNG}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-neutral-50 transition-colors border border-neutral-200"
              title="Descargar PNG"
            >
              📷 PNG
            </button>
          </div>
        </div>
      </div>

      {/* Gráfica */}
      <div ref={holderRef} className="p-6 relative">
        {/* Marca de agua */}
        <div className="absolute top-8 right-8 text-neutral-200 font-bold text-sm tracking-wider select-none pointer-events-none z-10">
          {estacionNombre.toUpperCase()}
        </div>

        {data.length === 0 ? (
          <div className="h-80 grid place-items-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-neutral-100 grid place-items-center">
                <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-sm text-neutral-500">Sin datos en el rango seleccionado</p>
            </div>
          </div>
        ) : (
          <div className="w-full h-96">
            <ResponsiveContainer width="100%" height="100%">
              {chart === "bar" ? (
                <BarChart 
                  data={data} 
                  margin={{ top: 20, right: 40, bottom: 20, left: 10 }}
                >
                  <defs>
                    <linearGradient id={`${id}-bar`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.85} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.3} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid 
                    stroke="#e5e7eb" 
                    strokeDasharray="3 3" 
                    vertical={false}
                    opacity={0.5}
                  />
                  <XAxis
                    dataKey="ts"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={fmtTick}
                    stroke="#9ca3af"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    tickLine={{ stroke: "#d1d5db" }}
                  />
                  <YAxis
                    dataKey="value"
                    width={60}
                    stroke="#9ca3af"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    tickLine={{ stroke: "#d1d5db" }}
                    tickFormatter={(v) => `${fmtVal(v)}`}
                    allowDecimals
                  />
                  <Tooltip 
                    content={<CustomTooltip />}
                    cursor={{ fill: "rgba(0,0,0,0.05)" }}
                  />
                  <Bar
                    dataKey="value"
                    fill={`url(#${id}-bar)`}
                    stroke={color}
                    strokeWidth={1.5}
                    radius={[6, 6, 0, 0]}
                    barSize={barSize}
                    isAnimationActive={false}
                    name={`${title}`}
                  />
                </BarChart>
              ) : (
                <LineChart 
                  data={data} 
                  margin={{ top: 20, right: 40, bottom: 20, left: 10 }}
                >
                  <defs>
                    <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.01} />
                    </linearGradient>
                    <filter id={`${id}-shadow`}>
                      <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.15" />
                    </filter>
                  </defs>

                  <CartesianGrid 
                    stroke="#e5e7eb" 
                    strokeDasharray="3 3" 
                    vertical={false}
                    opacity={0.5}
                  />
                  <XAxis
                    dataKey="ts"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={fmtTick}
                    stroke="#9ca3af"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    tickLine={{ stroke: "#d1d5db" }}
                  />
                  <YAxis
                    dataKey="value"
                    width={60}
                    stroke="#9ca3af"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    tickLine={{ stroke: "#d1d5db" }}
                    tickFormatter={(v) => `${fmtVal(v)}`}
                    allowDecimals
                  />
                  <Tooltip 
                    content={<CustomTooltip />}
                    cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: "5 5" }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    fill={`url(#${id}-area)`} 
                    stroke="none" 
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={color}
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ 
                      r: 5, 
                      fill: color,
                      stroke: "#fff",
                      strokeWidth: 2
                    }}
                    isAnimationActive={false}
                    name={`${title}`}
                    filter={`url(#${id}-shadow)`}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Footer con info adicional */}
      {data.length > 0 && (
        <div className="px-6 py-3 bg-neutral-50/50 border-t border-neutral-100">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <div>
              Periodo: {new Date(data[0].ts).toLocaleDateString("es-GT")} - {new Date(data[data.length - 1].ts).toLocaleDateString("es-GT")}
            </div>
            <div>
              Última actualización: {new Date(data[data.length - 1].ts).toLocaleString("es-GT")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
/* ====== utilidades ====== */

function isoDateDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function median(arr: number[]) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function estimateIntervalMinutes(points: Point[]) {
  if (points.length < 2) return 60;
  const diffs: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const d = (+new Date(points[i].t) - +new Date(points[i - 1].t)) / 60000;
    if (d > 0) diffs.push(d);
  }
  const m = median(diffs);
  return Math.max(1, Math.min(1440, Math.round(m || 60)));
}

function startOfHour(ts: number) {
  const d = new Date(ts);
  d.setMinutes(0, 0, 0);
  return +d;
}
function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return +d;
}

function fillMissingKeys(data: Partial<SeriesMap>): SeriesMap {
  const result = {} as SeriesMap;
  (SENSORS.map(s => s.key) as SensorKey[]).forEach(k => {
    result[k] = (data[k] ?? []) as Point[];
  });
  return result;
}

/** Calcula minutos de luz por periodo a partir de luminosidad RAW */
function transformLuminosityToMinutes(pts: Point[], group: Group, threshold: number) {
  if (!pts.length) return [];
  const intervalMin = estimateIntervalMinutes(pts);

  // asigna minutos "on" por muestra
  const samples = pts.map((p) => ({
    ts: +new Date(p.t),
    min: p.v >= threshold ? intervalMin : 0,
  }));

  if (group === "raw") {
    return samples.map(s => ({ ts: s.ts, value: s.min }));
  }

  // agrega por hora o por día
  const agg = new Map<number, number>();
  for (const s of samples) {
    const bucket = group === "hour" ? startOfHour(s.ts) : startOfDay(s.ts);
    agg.set(bucket, (agg.get(bucket) ?? 0) + s.min);
  }

  const cap = group === "hour" ? 60 : 1440;
  const out = Array.from(agg.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ts, minutes]) => ({ ts, value: Math.min(cap, Math.max(0, Math.round(minutes))) }));

  return out;
}

/* ====== mock de datos si aún no tienes endpoint ====== */

function mockRangeSeries(fromISO: string, toISO: string, group: Group): SeriesMap {
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  const span = Math.max(1, to - from);

  const N =
    group === "raw"  ? Math.min(800, Math.round(span / (1000 * 60 * 10))) : // cada 10 min máx
    group === "hour" ? Math.min(400, Math.round(span / (1000 * 60 * 60)))  :
                       Math.min(200, Math.round(span / (1000 * 60 * 60 * 24)));

  const times = Array.from({ length: Math.max(2, N) }, (_, i) =>
    new Date(from + (span * i) / (Math.max(1, N - 1))).toISOString()
  );
  const jitter = (c: number) => (Math.random() - 0.5) * c;

  const mk = (base: number, amp: number, noise: number, floor = -Infinity, ceil = Infinity) =>
    times.map((t, i) => {
      const s = Math.sin((i / Math.max(2, N - 1)) * Math.PI * 2);
      const v = Math.min(ceil, Math.max(floor, base + amp * s + jitter(noise)));
      return { t, v };
    });

  return {
    air_temp_c:        mk(27, 4.5, 0.8, 10, 45),
    air_humidity_pct:  mk(70, -12, 3, 30, 100),
    soil_moisture_pct: mk(55, 5, 2, 25, 95),
    luminosity_lx:     times.map((t) => {
                          const hour = new Date(t).getHours();
                          const daylight = Math.max(0, Math.sin((hour - 6) / 12 * Math.PI)); // pico medio día
                          const base = 20000 * daylight + jitter(800);
                          return { t, v: Math.max(0, Math.round(base)) };
                        }),
    rainfall_mm:       times.map((t) => ({ t, v: Math.random() < 0.12 ? Number((Math.random() * 3).toFixed(2)) : 0 })),
  } as SeriesMap;
}
