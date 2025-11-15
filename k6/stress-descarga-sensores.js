import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

/**
 * Prueba de Estrés para OPWS - Sistema de Descarga de Sensores
 *
 * Esta prueba simula 50 usuarios concurrentes durante 3 minutos realizando:
 * 1. Login con credenciales
 * 2. GET /api/estaciones
 * 3. GET /api/series con diferentes parámetros
 * 4. Logout (opcional)
 *
 * Métricas medidas:
 * - Requests por segundo (throughput)
 * - Tiempo de respuesta p95 y p99
 * - Tasa de error
 * - Usuarios concurrentes soportados
 */

// ============================================
// CONFIGURACIÓN
// ============================================

const API_URL = 'http://localhost:2002/api';

// Credenciales de prueba
const CREDENCIALES = {
  identifier: 'admin@opws.test',
  password: 'admin123'
};

// Parámetros de sensores para variar las peticiones
const SENSOR_KEYS = [
  'rainfall_mm',
  'air_temp_c',
  'air_humidity_pct',
  'soil_moisture_pct',
  'soil_temp_c',
  'luminosity_lx'
];

// Niveles de agrupación
const GROUP_LEVELS = ['raw', 'hour', 'day'];

// ============================================
// MÉTRICAS PERSONALIZADAS
// ============================================

const loginSuccessRate = new Rate('login_success_rate');
const estacionesSuccessRate = new Rate('estaciones_success_rate');
const seriesSuccessRate = new Rate('series_success_rate');
const loginDuration = new Trend('login_duration');
const estacionesDuration = new Trend('estaciones_duration');
const seriesDuration = new Trend('series_duration');
const totalRequests = new Counter('total_requests');
const errorCount = new Counter('error_count');

// ============================================
// OPCIONES DE EJECUCIÓN
// ============================================

export const options = {
  // Escenario de carga progresiva
  stages: [
    // Ramp-up: 0 → 50 usuarios en 30 segundos
    { duration: '30s', target: 50 },

    // Estrés sostenido: 50 usuarios durante 3 minutos
    { duration: '3m', target: 50 },

    // Ramp-down: 50 → 0 usuarios en 30 segundos
    { duration: '30s', target: 0 }
  ],

  // Umbrales de rendimiento
  thresholds: {
    // 95% de las peticiones deben completarse en menos de 2 segundos
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],

    // Tasa de éxito debe ser mayor al 95%
    'login_success_rate': ['rate>0.95'],
    'estaciones_success_rate': ['rate>0.95'],
    'series_success_rate': ['rate>0.90'], // Más tolerante porque puede no haber datos

    // Tasa de error debe ser menor al 5%
    'http_req_failed': ['rate<0.05'],
  },

  // Configuración de outputs (se sobrescribirá por CLI)
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Genera una fecha aleatoria en el rango de los últimos N días
 */
function getRandomDateRange(days = 7) {
  const now = new Date();
  const end = now.toISOString();

  const start = new Date();
  start.setDate(now.getDate() - days);
  const startISO = start.toISOString();

  return { from: startISO, to: end };
}

/**
 * Selecciona N elementos aleatorios de un array
 */
