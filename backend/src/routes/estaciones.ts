//src/routes/estaciones.ts
import { Router } from "express";
import { prisma } from "../lib/db";
import { requireRole } from "../middlewares/auth";

export const estaciones = Router();

// Listado (para selector)
estaciones.get("/", async (req, res, next) => {
  try {
    const q = (req.query.q as string)?.trim();
    const where = q ? { nombre: { contains: q, mode: "insensitive" as const } } : {};
    const data = await prisma.estacion.findMany({
      where, orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, codigo: true, latitud: true, longitud: true, activo: true }
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

// PUT /:id - Actualizar estación (requiere autenticación, aplicada en index.ts)
estaciones.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }

    // Verificar que la estación existe
    const existe = await prisma.estacion.findUnique({ where: { id } });
    if (!existe) {
      return res.status(404).json({ error: "Estación no encontrada" });
    }

    // Validar y preparar datos para actualización
    const { latitud, longitud, nombre, codigo, elevacion_m, notas, activo } = req.body;

    const dataToUpdate: any = {};

    if (latitud !== undefined) {
      const lat = Number(latitud);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        return res.status(400).json({ error: "Latitud inválida (debe estar entre -90 y 90)" });
      }
      dataToUpdate.latitud = lat;
    }

    if (longitud !== undefined) {
      const lng = Number(longitud);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        return res.status(400).json({ error: "Longitud inválida (debe estar entre -180 y 180)" });
      }
      dataToUpdate.longitud = lng;
    }

    if (nombre !== undefined) {
      const nombreTrim = String(nombre).trim();
      if (!nombreTrim) {
        return res.status(400).json({ error: "El nombre no puede estar vacío" });
      }
      dataToUpdate.nombre = nombreTrim;
    }

    if (codigo !== undefined) {
      dataToUpdate.codigo = String(codigo).trim() || null;
    }

    if (elevacion_m !== undefined) {
      const elev = Number(elevacion_m);
      if (!isNaN(elev)) {
        dataToUpdate.elevacion_m = elev;
      }
    }

    if (notas !== undefined) {
      dataToUpdate.notas = String(notas).trim() || null;
    }

    if (activo !== undefined && typeof activo === "boolean") {
      dataToUpdate.activo = activo;
    }

    // Actualizar timestamp
    dataToUpdate.actualizadoEn = new Date();

    // Actualizar en la base de datos
    const estacionActualizada = await prisma.estacion.update({
      where: { id },
      data: dataToUpdate,
    });

    res.json({
      success: true,
      estacion: estacionActualizada
    });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return res.status(409).json({ error: "El código de estación ya existe" });
    }
    next(e);
  }
});

// ===== RUTAS ADMIN (requieren rol ADMINISTRADOR) =====

export const estacionesAdmin = Router();

estacionesAdmin.put("/:id", requireRole(["ADMINISTRADOR", "ADMIN"]), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }

    // Verificar que la estación existe
    const existe = await prisma.estacion.findUnique({ where: { id } });
    if (!existe) {
      return res.status(404).json({ error: "Estación no encontrada" });
    }

    // Validar y preparar datos para actualización
    const { latitud, longitud, nombre, codigo, elevacion_m, notas, activo } = req.body;

    const dataToUpdate: any = {};

    if (latitud !== undefined) {
      const lat = Number(latitud);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        return res.status(400).json({ error: "Latitud inválida (debe estar entre -90 y 90)" });
      }
      dataToUpdate.latitud = lat;
    }

    if (longitud !== undefined) {
      const lng = Number(longitud);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        return res.status(400).json({ error: "Longitud inválida (debe estar entre -180 y 180)" });
      }
      dataToUpdate.longitud = lng;
    }

    if (nombre !== undefined) {
      const nombreTrim = String(nombre).trim();
      if (!nombreTrim) {
        return res.status(400).json({ error: "El nombre no puede estar vacío" });
      }
      dataToUpdate.nombre = nombreTrim;
    }

    if (codigo !== undefined) {
      dataToUpdate.codigo = String(codigo).trim() || null;
    }

    if (elevacion_m !== undefined) {
      const elev = Number(elevacion_m);
      if (!isNaN(elev)) {
        dataToUpdate.elevacion_m = elev;
      }
    }

    if (notas !== undefined) {
      dataToUpdate.notas = String(notas).trim() || null;
    }

    if (activo !== undefined && typeof activo === "boolean") {
      dataToUpdate.activo = activo;
    }

    // Actualizar timestamp
    dataToUpdate.actualizadoEn = new Date();

    // Actualizar en la base de datos
    const estacionActualizada = await prisma.estacion.update({
      where: { id },
      data: dataToUpdate,
    });

    res.json({
      success: true,
      estacion: estacionActualizada
    });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return res.status(409).json({ error: "El código de estación ya existe" });
    }
    next(e);
  }
});
