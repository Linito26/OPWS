#!/usr/bin/env tsx
/**
 * Script para generar datos de prueba realistas para sensores
 * Simula lecturas de sensores en clima tropical (Guatemala)
 *
 * Uso:
 *   pnpm seed:sensors --days=30 --station=1 --clean
 *   pnpm seed:sensors --days=7 --all-stations --clean
 *   pnpm seed:sensors --help
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================================
// CONFIGURACIÓN Y TIPOS
// ============================================================================

interface RainEvent {
  start: Date;
  durationMinutes: number;
  intensityMmPerHour: number;
}

interface SensorReading {
  estacionId: number;
  tipoId: number;
  instante: Date;
  valor: number;
}

interface Config {
  days: number;
  stationId: number | null;  // ✨ Ahora puede ser null
  allStations: boolean;       // ✨ NUEVO
  clean: boolean;
  intervalMinutes: number;
}

// ============================================================================
// GENERADORES DE DATOS REALISTAS
// ============================================================================

/**
 * Genera eventos de lluvia aleatorios realistas para Guatemala
 * - 15-20% de días con lluvia
 * - Eventos típicamente entre 14:00-18:00 (tardes)
 * - Duración: 30-120 minutos
 * - Intensidad: 0.5-15 mm/hora
 */
function generateRainEvents(startDate: Date, days: number): RainEvent[] {
  const events: RainEvent[] = [];

  for (let day = 0; day < days; day++) {
    // 18% de probabilidad de lluvia por día
    if (Math.random() < 0.18) {
      const baseDate = new Date(startDate);
      baseDate.setDate(baseDate.getDate() + day);

      // Hora de inicio: típicamente entre 14:00 y 18:00
      const startHour = 14 + Math.random() * 4;
      const startMinute = Math.floor(Math.random() * 60);
      baseDate.setHours(Math.floor(startHour), startMinute, 0, 0);

      events.push({
        start: baseDate,
        durationMinutes: 30 + Math.random() * 90, // 30-120 minutos
        intensityMmPerHour: 0.5 + Math.random() * 14.5, // 0.5-15 mm/hora
      });
    }
  }

  return events;
}

/**
 * Verifica si está lloviendo en un momento dado
 */
function isRaining(timestamp: Date, rainEvents: RainEvent[]): { raining: boolean; intensity: number } {
  for (const event of rainEvents) {
    const endTime = new Date(event.start.getTime() + event.durationMinutes * 60 * 1000);
    if (timestamp >= event.start && timestamp <= endTime) {
      return { raining: true, intensity: event.intensityMmPerHour };
    }
  }
  return { raining: false, intensity: 0 };
}

/**
 * Calcula la temperatura del aire (°C) para Guatemala
 * - Rango: 20-32°C
 * - Pico: 12:00-15:00
 * - Mínima: 03:00-06:00
 * - Más baja cuando llueve
 */
function generateAirTemperature(timestamp: Date, isRaining: boolean): number {
  const hour = timestamp.getHours();
  const minute = timestamp.getMinutes();
  const timeOfDay = hour + minute / 60;

  // Ciclo diurno: pico a las 14:00, mínimo a las 04:00
  const tempCycle = Math.sin(((timeOfDay - 4) / 12) * Math.PI);
  const baseTemp = 26; // Temperatura base
  const amplitude = 6; // Amplitud del ciclo (±6°C)

  let temp = baseTemp + amplitude * tempCycle;

  // Si está lloviendo, temperatura más baja
  if (isRaining) {
    temp -= 2 + Math.random() * 2; // -2 a -4°C
  }

  // Ruido aleatorio
  temp += (Math.random() - 0.5) * 1.5;

  // Limitar al rango 20-32°C
  return Math.max(20, Math.min(32, temp));
}

/**
 * Calcula la humedad relativa del aire (%)
 * - Rango: 60-95%
 * - Inversa a la temperatura
 * - Aumenta cuando llueve
 */
function generateAirHumidity(timestamp: Date, airTemp: number, isRaining: boolean): number {
  const hour = timestamp.getHours();
  const minute = timestamp.getMinutes();
  const timeOfDay = hour + minute / 60;

  // Inversa a temperatura: cuando temp sube, humedad baja
  const tempFactor = (32 - airTemp) / 12; // 0 = caliente, 1 = frío
  const baseHumidity = 65 + tempFactor * 20; // 65-85%

  // Ciclo diurno adicional
  const humidityCycle = -Math.sin(((timeOfDay - 4) / 12) * Math.PI);
  let humidity = baseHumidity + humidityCycle * 10;

  // Si está lloviendo, humedad muy alta
  if (isRaining) {
    humidity = 85 + Math.random() * 10; // 85-95%
  }

  // Ruido aleatorio
  humidity += (Math.random() - 0.5) * 3;

  // Limitar al rango 60-95%
  return Math.max(60, Math.min(95, humidity));
}

