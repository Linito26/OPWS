// backend/src/routes/series.ts
import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
export const series = Router();

const UI2DB: Record<string, { key: string; agg: "AVG" | "SUM" }> = {
  rainfall_mm:       { key: "precipitacion_mm",     agg: "SUM" },
  air_temp_c:        { key: "temp_aire_c",          agg: "AVG" },
  air_humidity_pct:  { key: "humedad_relativa_pct", agg: "AVG" },
  soil_moisture_pct: { key: "humedad_suelo_pct",    agg: "AVG" },
  soil_temp_c:       { key: "temp_suelo_c",         agg: "AVG" },
  luminosity_lx:     { key: "luminosidad_lx",       agg: "AVG" },
};

type Group = "raw" | "hour" | "day" | "week" | "month";
const ALLOWED: Group[] = ["raw", "hour", "day", "week", "month"];
const toGroup = (v: unknown): Group => (ALLOWED.includes(String(v||"").toLowerCase() as Group) ? String(v).toLowerCase() as Group : "hour");
const parseISO = (v: unknown) => { const d = new Date(String(v??"")); if (isNaN(+d)) throw new Error("Fecha inválida"); return d; };

series.get("/series", async (req: Request, res: Response) => {
  try {
    const estacionId = Number(req.query.estacionId);
    if (!Number.isInteger(estacionId) || estacionId <= 0) return res.status(400).json({ error: "estacionId inválido" });
    const from = parseISO(req.query.from);
    const to   = parseISO(req.query.to);
    if (+from >= +to) return res.status(400).json({ error: "rango de fechas inválido" });

    const uiKeys = String(req.query.keys||"").split(",").map(s=>s.trim()).filter(Boolean);
    if (!uiKeys.length) return res.status(400).json({ error: "keys requerido" });
    const group: Group = toGroup(req.query.group);

    const dbKeys = new Set<string>();
    const uiByDB: Record<string,string> = {};
    const aggByDB: Record<string,"AVG"|"SUM"> = {};
    for (const ui of uiKeys) {
      const m = UI2DB[ui]; if (!m) continue;
      dbKeys.add(m.key); uiByDB[m.key]=ui; aggByDB[m.key]=m.agg;
    }
    if (!dbKeys.size) return res.status(400).json({ error: "ninguna key mapeada a DB" });

    if (group === "raw") {
      const rows = await prisma.$queryRaw<{ clave_tipo: string; ts: Date; valor: number }[]>`
        SELECT t.clave AS clave_tipo,
               m.instante AS ts,
               m.valor::double precision AS valor
        FROM opws.mediciones m
        JOIN opws.tipos_medicion t ON t.id = m.tipo_id
        WHERE m.estacion_id = ${estacionId}::int
          AND t.clave = ANY(${Array.from(dbKeys)}::text[])
          AND m.instante >= ${from}::timestamptz
          AND m.instante <  ${to}::timestamptz
        ORDER BY m.instante ASC
      `;
      const out: Record<string, {t:string; v:number}[]> = {};
      for (const db of dbKeys) out[uiByDB[db]] = [];
      for (const r of rows) {
        const ui = uiByDB[r.clave_tipo] || r.clave_tipo;
        out[ui].push({ t: r.ts.toISOString(), v: Number(r.valor) });
      }
      return res.json(out);
    }

    const bucket = group; // hour|day|week|month
    const sumKeys = Array.from(dbKeys).filter(k => aggByDB[k]==="SUM");

    const rows = await prisma.$queryRaw<{ clave_tipo: string; t: Date; v: number }[]>`
      WITH base AS (
        SELECT t.clave AS clave_tipo,
               date_trunc(${bucket}::text, m.instante) AS t_bucket,
               m.valor::double precision AS valor
        FROM opws.mediciones m
        JOIN opws.tipos_medicion t ON t.id = m.tipo_id
        WHERE m.estacion_id = ${estacionId}::int
          AND t.clave = ANY(${Array.from(dbKeys)}::text[])
          AND m.instante >= ${from}::timestamptz
          AND m.instante <  ${to}::timestamptz
      )
      SELECT clave_tipo,
             t_bucket AS t,
             CASE WHEN clave_tipo = ANY(${sumKeys}::text[]) THEN SUM(valor)
                  ELSE AVG(valor) END AS v
      FROM base
      GROUP BY clave_tipo, t_bucket
      ORDER BY t_bucket ASC
    `;
    const out: Record<string, {t:string; v:number}[]> = {};
    for (const db of dbKeys) out[uiByDB[db]] = [];
    for (const r of rows) {
      const ui = uiByDB[r.clave_tipo] || r.clave_tipo;
      out[ui].push({ t: r.t.toISOString(), v: Number(r.v) });
    }
    return res.json(out);
  } catch (e:any) {
    console.error("[/api/series] error:", e);
    return res.status(500).json({ error: "internal_error", detail: String(e?.message||e) });
  }
});

export default series;
