//src/routes/healt.ts
import { Router } from "express";

export const health = Router();

// GET /api/health  (usada por el proxy Nginx)
health.get("/", (_req, res) => res.json({ ok: true, service: "OPWS API" }));