/**
 * Calcula la humedad del suelo (%)
 * - Rango: 40-80%
 * - Aumenta con lluvia
 * - Decrece gradualmente (evaporación)
 */
function generateSoilMoisture(
  timestamp: Date,
  rainAmount: number,
  previousSoilMoisture: number
): number {
  // Evaporación gradual (0.5% por hora en promedio)
  const hoursElapsed = 0.25; // 15 minutos = 0.25 horas
  let moisture = previousSoilMoisture - 0.5 * hoursElapsed;

  // Absorción de lluvia (no todo el agua de lluvia se absorbe)
  if (rainAmount > 0) {
    moisture += rainAmount * 2.5; // Factor de absorción
  }

  // Mayor evaporación durante el día
  const hour = timestamp.getHours();
  if (hour >= 10 && hour <= 16) {
    moisture -= 0.15; // Evaporación extra en horas pico
  }

  // Ruido aleatorio
  moisture += (Math.random() - 0.5) * 0.5;

  // Limitar al rango 40-80%
  return Math.max(40, Math.min(80, moisture));
}

/**
 * Calcula la luminosidad (lux)
 * - Noche (18:00-06:00): 0 lux
 * - Día: máximo ~100,000 lux al mediodía
 * - Reducida cuando llueve o está nublado
 */
function generateLuminosity(timestamp: Date, isRaining: boolean): number {
  const hour = timestamp.getHours();
  const minute = timestamp.getMinutes();
  const timeOfDay = hour + minute / 60;

  // Noche (18:00 a 06:00)
  if (timeOfDay < 6 || timeOfDay >= 18) {
    return Math.random() * 5; // Casi 0, algo de luz artificial/luna
  }

  // Día: ciclo sinusoidal con pico al mediodía
  const daylightCycle = Math.sin(((timeOfDay - 6) / 12) * Math.PI);
  let luminosity = 100000 * daylightCycle;

  // Si está lloviendo, luminosidad reducida (nubes)
  if (isRaining) {
    luminosity *= 0.2 + Math.random() * 0.3; // 20-50% de luminosidad normal
  } else {
    // Variación por nubes ocasionales
    luminosity *= 0.7 + Math.random() * 0.3; // 70-100%
  }

  // Ruido aleatorio
  luminosity *= 0.9 + Math.random() * 0.2;

  return Math.max(0, Math.round(luminosity));
}

/**
 * Calcula la precipitación (mm) para un intervalo de 15 minutos
 */
function generateRainfall(intensityMmPerHour: number): number {
  if (intensityMmPerHour === 0) return 0;

  // Convertir mm/hora a mm/15min
  const rainAmount = intensityMmPerHour / 4;

  // Variación aleatoria (±20%)
  return rainAmount * (0.8 + Math.random() * 0.4);
}

// ============================================================================
// GENERACIÓN Y ALMACENAMIENTO DE DATOS
// ============================================================================

/**
 * Genera todas las lecturas de sensores para el periodo especificado
 */
