// src/routes/ttn.ts
import { Router } from "express";
import { prisma } from "../lib/db";

export const ttn = Router();

/**
 * Webhook endpoint para recibir lecturas de The Things Network
 * POST /api/ttn/uplink
 */
ttn.post("/uplink", async (req, res, next) => {
  try {
    const { dev_eui, timestamp, payload } = req.body;

    // Validación de campos requeridos
    if (!dev_eui || !timestamp || !payload) {
      return res.status(400).json({
        ok: false,
        error: "Faltan campos requeridos: dev_eui, timestamp, payload",
      });
    }

    // Validar que el payload tenga las variables esperadas
    const { temperature, humidity, rainfall, soil_moisture, luminosity } = payload;
    if (
      temperature === undefined ||
      humidity === undefined ||
      rainfall === undefined ||
      soil_moisture === undefined ||
      luminosity === undefined
    ) {
      return res.status(400).json({
        ok: false,
        error: "El payload debe contener: temperature, humidity, rainfall, soil_moisture, luminosity",
      });
    }

    // Buscar o crear dispositivo
    let dispositivo = await prisma.dispositivo.findUnique({
      where: { devEui: dev_eui },
      include: { estacion: true },
    });

    let estacion;
    if (!dispositivo) {
      // Crear nueva estación para este dispositivo
      estacion = await prisma.estacion.create({
        data: {
          nombre: `Estación ${dev_eui}`,
          codigo: dev_eui,
          activo: true,
          zonaHoraria: "UTC",
        },
      });

      // Crear el dispositivo asociado
      dispositivo = await prisma.dispositivo.create({
        data: {
          devEui: dev_eui,
          estacionId: estacion.id,
          descripcion: `Dispositivo TTN ${dev_eui}`,
          activo: true,
        },
        include: { estacion: true },
      });

      console.log(`✅ Nueva estación creada: ${estacion.nombre} (ID: ${estacion.id})`);
    } else {
      estacion = dispositivo.estacion;
    }

    // Buscar los tipos de medición
    const tipos = await prisma.tipoMedicion.findMany({
      where: {
        clave: {
          in: ["air_temp_c", "air_humidity_pct", "rainfall_mm", "soil_moisture_pct", "luminosity_lx"],
        },
      },
    });

    if (tipos.length !== 5) {
      return res.status(500).json({
        ok: false,
        error: "Error: No se encontraron todos los tipos de medición necesarios en la base de datos",
      });
    }

    // Mapear las claves a los tipos
    const tipoMap: Record<string, number> = {};
    tipos.forEach((t) => {
      tipoMap[t.clave] = t.id;
    });

    // Parsear el timestamp
    const instante = new Date(timestamp);
    if (isNaN(instante.getTime())) {
      return res.status(400).json({
        ok: false,
        error: "El campo timestamp no es una fecha válida",
      });
    }

    // Preparar las mediciones para insertar
    const mediciones = [
      {
        estacionId: estacion.id,
        tipoId: tipoMap["air_temp_c"],
        instante,
        valor: temperature,
        crudo: payload,
      },
      {
        estacionId: estacion.id,
        tipoId: tipoMap["air_humidity_pct"],
        instante,
        valor: humidity,
        crudo: payload,
      },
      {
        estacionId: estacion.id,
        tipoId: tipoMap["rainfall_mm"],
        instante,
        valor: rainfall,
        crudo: payload,
      },
      {
        estacionId: estacion.id,
        tipoId: tipoMap["soil_moisture_pct"],
        instante,
        valor: soil_moisture,
        crudo: payload,
      },
      {
        estacionId: estacion.id,
        tipoId: tipoMap["luminosity_lx"],
        instante,
        valor: luminosity,
        crudo: payload,
      },
    ];

    // Insertar todas las mediciones
    // Usando createMany con skipDuplicates para evitar errores si ya existe la medición
    const result = await prisma.medicion.createMany({
      data: mediciones,
      skipDuplicates: true,
    });

    console.log(
      `📊 ${result.count} lecturas guardadas de ${dev_eui} en ${instante.toISOString()}`
    );

    res.json({
      ok: true,
      message: "Lecturas guardadas",
      estacion: estacion.nombre,
      mediciones_insertadas: result.count,
      timestamp: instante.toISOString(),
    });
  } catch (error) {
    console.error("❌ Error en TTN uplink:", error);
    next(error);
  }
});
