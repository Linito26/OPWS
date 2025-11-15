# 🧪 Guía de Ejecución de Pruebas OPWS

Este documento contiene las instrucciones paso a paso para ejecutar las pruebas E2E y de estrés del sistema OPWS (Open Weather Platform System).

---

## 📋 Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Prueba E2E con Playwright](#prueba-e2e-con-playwright)
3. [Prueba de Estrés con k6](#prueba-de-estrés-con-k6)
4. [Solución de Problemas](#solución-de-problemas)
5. [Interpretación de Resultados](#interpretación-de-resultados)

---

## 📦 Requisitos Previos

### Software Necesario

1. **Node.js** (v18 o superior)
   ```bash
   node --version
   ```

2. **pnpm** (v9 o superior)
   ```bash
   pnpm --version
   ```

3. **k6** (para pruebas de estrés)

   **En macOS:**
   ```bash
   brew install k6
   ```

   **En Ubuntu/Debian:**
   ```bash
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6
   ```

   **En Windows:**
   ```powershell
   choco install k6
   # O descarga desde: https://dl.k6.io/msi/k6-latest-amd64.msi
   ```

   Verificar instalación:
   ```bash
   k6 version
   ```

### Base de Datos con Datos de Prueba

Asegúrate de que la base de datos tenga:
- Al menos 1 estación configurada
- Datos de sensores en los últimos 7 días
- Usuario de prueba: `admin@opws.test` / `admin123`

Para poblar datos de prueba (si es necesario):
```bash
cd backend
npm run seed
```

---

## 🎭 Prueba E2E con Playwright

### Descripción

La prueba E2E verifica el flujo completo de:
1. ✅ Login con credenciales válidas
2. ✅ Navegación a página de sensores
3. ✅ Selección de estación
4. ✅ Selección de rango de fechas
5. ✅ Descarga de archivo Excel
6. ✅ Validación de contenido del archivo

### Paso 1: Levantar el Backend

Abre una terminal y ejecuta:

```bash
cd backend
npm run dev
```

**Salida esperada:**
```
✨ Server running on http://localhost:2002
✅ Database connection established
```

**Verifica que la API esté corriendo:**
```bash
curl http://localhost:2002/health
```

Deberías ver:
```json
{"ok":true,"service":"OPWS API"}
```

### Paso 2: Levantar el Frontend

Abre **otra terminal nueva** y ejecuta:

```bash
cd opws-web
pnpm dev
```

**Salida esperada:**
```
  VITE v7.x.x ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**Verifica que el frontend esté corriendo:**

Abre tu navegador en `http://localhost:5173` y deberías ver la página de login.

### Paso 3: Ejecutar la Prueba E2E

Abre **una tercera terminal** y ejecuta:

```bash
cd opws-web
pnpm test:e2e
```

**Opciones adicionales:**

```bash
# Ver la prueba en modo UI (interfaz gráfica)
pnpm test:e2e:ui

# Ver el navegador mientras se ejecuta (modo headed)
pnpm test:e2e:headed

# Ver el reporte HTML después de ejecutar
pnpm test:e2e:report
```

### Resultados de la Prueba

**Salida esperada (éxito):**

```
Running 3 tests using 1 worker

  ✓  [chromium] › descarga-grafica.spec.ts:30:3 › Debe descargar archivo Excel... (15s)
  ✓  [chromium] › descarga-grafica.spec.ts:155:3 › Debe manejar error de login... (3s)
  ✓  [chromium] › descarga-grafica.spec.ts:175:3 › Debe verificar autenticación... (2s)

  3 passed (20s)
```

**Archivos generados:**

- `opws-web/downloads/` - Archivos Excel descargados
- `opws-web/test-results/` - Capturas de pantalla y videos (si hay fallos)
- `opws-web/playwright-report/` - Reporte HTML interactivo
- `opws-web/test-results/results.json` - Resultados en JSON

### Ver el Reporte HTML

```bash
cd opws-web
pnpm test:e2e:report
```

Esto abrirá automáticamente el reporte en tu navegador con:
- Estado de cada prueba (✓ pasó, ✗ falló)
- Tiempos de ejecución
- Capturas de pantalla
- Videos de las pruebas
- Logs detallados

---

## 🚀 Prueba de Estrés con k6

### Descripción

La prueba de estrés simula:
- **50 usuarios concurrentes** durante 3 minutos
- Cada usuario realiza:
  1. Login con credenciales
  2. GET `/api/estaciones`
  3. GET `/api/series` con diferentes parámetros (1-3 veces)
- **Métricas medidas:**
  - Throughput (requests por segundo)
  - Tiempo de respuesta p95 y p99
  - Tasa de error
  - Tasa de éxito por endpoint

### Paso 1: Asegúrate que el Backend esté corriendo

La prueba de estrés **solo requiere el backend**, no el frontend.

```bash
cd backend
npm run dev
```

**Verifica:**
```bash
curl http://localhost:2002/health
```

### Paso 2: Ejecutar la Prueba de Estrés

Desde el directorio raíz del proyecto:

```bash
k6 run k6/stress-descarga-sensores.js
```

**Salida en tiempo real:**

```
🚀 Iniciando prueba de estrés OPWS...
📊 Configuración:
   - API URL: http://localhost:2002/api
   - Usuario: admin@opws.test
   - Escenario: 0→50→50→0 usuarios (30s + 3min + 30s)

✅ API disponible y respondiendo

     ✓ login: status 200
     ✓ login: tiene token de acceso
     ✓ estaciones: status 200
     ✓ series: status 200

     checks.........................: 98.50% ✓ 1234      ✗ 19
     data_received..................: 2.1 MB 8.5 kB/s
     http_req_duration..............: avg=124.52ms min=12ms med=98ms max=1.2s p(95)=245ms p(99)=456ms
     http_reqs......................: 1500   6.25/s
     iterations.....................: 450    1.875/s
     vus............................: 50     min=0      max=50
```

### Paso 3: Revisar Resultados

Los resultados se guardan automáticamente en:

```
k6/results/stress-test-2025-11-15-1430.json
```

**Formato del nombre:** `stress-test-YYYY-MM-DD-HHmm.json`

El archivo JSON contiene:
- Métricas detalladas de todas las requests
- Tiempos de respuesta (avg, min, max, p90, p95, p99)
- Tasa de éxito/fallo por endpoint
- Información de checks y validaciones
- Datos de throughput y VUs (Virtual Users)

### Analizar Resultados con jq

Si tienes `jq` instalado:

```bash
# Ver resumen de métricas
cat k6/results/stress-test-*.json | jq '.metrics | keys'

# Ver p95 y p99 de http_req_duration
cat k6/results/stress-test-*.json | jq '.metrics.http_req_duration.values'

# Ver tasa de éxito de login
cat k6/results/stress-test-*.json | jq '.metrics.login_success_rate.values.rate'
```

---

## 🔧 Solución de Problemas

### Problema: "Backend no está disponible"

**Error:**
```
❌ ERROR: La API no está disponible en http://localhost:2002
```

**Solución:**
1. Verifica que el backend esté corriendo:
   ```bash
   cd backend
   npm run dev
   ```
2. Verifica el puerto en `.env`:
   ```
   PORT=2002
   ```

### Problema: "Login falló - 429 Too Many Requests"

**Error:**
```
❌ Login falló: 429 - Demasiadas solicitudes desde esta IP
```

**Causa:** Rate limiting activado (máximo 5 intentos de login en 15 minutos)

**Solución:**
1. Espera 15 minutos
2. O reinicia el backend
3. O ajusta el rate limit en `backend/src/config/security.ts`:
   ```typescript
   windowMs: 15 * 60 * 1000, // Cambia a un valor mayor
   max: 100, // Aumenta el límite
   ```

### Problema: "No hay estaciones disponibles"

**Error en prueba E2E:**
```
⚠️  No hay estaciones disponibles, usando valor por defecto
```

**Solución:**
```bash
cd backend
npm run seed
```

Esto poblará la base de datos con estaciones y datos de prueba.

### Problema: "Playwright no puede descargar archivos"

**Error:**
```
Error: Download not started within 30000ms
```

**Soluciones:**
1. Verifica que hay datos en la estación seleccionada
2. Aumenta el timeout en `playwright.config.ts`:
   ```typescript
   timeout: 120 * 1000, // 2 minutos
   ```
3. Verifica que el botón de exportar esté visible:
   ```bash
   pnpm test:e2e:headed
   ```

### Problema: "k6 no reconocido como comando"

**Solución:**

Reinstala k6 siguiendo las instrucciones de [Requisitos Previos](#requisitos-previos).

Verifica:
```bash
which k6
k6 version
```

### Problema: "Cannot find module 'xlsx'"

**Error en prueba E2E:**
```
Error: Cannot find module 'xlsx'
```

**Solución:**
```bash
cd opws-web
pnpm install
```

---

## 📊 Interpretación de Resultados

### Prueba E2E - Criterios de Éxito

✅ **Prueba exitosa si:**
- Login se completa en menos de 5 segundos
- Navegación a /sensores es exitosa
- Al menos 1 estación está disponible
- Descarga de Excel se completa en menos de 30 segundos
- Archivo Excel contiene:
  - Al menos 1 hoja
  - Columna de tiempo/fecha
  - Al menos 1 fila de datos

❌ **Prueba fallida si:**
- Login no funciona con credenciales válidas
- Redirección no funciona
- No se descarga el archivo
- Archivo Excel está vacío o corrupto

### Prueba de Estrés - Umbrales Esperados

✅ **Rendimiento aceptable:**

| Métrica | Umbral Esperado | Significado |
|---------|----------------|-------------|
| **p95 Response Time** | < 2000ms | 95% de las requests completan en menos de 2s |
| **p99 Response Time** | < 5000ms | 99% de las requests completan en menos de 5s |
| **Tasa de Éxito (Login)** | > 95% | Al menos 95% de logins exitosos |
| **Tasa de Éxito (Estaciones)** | > 95% | Al menos 95% de llamadas exitosas |
| **Tasa de Éxito (Series)** | > 90% | Al menos 90% de llamadas exitosas |
| **Tasa de Error Global** | < 5% | Menos del 5% de requests fallidas |
| **Throughput** | > 5 req/s | Al menos 5 requests por segundo |

⚠️ **Señales de alerta:**

- **p95 > 3000ms**: El servidor está lento, considera optimización
- **Tasa de error > 10%**: Hay problemas de estabilidad
- **Throughput < 3 req/s**: El servidor no escala bien
- **Checks fallando**: Problemas con la lógica de negocio o datos

### Métricas Clave de k6

```javascript
// Ejemplo de salida
checks.........................: 98.50%  // ✅ Muy bueno (>95%)
http_req_duration..............: avg=124ms p(95)=245ms p(99)=456ms  // ✅ Excelente
http_req_failed................: 1.50%   // ✅ Bueno (<5%)
http_reqs......................: 1500    // Total de requests
iterations.....................: 450     // Iteraciones completadas
vus............................: 50      // Usuarios concurrentes
```

**Interpretación:**
- ✅ **Checks 98.5%**: Casi todas las validaciones pasaron
- ✅ **p95 245ms**: 95% de requests < 245ms (muy rápido)
- ✅ **Error rate 1.5%**: Muy pocas requests fallaron
- ✅ **50 VUs**: El sistema soportó 50 usuarios concurrentes sin problemas

---

## 🎯 Comandos Rápidos

### Ejecutar Todo de una Vez

**Terminal 1 (Backend):**
```bash
cd backend && npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd opws-web && pnpm dev
```

**Terminal 3 (Pruebas E2E):**
```bash
cd opws-web && pnpm test:e2e
```

**Terminal 4 (Prueba de Estrés - solo requiere backend):**
```bash
k6 run k6/stress-descarga-sensores.js
```

### Limpiar Resultados Antiguos

```bash
# Limpiar resultados de Playwright
rm -rf opws-web/test-results opws-web/playwright-report opws-web/downloads

# Limpiar resultados de k6 (mantener solo el más reciente)
cd k6/results
ls -t | tail -n +2 | xargs rm --
```

---

## 📝 Notas Adicionales

### Credenciales de Prueba por Defecto

```
Email: admin@opws.test
Password: admin123
Rol: ADMINISTRADOR
```

Si estas credenciales no funcionan, verifica el seed de la base de datos:
```bash
cd backend
npm run seed
```

### Variables de Entorno

**Backend (.env):**
```env
NODE_ENV=development
PORT=2002
DATABASE_URL=postgresql://user:pass@localhost:5432/opws
JWT_SECRET=your-secret-min-32-chars
JWT_EXPIRES_IN=8h
CORS_ORIGINS=http://localhost:5173
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:2002/api
```

### Ejecución en CI/CD

Para ejecutar las pruebas en un pipeline de CI/CD:

```bash
# Instalar dependencias
pnpm install

# Instalar navegadores de Playwright
npx playwright install --with-deps chromium

# Ejecutar pruebas E2E sin interfaz gráfica
pnpm test:e2e

# Ejecutar pruebas de estrés con salida JSON
k6 run --out json=k6/results/ci-test.json k6/stress-descarga-sensores.js
```

---

## 🆘 Soporte

Si encuentras problemas no cubiertos en esta guía:

1. Verifica los logs del backend (`backend/logs/`)
2. Revisa el reporte HTML de Playwright (`pnpm test:e2e:report`)
3. Verifica que todos los servicios estén corriendo:
   ```bash
   # Backend
   curl http://localhost:2002/health

   # Frontend
   curl http://localhost:5173
   ```
4. Consulta la documentación oficial:
   - [Playwright Docs](https://playwright.dev/)
   - [k6 Docs](https://k6.io/docs/)

---

## ✅ Checklist de Pre-Ejecución

Antes de ejecutar las pruebas, verifica:

- [ ] Node.js v18+ instalado
- [ ] pnpm v9+ instalado
- [ ] k6 instalado (solo para pruebas de estrés)
- [ ] Base de datos PostgreSQL corriendo
- [ ] Variables de entorno configuradas
- [ ] Backend corriendo en puerto 2002
- [ ] Frontend corriendo en puerto 5173 (solo para E2E)
- [ ] Datos de prueba en la base de datos (seed ejecutado)
- [ ] Usuario `admin@opws.test` existe

**¡Listo para ejecutar las pruebas!** 🚀