async function generateSensorReadings(config: Config): Promise<void> {
  console.log("\n🌡️  Generando datos de sensores...\n");
  console.log(`📅 Periodo: ${config.days} días`);
  console.log(`📍 Estación ID: ${config.stationId}`);
  console.log(`⏱️  Intervalo: ${config.intervalMinutes} minutos`);

  // Verificar que la estación existe
  const estacion = await prisma.estacion.findUnique({
    where: { id: config.stationId! },
  });

  if (!estacion) {
    throw new Error(`❌ No se encontró la estación con ID ${config.stationId}`);
  }

  console.log(`✓ Estación encontrada: ${estacion.nombre} (${estacion.codigo})\n`);

  // Obtener tipos de medición
  const tiposMedicion = await prisma.tipoMedicion.findMany({
    where: {
      clave: {
        in: [
          "air_temp_c",
          "air_humidity_pct",
          "soil_moisture_pct",
          "luminosity_lx",
          "rainfall_mm",
        ],
      },
    },
  });

  const tiposByClave = new Map(tiposMedicion.map(t => [t.clave, t]));

  // Validar que existen todos los tipos
  const requiredTypes = ["air_temp_c", "air_humidity_pct", "soil_moisture_pct", "luminosity_lx", "rainfall_mm"];
  const missingTypes = requiredTypes.filter(t => !tiposByClave.has(t));

  if (missingTypes.length > 0) {
    throw new Error(`❌ Faltan tipos de medición: ${missingTypes.join(", ")}`);
  }

  // Limpiar datos anteriores si se solicita
  if (config.clean) {
    console.log("🧹 Limpiando datos anteriores...");
    const deleted = await prisma.medicion.deleteMany({
      where: { estacionId: config.stationId! },
    });
    console.log(`✓ ${deleted.count} registros eliminados\n`);
  }

  // Generar eventos de lluvia
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - config.days * 24 * 60 * 60 * 1000);
  const rainEvents = generateRainEvents(startDate, config.days);

  console.log(`🌧️  ${rainEvents.length} eventos de lluvia generados\n`);

  // Generar lecturas
  const totalReadings = (config.days * 24 * 60) / config.intervalMinutes;
  const readings: SensorReading[] = [];
  let previousSoilMoisture = 55; // Valor inicial

  console.log(`📊 Generando ${totalReadings} lecturas por sensor...`);
  console.log(`   Total de datos: ${totalReadings * 5} registros\n`);

  let progressCount = 0;
  const progressStep = Math.floor(totalReadings / 20); // 5% por paso

  for (let i = 0; i < totalReadings; i++) {
    const timestamp = new Date(startDate.getTime() + i * config.intervalMinutes * 60 * 1000);
    const rainStatus = isRaining(timestamp, rainEvents);

    // Generar valores de sensores
    const airTemp = generateAirTemperature(timestamp, rainStatus.raining);
    const airHumidity = generateAirHumidity(timestamp, airTemp, rainStatus.raining);
    const rainfall = generateRainfall(rainStatus.intensity);
    const soilMoisture = generateSoilMoisture(timestamp, rainfall, previousSoilMoisture);
    const luminosity = generateLuminosity(timestamp, rainStatus.raining);

    previousSoilMoisture = soilMoisture;

    // Agregar lecturas
    readings.push({
      estacionId: config.stationId!,
      tipoId: tiposByClave.get("air_temp_c")!.id,
      instante: timestamp,
      valor: Number(airTemp.toFixed(2)),
    });

    readings.push({
      estacionId: config.stationId!,
      tipoId: tiposByClave.get("air_humidity_pct")!.id,
      instante: timestamp,
      valor: Number(airHumidity.toFixed(2)),
    });

    readings.push({
      estacionId: config.stationId!,
      tipoId: tiposByClave.get("soil_moisture_pct")!.id,
      instante: timestamp,
      valor: Number(soilMoisture.toFixed(2)),
    });

    readings.push({
      estacionId: config.stationId!,
      tipoId: tiposByClave.get("luminosity_lx")!.id,
      instante: timestamp,
      valor: Number(luminosity.toFixed(0)),
    });

    readings.push({
      estacionId: config.stationId!,
      tipoId: tiposByClave.get("rainfall_mm")!.id,
      instante: timestamp,
      valor: Number(rainfall.toFixed(2)),
    });

    // Mostrar progreso
    if (i > 0 && i % progressStep === 0) {
      progressCount += 5;
      const bar = "█".repeat(progressCount / 5) + "░".repeat(20 - progressCount / 5);
      process.stdout.write(`\r[${bar}] ${progressCount}%`);
    }
  }

  process.stdout.write(`\r[${"█".repeat(20)}] 100%\n\n`);

  // Insertar en base de datos en lotes
  console.log("💾 Insertando datos en base de datos...");
  const batchSize = 500;
  let inserted = 0;

  for (let i = 0; i < readings.length; i += batchSize) {
    const batch = readings.slice(i, i + batchSize);
    await prisma.medicion.createMany({
      data: batch,
      skipDuplicates: true,
    });
    inserted += batch.length;

    const percent = Math.round((inserted / readings.length) * 100);
    const bar = "█".repeat(Math.floor(percent / 5)) + "░".repeat(20 - Math.floor(percent / 5));
    process.stdout.write(`\r[${bar}] ${percent}%`);
  }

  process.stdout.write(`\r[${"█".repeat(20)}] 100%\n`);

  console.log(`\n✅ ${inserted} registros insertados exitosamente\n`);

  // Estadísticas
  console.log("📈 Estadísticas de datos generados:");
  console.log(`   • Periodo: ${startDate.toISOString().split('T')[0]} a ${endDate.toISOString().split('T')[0]}`);
  console.log(`   • Lecturas por sensor: ${totalReadings}`);
  console.log(`   • Total de registros: ${readings.length}`);
  console.log(`   • Eventos de lluvia: ${rainEvents.length}`);
}