function getRandomElements(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

/**
 * Obtiene un elemento aleatorio de un array
 */
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// ============================================
// FLUJO PRINCIPAL DE LA PRUEBA
// ============================================

export default function () {
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // ============================================
  // PASO 1: LOGIN
  // ============================================

  const loginPayload = JSON.stringify(CREDENCIALES);

  const loginResponse = http.post(
    `${API_URL}/auth/login`,
    loginPayload,
    params
  );

  totalRequests.add(1);
  loginDuration.add(loginResponse.timings.duration);

  const loginSuccess = check(loginResponse, {
    'login: status 200': (r) => r.status === 200,
    'login: tiene token de acceso': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.access !== undefined && body.access !== null;
      } catch (e) {
        return false;
      }
    },
    'login: tiene perfil de usuario': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.profile !== undefined && body.profile.email !== undefined;
      } catch (e) {
        return false;
      }
    }
  });

  loginSuccessRate.add(loginSuccess);

  if (!loginSuccess) {
    errorCount.add(1);
    console.error(`❌ Login falló: ${loginResponse.status} - ${loginResponse.body}`);
    sleep(1);
    return; // Terminar iteración si falla el login
  }

  // Extraer token de la respuesta
  let token;
  try {
    const loginBody = JSON.parse(loginResponse.body);
    token = loginBody.access;
  } catch (e) {
    errorCount.add(1);
    console.error('❌ Error al parsear respuesta de login:', e);
    sleep(1);
    return;
  }

  // Actualizar headers con el token de autenticación
  const authParams = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };

  // Esperar un poco antes de la siguiente petición
  sleep(0.5);

  // ============================================
  // PASO 2: GET /api/estaciones
  // ============================================

  const estacionesResponse = http.get(
    `${API_URL}/estaciones`,
    authParams
  );

  totalRequests.add(1);
  estacionesDuration.add(estacionesResponse.timings.duration);

  const estacionesSuccess = check(estacionesResponse, {
    'estaciones: status 200': (r) => r.status === 200,
    'estaciones: es un array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body);
      } catch (e) {
        return false;
      }
    },
    'estaciones: tiene al menos una estación': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body) && body.length > 0;
      } catch (e) {
        return false;
      }
    }
  });

  estacionesSuccessRate.add(estacionesSuccess);

  if (!estacionesSuccess) {
    errorCount.add(1);
    console.error(`❌ Estaciones falló: ${estacionesResponse.status} - ${estacionesResponse.body}`);
  }

  // Extraer IDs de estaciones
  let estacionIds = [];
  try {
    const estacionesBody = JSON.parse(estacionesResponse.body);
    if (Array.isArray(estacionesBody) && estacionesBody.length > 0) {
      estacionIds = estacionesBody.map(e => e.id);
    }
  } catch (e) {
    console.error('❌ Error al parsear estaciones:', e);
  }

  sleep(0.3);

  // ============================================
  // PASO 3: GET /api/series (múltiples variaciones)
  // ============================================

  // Hacer entre 1 y 3 peticiones de series con diferentes parámetros
  const numSeriesRequests = Math.floor(Math.random() * 3) + 1;

  for (let i = 0; i < numSeriesRequests; i++) {
    // Seleccionar parámetros aleatorios
    const estacionId = estacionIds.length > 0
      ? getRandomElement(estacionIds)
      : 1; // Fallback si no hay estaciones

    const numKeys = Math.floor(Math.random() * 3) + 1; // 1-3 sensores
    const keys = getRandomElements(SENSOR_KEYS, numKeys).join(',');

    const group = getRandomElement(GROUP_LEVELS);

    // Rango de fechas aleatorio (entre 1 y 30 días)
    const daysRange = Math.floor(Math.random() * 30) + 1;
    const { from, to } = getRandomDateRange(daysRange);

    // Construir URL con query params
    const seriesUrl = `${API_URL}/series?estacionId=${estacionId}&keys=${keys}&from=${from}&to=${to}&group=${group}`;

    const seriesResponse = http.get(seriesUrl, authParams);

    totalRequests.add(1);
    seriesDuration.add(seriesResponse.timings.duration);

    const seriesSuccess = check(seriesResponse, {
      'series: status 200': (r) => r.status === 200,
      'series: es un objeto': (r) => {
        try {
          const body = JSON.parse(r.body);
          return typeof body === 'object' && body !== null;
        } catch (e) {
          return false;
        }
      },
      'series: tiene datos de sensores': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Object.keys(body).length > 0;
        } catch (e) {
          return false;
        }
      }
    });

    seriesSuccessRate.add(seriesSuccess);

    if (!seriesSuccess) {
      errorCount.add(1);
      console.error(`❌ Series falló: ${seriesResponse.status} - ${seriesResponse.body}`);
    }

    // Pequeña pausa entre peticiones de series
    sleep(0.2);
  }

  // ============================================
  // PASO 4: LOGOUT (Opcional)
  // ============================================
  // No hay endpoint de logout en la API, solo se limpia el token en el frontend
  // Por lo que este paso se omite

  // Pausa entre iteraciones completas del flujo
  sleep(1);
}

// ============================================
// HOOK DE SETUP (Antes de las pruebas)
// ============================================

