#!/usr/bin/env node

/**
 * Simulador de dispositivo The Things Network (TTN)
 *
 * Genera lecturas de sensores ambientales cada 5 minutos y las envía
 * al endpoint POST /api/ttn/uplink del backend OPWS.
 *
 * Uso:
 *   node scripts/simulate-ttn.js [dev_eui] [intervalo_segundos]
 *
 * Ejemplos:
 *   node scripts/simulate-ttn.js                    # dev_eui por defecto, cada 5 min
 *   node scripts/simulate-ttn.js ABC123             # dev_eui personalizado
 *   node scripts/simulate-ttn.js ABC123 10          # cada 10 segundos
 */

const DEV_EUI_DEFAULT = "SIMULATOR-001";
const API_URL = "http://localhost:2002/api/ttn/uplink";
const INTERVALO_DEFAULT = 300; // 5 minutos en segundos

// Parámetros de línea de comandos
const devEui = process.argv[2] || DEV_EUI_DEFAULT;
const intervaloSegundos = parseInt(process.argv[3]) || INTERVALO_DEFAULT;

/**
 * Genera un valor aleatorio entre min y max
 */
function random(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Redondea un número a N decimales
 */
function round(num, decimals = 2) {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Calcula la luminosidad basada en la hora del día (simulación realista)
 * - Noche (0-6h, 20-24h): 0-500 lux
 * - Amanecer/Atardecer (6-8h, 18-20h): 500-20000 lux
 * - Día (8-18h): 20000-80000 lux
 */
function getLuminosity() {
  const now = new Date();
  const hour = now.getHours();

  if (hour >= 0 && hour < 6 || hour >= 20) {
    // Noche
    return round(random(0, 500), 0);
  } else if (hour >= 6 && hour < 8 || hour >= 18 && hour < 20) {
    // Amanecer/Atardecer
    return round(random(500, 20000), 0);
  } else {
    // Día
    return round(random(20000, 80000), 0);
  }
}

/**
 * Genera lecturas aleatorias de sensores
 */
function generateReadings() {
  // Temperatura del aire: 20-35°C
  const temperature = round(random(20, 35), 1);

  // Humedad del aire: 60-95%
  const humidity = round(random(60, 95), 1);

  // Precipitación: 80% probabilidad de 0mm, 20% probabilidad de 0-10mm
  const rainfall = Math.random() < 0.8 ? 0 : round(random(0, 10), 2);

  // Humedad del suelo: 40-80%
  const soil_moisture = round(random(40, 80), 1);

  // Luminosidad según hora del día
  const luminosity = getLuminosity();

  return {
    temperature,
    humidity,
    rainfall,
    soil_moisture,
    luminosity,
  };
}

/**
 * Envía las lecturas al endpoint TTN
 */
async function sendReading() {
  const payload = generateReadings();
  const data = {
    dev_eui: devEui,
    timestamp: new Date().toISOString(),
    payload,
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`\n✅ [${new Date().toLocaleTimeString()}] Lectura enviada exitosamente`);
      console.log(`   📡 Dispositivo: ${devEui}`);
      console.log(`   🌡️  Temperatura: ${payload.temperature}°C`);
      console.log(`   💧 Humedad aire: ${payload.humidity}%`);
      console.log(`   🌧️  Precipitación: ${payload.rainfall} mm`);
      console.log(`   🌱 Humedad suelo: ${payload.soil_moisture}%`);
      console.log(`   ☀️  Luminosidad: ${payload.luminosity} lx`);
      console.log(`   🎯 Estación: ${result.estacion}`);
      console.log(`   📊 Mediciones insertadas: ${result.mediciones_insertadas}`);
    } else {
      console.error(`\n❌ Error al enviar lectura: ${result.error || response.statusText}`);
    }
  } catch (error) {
    console.error(`\n❌ Error de conexión: ${error.message}`);
    console.error(`   Asegúrate de que el backend esté corriendo en ${API_URL}`);
  }
}

/**
 * Inicia el simulador
 */
async function main() {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║      🛰️  SIMULADOR DE DISPOSITIVO THE THINGS NETWORK 🛰️        ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log();
  console.log(`📋 Configuración:`);
  console.log(`   • Dev EUI: ${devEui}`);
  console.log(`   • Intervalo: ${intervaloSegundos} segundos (${intervaloSegundos / 60} minutos)`);
  console.log(`   • Endpoint: ${API_URL}`);
  console.log();
  console.log(`🚀 Iniciando simulador... (Presiona Ctrl+C para detener)`);
  console.log("━".repeat(64));

  // Enviar primera lectura inmediatamente
  await sendReading();

  // Luego enviar cada N segundos
  setInterval(sendReading, intervaloSegundos * 1000);
}

// Manejar Ctrl+C
process.on("SIGINT", () => {
  console.log("\n\n👋 Simulador detenido. ¡Hasta luego!");
  process.exit(0);
});

// Iniciar
main().catch((error) => {
  console.error("❌ Error fatal:", error);
  process.exit(1);
});