// ============================================================================
// CLI Y MAIN
// ============================================================================

function parseArgs(): Config {
  const args = process.argv.slice(2);

  // Ayuda
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
📊 Script de Generación de Datos de Sensores
============================================

Genera datos de prueba realistas para sensores en clima tropical (Guatemala).

USO:
  pnpm seed:sensors [opciones]

OPCIONES:
  --days=N          Número de días a generar (default: 30)
  --station=ID      ID de la estación (default: 1)
  --all-stations    Generar datos para TODAS las estaciones activas 🆕
  --clean           Eliminar datos anteriores antes de insertar
  --interval=N      Intervalo en minutos (default: 15)
  --help, -h        Mostrar esta ayuda

EJEMPLOS:
  pnpm seed:sensors --days=30 --station=1 --clean
  pnpm seed:sensors --days=7 --station=2
  pnpm seed:sensors --days=30 --all-stations --clean 🆕
  pnpm seed:sensors --days=60 --interval=5 --all-stations

DATOS GENERADOS:
  • Temperatura aire: 20-32°C (pico 12:00-15:00)
  • Humedad relativa: 60-95% (inversa a temperatura)
  • Humedad suelo: 40-80% (aumenta con lluvia)
  • Luminosidad: 0-100,000 lux (0 de noche)
  • Precipitación: eventos esporádicos 14:00-18:00
`);
    process.exit(0);
  }

  const config: Config = {
    days: 30,
    stationId: 1,
    allStations: false,  // ✨ NUEVO
    clean: false,
    intervalMinutes: 15,
  };

  for (const arg of args) {
    if (arg.startsWith("--days=")) {
      config.days = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--station=")) {
      config.stationId = parseInt(arg.split("=")[1], 10);
    } else if (arg === "--all-stations") {  // ✨ NUEVO
      config.allStations = true;
      config.stationId = null;
    } else if (arg === "--clean") {
      config.clean = true;
    } else if (arg.startsWith("--interval=")) {
      config.intervalMinutes = parseInt(arg.split("=")[1], 10);
    }
  }

  // Validaciones
  if (isNaN(config.days) || config.days <= 0) {
    throw new Error("❌ --days debe ser un número positivo");
  }
  if (!config.allStations && (!config.stationId || isNaN(config.stationId) || config.stationId <= 0)) {
    throw new Error("❌ --station debe ser un número positivo o usar --all-stations");
  }
  if (isNaN(config.intervalMinutes) || config.intervalMinutes <= 0) {
    throw new Error("❌ --interval debe ser un número positivo");
  }

  return config;
}

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("  🌡️  GENERADOR DE DATOS DE SENSORES - CLIMA GUATEMALA");
  console.log("=".repeat(60));

  try {
    const config = parseArgs();

    // ✨ NUEVO: Generar para todas las estaciones
    if (config.allStations) {
      const estaciones = await prisma.estacion.findMany({
        where: { activo: true },
        select: { id: true, nombre: true, codigo: true },
        orderBy: { id: 'asc' }
      });

      if (estaciones.length === 0) {
        throw new Error("❌ No se encontraron estaciones activas");
      }

      console.log(`\n📍 Se generarán datos para ${estaciones.length} estaciones:\n`);
      estaciones.forEach(e => {
        console.log(`   • ${e.nombre} (${e.codigo}) - ID: ${e.id}`);
      });
      console.log();

      for (let i = 0; i < estaciones.length; i++) {
        const estacion = estaciones[i];
        
        console.log("\n" + "=".repeat(60));
        console.log(`  📍 [${i + 1}/${estaciones.length}] ${estacion.nombre} (${estacion.codigo})`);
        console.log("=".repeat(60));

        await generateSensorReadings({
          ...config,
          stationId: estacion.id,
        });
      }

      console.log("\n" + "=".repeat(60));
      console.log(`✨ Datos generados para todas las ${estaciones.length} estaciones`);
      console.log("=".repeat(60) + "\n");
      
    } else {
      // Modo original: una sola estación
      await generateSensorReadings(config);

      console.log("=".repeat(60));
      console.log("✨ ¡Proceso completado exitosamente!");
      console.log("=".repeat(60) + "\n");
    }
  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });