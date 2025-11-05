# Integración con The Things Network (TTN)

Este documento describe la integración de OPWS con The Things Network para recibir datos de sensores IoT.

## 📋 Índice

1. [Descripción general](#descripción-general)
2. [Endpoint de webhook](#endpoint-de-webhook)
3. [Simulador de dispositivo](#simulador-de-dispositivo)
4. [Configuración de TTN](#configuración-de-ttn)
5. [Resolución de problemas](#resolución-de-problemas)

---

## 🌐 Descripción general

OPWS puede recibir lecturas de sensores ambientales desde dispositivos TTN mediante un webhook HTTP. Cuando un dispositivo envía datos a TTN, este puede reenviarlos automáticamente al backend de OPWS.

### Flujo de datos

```
┌──────────────────┐
│  Dispositivo IoT │
│  (LoRaWAN)       │
└────────┬─────────┘
         │
         │ Uplink
         ▼
┌──────────────────┐
│  The Things      │
│  Network (TTN)   │
└────────┬─────────┘
         │
         │ HTTP POST (Webhook)
         ▼
┌──────────────────┐
│  OPWS Backend    │
│  /api/ttn/uplink │
└────────┬─────────┘
         │
         │ Inserta en base de datos
         ▼
┌──────────────────┐
│  PostgreSQL      │
│  (mediciones)    │
└──────────────────┘
```

---

## 🔌 Endpoint de webhook

### URL del endpoint

```
POST http://localhost:2002/api/ttn/uplink
```

En producción, reemplaza `localhost:2002` con tu dominio público.

### Formato de la petición

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "dev_eui": "DISPOSITIVO-001",
  "timestamp": "2025-11-05T12:30:00.000Z",
  "payload": {
    "temperature": 25.5,
    "humidity": 75.2,
    "rainfall": 0.0,
    "soil_moisture": 62.8,
    "luminosity": 45000
  }
}
```

### Descripción de los campos

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `dev_eui` | String | ✅ | Identificador único del dispositivo (Device EUI) |
| `timestamp` | String (ISO 8601) | ✅ | Marca de tiempo de la lectura |
| `payload.temperature` | Number | ✅ | Temperatura del aire en °C |
| `payload.humidity` | Number | ✅ | Humedad relativa del aire en % |
| `payload.rainfall` | Number | ✅ | Precipitación acumulada en mm |
| `payload.soil_moisture` | Number | ✅ | Humedad del suelo en % |
| `payload.luminosity` | Number | ✅ | Luminosidad en lux |

### Respuesta exitosa

**Status Code:** `200 OK`

```json
{
  "ok": true,
  "message": "Lecturas guardadas",
  "estacion": "Estación DISPOSITIVO-001",
  "mediciones_insertadas": 5,
  "timestamp": "2025-11-05T12:30:00.000Z"
}
```

### Respuestas de error

#### Error 400 - Campos faltantes
```json
{
  "ok": false,
  "error": "Faltan campos requeridos: dev_eui, timestamp, payload"
}
```

#### Error 400 - Payload incompleto
```json
{
  "ok": false,
  "error": "El payload debe contener: temperature, humidity, rainfall, soil_moisture, luminosity"
}
```

#### Error 500 - Error de configuración
```json
{
  "ok": false,
  "error": "Error: No se encontraron todos los tipos de medición necesarios en la base de datos"
}
```

---

## 🎮 Simulador de dispositivo

Para pruebas y desarrollo, OPWS incluye un simulador que genera lecturas aleatorias realistas.

### Ubicación del script

```
scripts/simulate-ttn.js
```

### Uso básico

```bash
# Ejecutar con configuración por defecto
node scripts/simulate-ttn.js

# Dev EUI personalizado
node scripts/simulate-ttn.js MI-SENSOR-123

# Intervalo personalizado (en segundos)
node scripts/simulate-ttn.js MI-SENSOR-123 60

# Enviar cada 10 segundos para pruebas rápidas
node scripts/simulate-ttn.js TEST-001 10
```

### Parámetros del simulador

| Parámetro | Posición | Por defecto | Descripción |
|-----------|----------|-------------|-------------|
| dev_eui | 1 | `SIMULATOR-001` | Identificador del dispositivo |
| intervalo | 2 | `300` (5 min) | Segundos entre lecturas |

### Características del simulador

El simulador genera valores realistas basados en condiciones ambientales típicas:

#### 🌡️ Temperatura del aire
- **Rango:** 20-35°C
- **Variación:** ±0.1°C

#### 💧 Humedad del aire
- **Rango:** 60-95%
- **Variación:** ±0.1%

#### 🌧️ Precipitación
- **Probabilidad de lluvia:** 20%
- **Cuando llueve:** 0-10 mm
- **Sin lluvia:** 0 mm
- **Precisión:** ±0.01 mm

#### 🌱 Humedad del suelo
- **Rango:** 40-80%
- **Variación:** ±0.1%

#### ☀️ Luminosidad (según hora del día)
- **Noche (0-6h, 20-24h):** 0-500 lux
- **Amanecer/Atardecer (6-8h, 18-20h):** 500-20,000 lux
- **Día (8-18h):** 20,000-80,000 lux

### Ejemplo de salida del simulador

```
╔════════════════════════════════════════════════════════════════╗
║      🛰️  SIMULADOR DE DISPOSITIVO THE THINGS NETWORK 🛰️        ║
╚════════════════════════════════════════════════════════════════╝

📋 Configuración:
   • Dev EUI: SIMULATOR-001
   • Intervalo: 300 segundos (5 minutos)
   • Endpoint: http://localhost:2002/api/ttn/uplink

🚀 Iniciando simulador... (Presiona Ctrl+C para detener)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ [14:30:25] Lectura enviada exitosamente
   📡 Dispositivo: SIMULATOR-001
   🌡️  Temperatura: 27.3°C
   💧 Humedad aire: 78.5%
   🌧️  Precipitación: 0 mm
   🌱 Humedad suelo: 65.2%
   ☀️  Luminosidad: 52340 lx
   🎯 Estación: Estación SIMULATOR-001
   📊 Mediciones insertadas: 5
```

### Detener el simulador

Presiona `Ctrl+C` para detener el simulador de forma segura.

---

## ⚙️ Configuración de TTN

### Paso 1: Crear una aplicación en TTN

1. Inicia sesión en [The Things Network Console](https://console.thethingsnetwork.org/)
2. Ve a **Applications** → **Create Application**
3. Completa el formulario y crea la aplicación

### Paso 2: Registrar dispositivos

1. En tu aplicación, ve a **End devices** → **Register end device**
2. Registra tus dispositivos LoRaWAN
3. Toma nota del **DevEUI** de cada dispositivo

### Paso 3: Configurar el webhook

1. En tu aplicación de TTN, ve a **Integrations** → **Webhooks**
2. Haz clic en **Add webhook** → **Custom webhook**
3. Configura los siguientes campos:

| Campo | Valor |
|-------|-------|
| **Webhook ID** | `opws-webhook` |
| **Webhook format** | `JSON` |
| **Base URL** | `https://tu-dominio.com/api/ttn/uplink` |
| **Uplink message** | ✅ Activado |
| **Downlink messages** | ❌ Desactivado |

4. Guarda el webhook

### Paso 4: Configurar el decoder

TTN usa un decoder de JavaScript para transformar los bytes del payload en JSON. Crea un decoder en TTN con esta estructura:

```javascript
function decodeUplink(input) {
  var bytes = input.bytes;

  // Decodificar según tu dispositivo específico
  // Este es un ejemplo genérico
  return {
    data: {
      temperature: (bytes[0] << 8 | bytes[1]) / 100.0,
      humidity: (bytes[2] << 8 | bytes[3]) / 100.0,
      rainfall: (bytes[4] << 8 | bytes[5]) / 100.0,
      soil_moisture: (bytes[6] << 8 | bytes[7]) / 100.0,
      luminosity: bytes[8] << 24 | bytes[9] << 16 | bytes[10] << 8 | bytes[11]
    }
  };
}
```

### Paso 5: Transformar el webhook

Crea una transformación en TTN para adaptar el formato al esperado por OPWS:

```javascript
function transform(payload) {
  return {
    dev_eui: payload.end_device_ids.device_id,
    timestamp: payload.received_at,
    payload: payload.uplink_message.decoded_payload
  };
}
```

---

## 🔧 Resolución de problemas

### El simulador no se conecta al backend

**Problema:** `Error de conexión: fetch failed`

**Soluciones:**
1. Verifica que el backend esté corriendo:
   ```bash
   docker-compose ps
   ```
2. Verifica que el puerto 2002 esté accesible:
   ```bash
   curl http://localhost:2002/health
   ```
3. Si usas Docker, asegúrate de que el contenedor esté saludable

### Error "No se encontraron todos los tipos de medición"

**Problema:** El endpoint devuelve error 500 sobre tipos de medición faltantes.

**Solución:** Ejecuta el seed de la base de datos:
```bash
cd backend
pnpm prisma db seed
```

### Las lecturas se duplican

**Problema:** El mismo `dev_eui` + `timestamp` genera múltiples entradas.

**Solución:** El endpoint usa `skipDuplicates: true` en `createMany`, por lo que las lecturas duplicadas se ignoran automáticamente. Esto es por diseño.

### El dispositivo se crea pero no aparece en el frontend

**Problema:** El simulador dice "Lecturas guardadas" pero no ves datos.

**Soluciones:**
1. Verifica que la estación se creó:
   ```bash
   curl http://localhost:2002/api/estaciones
   ```
2. Refresca la página del frontend
3. Verifica que el usuario tenga permisos para ver todas las estaciones

### El webhook de TTN devuelve 404

**Problema:** TTN reporta error 404 al enviar datos.

**Soluciones:**
1. Verifica que la URL del webhook sea correcta (debe terminar en `/api/ttn/uplink`)
2. Asegúrate de que el servidor sea accesible públicamente (no `localhost`)
3. Usa un servicio como [ngrok](https://ngrok.com/) para exponer tu backend local:
   ```bash
   ngrok http 2002
   ```

### Formato de payload incorrecto

**Problema:** Error 400 "El payload debe contener..."

**Solución:** Asegúrate de que el decoder de TTN genere un objeto con estas claves exactas:
- `temperature`
- `humidity`
- `rainfall`
- `soil_moisture`
- `luminosity`

---

## 📚 Referencias

- [The Things Network Documentation](https://www.thethingsnetwork.org/docs/)
- [LoRaWAN Specification](https://lora-alliance.org/resource_hub/lorawan-specification-v1-0-3/)
- [Prisma Documentation](https://www.prisma.io/docs/)

---

## 🆘 Soporte

Si encuentras problemas no cubiertos en esta documentación, por favor:

1. Revisa los logs del backend:
   ```bash
   docker-compose logs -f api
   ```

2. Verifica el estado de la base de datos:
   ```bash
   docker-compose logs -f db
   ```

3. Contacta al equipo de desarrollo con:
   - Logs del error
   - Configuración del webhook
   - Ejemplo del payload recibido

---

**Última actualización:** 2025-11-05
**Versión:** 1.0.0
