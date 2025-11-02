//src/rooutes/estaciones.ts
import { Router } from "express";
import { prisma } from "../lib/db";

export const estaciones = Router();

// Listado (para selector)
estaciones.get("/", async (req, res, next) => {
  try {
    const q = (req.query.q as string)?.trim();
    const where = q ? { nombre: { contains: q, mode: "insensitive" as const } } : {};
    const data = await prisma.estacion.findMany({
      where, orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, latitud: true, longitud: true, activo: true }
    });
    res.json(data);
  } catch (e) { next(e); }
});

// Detalle
estaciones.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const est = await prisma.estacion.findUnique({ where: { id } });
    if (!est) return res.status(404).json({ error: "No existe la estación" });
    res.json(est);
  } catch (e) { next(e); }
});