export function setup() {
  console.log('🚀 Iniciando prueba de estrés OPWS...');
  console.log(`📊 Configuración:`);
  console.log(`   - API URL: ${API_URL}`);
  console.log(`   - Usuario: ${CREDENCIALES.identifier}`);
  console.log(`   - Escenario: 0→50→50→0 usuarios (30s + 3min + 30s)`);
  console.log(`   - Métricas: p95, p99, throughput, tasa de error`);
  console.log('');

  // Verificar que la API esté disponible
  const healthCheck = http.get('http://localhost:2002/health');

  if (healthCheck.status !== 200) {
    console.error('❌ ERROR: La API no está disponible en http://localhost:2002');
    console.error('   Asegúrate de que el backend esté corriendo.');
    throw new Error('API no disponible');
  }

  console.log('✅ API disponible y respondiendo');
  console.log('');

  return {};
}

// ============================================
// HOOK DE TEARDOWN (Después de las pruebas)
// ============================================

export function teardown(data) {
  console.log('');
  console.log('✅ Prueba de estrés completada');
  console.log('📁 Los resultados se guardarán en k6/results/');
}

// ============================================
// RESUMEN PERSONALIZADO
// ============================================

export function handleSummary(data) {
  // Generar nombre de archivo con timestamp
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/:/g, '')
    .replace(/\..+/, '')
    .replace('T', '-')
    .slice(0, 15); // YYYY-MM-DD-HHmm

  const filename = `stress-test-${timestamp}.json`;

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 RESUMEN DE PRUEBA DE ESTRÉS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Extraer métricas clave
  const metrics = data.metrics;

  // Throughput
  const iterations = metrics.iterations.values.count || 0;
  const duration = data.state.testRunDurationMs / 1000; // en segundos
  const throughput = (iterations / duration).toFixed(2);

  console.log(`⚡ THROUGHPUT:`);
  console.log(`   ${throughput} requests/segundo`);
  console.log(`   ${iterations} iteraciones completadas en ${duration.toFixed(2)}s`);
  console.log('');

  // Tiempos de respuesta
  console.log(`⏱️  TIEMPOS DE RESPUESTA:`);

  if (metrics.http_req_duration) {
    const p95 = metrics.http_req_duration.values['p(95)'];
    const p99 = metrics.http_req_duration.values['p(99)'];
    const avg = metrics.http_req_duration.values.avg;
    const max = metrics.http_req_duration.values.max;

    console.log(`   Promedio: ${avg.toFixed(2)}ms`);
    console.log(`   p95: ${p95.toFixed(2)}ms`);
    console.log(`   p99: ${p99.toFixed(2)}ms`);
    console.log(`   Máximo: ${max.toFixed(2)}ms`);
  }
  console.log('');

  // Tasa de error
  console.log(`❌ TASA DE ERROR:`);

  if (metrics.http_req_failed) {
    const errorRate = (metrics.http_req_failed.values.rate * 100).toFixed(2);
    const totalReqs = metrics.http_reqs.values.count || 0;
    const failedReqs = Math.round(totalReqs * metrics.http_req_failed.values.rate);

    console.log(`   ${errorRate}% (${failedReqs}/${totalReqs} requests fallidas)`);
  }
  console.log('');

  // Usuarios concurrentes
  console.log(`👥 USUARIOS CONCURRENTES:`);
  console.log(`   Máximo: 50 VUs (Virtual Users)`);
  console.log('');

  // Métricas por endpoint
  console.log(`📍 MÉTRICAS POR ENDPOINT:`);

  if (metrics.login_success_rate) {
    const loginRate = (metrics.login_success_rate.values.rate * 100).toFixed(2);
    console.log(`   Login: ${loginRate}% éxito`);
  }

  if (metrics.estaciones_success_rate) {
    const estRate = (metrics.estaciones_success_rate.values.rate * 100).toFixed(2);
    console.log(`   Estaciones: ${estRate}% éxito`);
  }

  if (metrics.series_success_rate) {
    const seriesRate = (metrics.series_success_rate.values.rate * 100).toFixed(2);
    console.log(`   Series: ${seriesRate}% éxito`);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Guardar resultados en JSON
  return {
    [`k6/results/${filename}`]: JSON.stringify(data, null, 2),
    'stdout': '', // No imprimir resumen por defecto de k6
  };
}
