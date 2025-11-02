//src/index.ts
import "dotenv/config";
import express from "express";
import cors from "cors";

import { health } from "./routes/health";
import { estaciones } from "./routes/estaciones";
import { series } from "./routes/series";

import { auth } from "./routes/auth.routes";
import { users } from "./routes/users"; // NUEVO: gestión de usuarios (ADMIN)

import { requireAuth, requirePasswordChanged } from "./middlewares/auth";

const app = express();
app.disable("x-powered-by");

// CORS: en Docker normalmente no hace falta porque /api va por el reverse proxy del web.
// Lo dejamos abierto a localhost para dev.
const ALLOWED = (process.env.CORS_ORIGINS ??
  "http://localhost:5173,http://localhost:2002")
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
   Rutas públicas
   ========================= */
app.use("/api/health", health);
app.use("/api/auth", auth); // login, change-password, etc.

/* =========================
   Rutas protegidas
   - Requieren JWT válido
   - Requieren NO tener pendiente cambio de contraseña temporal
   ========================= */
app.use("/api/estaciones", requireAuth, requirePasswordChanged(), estaciones);
app.use("/api/users", requireAuth, requirePasswordChanged(), users); // ADMIN crea/gestiona usuarios
app.use("/api", requireAuth, requirePasswordChanged(), series); // p.ej. /api/series/tabla

/* =========================
   Error handler
   ========================= */
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(500).json({ error: "Error interno" });
});

const PORT = Number(process.env.PORT || 2002);
app.listen(PORT, () => console.log(`OPWS API en http://localhost:${PORT}`));
