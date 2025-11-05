import "dotenv/config";
import express from "express";
import cors from "cors";

import { health } from "./routes/health";
import { estaciones } from "./routes/estaciones";
import { series } from "./routes/series";
import { ttn } from "./routes/ttn";

import { auth } from "./routes/auth.routes";
import { users } from "./routes/users"; // ADMIN

import { requireAuth, requirePasswordChanged } from "./middlewares/auth";

const app = express();
app.disable("x-powered-by");

// CORS
const ALLOWED = (process.env.CORS_ORIGINS ??
  "http://localhost:5173,http://localhost:2002,http://127.0.0.1:5173")
  .split(",")
  .map((s) => s.trim());

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || ALLOWED.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  })
);

// Body parser
app.use(express.json({ limit: "1mb" }));

/* =========================
   Rutas de salud
   ========================= */
// Health interno para el healthcheck del contenedor (curl http://localhost:2002/health)
app.get("/health", (_req, res) => res.json({ ok: true, service: "OPWS API" }));

// Health detrás del proxy Nginx (frontend llama /api/health)
app.use("/api/health", health);

/* =========================
   Rutas públicas
   ========================= */
app.use("/api/auth", auth); // login, change-password, etc.
app.use("/api/ttn", ttn); // webhook de The Things Network

/* =========================
   Rutas protegidas
   ========================= */
app.use("/api/estaciones", requireAuth, requirePasswordChanged(), estaciones);
app.use("/api/users", requireAuth, requirePasswordChanged(), users);
app.use("/api", requireAuth, requirePasswordChanged(), series); // ej: /api/series/...

/* =========================
   Error handler
   ========================= */
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(500).json({ error: "Error interno" });
});

const PORT = Number(process.env.PORT || 2002);
app.listen(PORT, () => console.log(`OPWS API en http://localhost:${PORT}`));
