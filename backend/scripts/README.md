# Script de Generación de Datos de Sensores

Script para generar datos de prueba realistas para el sistema de monitoreo de sensores OPWS, simulando condiciones climáticas tropicales de Guatemala.

## 🎯 Características

- **Datos realistas** basados en clima tropical de Guatemala
- **Patrones diurnos/nocturnos** con variaciones naturales
- **Eventos de lluvia** con correlaciones (afecta temperatura, humedad, luminosidad)
- **Opciones configurables** por línea de comandos
- **Progreso visual** durante la generación
- **Inserción eficiente** por lotes

## 📊 Datos Generados

### Sensores Incluidos

| Sensor | Rango | Comportamiento |
|--------|-------|----------------|
| **Temperatura aire** | 20-32°C | Pico 12:00-15:00, mínima 03:00-06:00, baja con lluvia |
| **Humedad relativa** | 60-95% | Inversa a temperatura, alta durante lluvia |
| **Humedad suelo** | 40-80% | Aumenta con lluvia, decrece gradualmente |
| **Luminosidad** | 0-100,000 lx | 0 de noche (18:00-06:00), máximo al mediodía, reducida con lluvia |
| **Precipitación** | 0-15 mm/h | Eventos esporádicos (15-20%), típicamente 14:00-18:00 |

### Patrones Realistas

- **Ciclo diurno**: Temperatura y luminosidad siguen el ciclo solar
- **Eventos de lluvia**: 15-20% de días con lluvia, duración 30-120 min, intensidad 0.5-15 mm/h
- **Correlaciones**: La lluvia afecta temperatura (↓), humedad aire (↑), humedad suelo (↑), luminosidad (↓)
- **Ruido aleatorio**: Variaciones naturales en todas las mediciones
- **Evaporación**: Humedad del suelo decrece gradualmente entre lluvias

## 🚀 Uso

### Comando Básico

```bash
pnpm seed:sensors
```

Genera datos para:
- 30 días hacia atrás desde hoy
- Estación ID = 1
- Lecturas cada 15 minutos
- Sin limpiar datos anteriores

### Opciones Disponibles

```bash
pnpm seed:sensors [opciones]
```

| Opción | Descripción | Default |
|--------|-------------|---------|
| `--days=N` | Número de días a generar | 30 |
| `--station=ID` | ID de la estación | 1 |
| `--interval=N` | Intervalo en minutos entre lecturas | 15 |
| `--clean` | Eliminar datos anteriores antes de insertar | false |
| `--help`, `-h` | Mostrar ayuda | - |

### Ejemplos

#### Generar 30 días con limpieza

```bash
pnpm seed:sensors --days=30 --station=1 --clean
```

#### Generar 7 días para otra estación

```bash
pnpm seed:sensors --days=7 --station=2
```

#### Generar 2 meses con lecturas cada 5 minutos

```bash
pnpm seed:sensors --days=60 --interval=5 --clean
```

#### Prueba rápida (1 día)

```bash
pnpm seed:sensors --days=1 --station=1 --clean
```

## 📈 Cálculo de Datos

### Volumen de Datos

Para 30 días con lecturas cada 15 minutos:

- **Lecturas por día**: 24 horas × 4 lecturas/hora = 96 lecturas
- **Total lecturas**: 96 × 30 días = 2,880 lecturas por sensor
- **Sensores**: 5 tipos
- **Total registros**: 2,880 × 5 = **14,400 registros**

Para otros intervalos:

| Intervalo | Lecturas/día | Total 30 días | Total registros |
|-----------|--------------|---------------|-----------------|
| 5 min | 288 | 8,640 | 43,200 |
| 10 min | 144 | 4,320 | 21,600 |
| 15 min | 96 | 2,880 | 14,400 |
| 30 min | 48 | 1,440 | 7,200 |
| 60 min | 24 | 720 | 3,600 |

## 🔧 Requisitos

### Base de Datos

El script requiere que existan en la base de datos:

1. **Estación** con el ID especificado (default: 1)
2. **Tipos de medición** con las siguientes claves:
   - `air_temp_c`
   - `air_humidity_pct`
   - `soil_moisture_pct`
   - `luminosity_lx`
   - `rainfall_mm`

### Verificar Estaciones

```bash
# Usando Prisma Studio
pnpm prisma:studio

# O verificar en código
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.estacion.findMany().then(console.log).finally(() => prisma.\$disconnect());
"
```

### Crear Tipos de Medición

Si necesitas crear los tipos de medición, ejecuta primero el seed principal:

```bash
pnpm db:seed
```

## 📋 Salida del Script

### Durante la Ejecución

```
============================================================
  🌡️  GENERADOR DE DATOS DE SENSORES - CLIMA GUATEMALA
============================================================

🌡️  Generando datos de sensores...

📅 Periodo: 30 días
📍 Estación ID: 1
⏱️  Intervalo: 15 minutos
✓ Estación encontrada: Estación Central (EST-01)

🌧️  6 eventos de lluvia generados

📊 Generando 2880 lecturas por sensor...
   Total de datos: 14400 registros

[████████████████████] 100%

💾 Insertando datos en base de datos...
[████████████████████] 100%

✅ 14400 registros insertados exitosamente

📈 Estadísticas de datos generados:
   • Periodo: 2025-10-06 a 2025-11-05
   • Lecturas por sensor: 2880
   • Total de registros: 14400
   • Eventos de lluvia: 6

============================================================
✨ ¡Proceso completado exitosamente!
============================================================
```

## 🧪 Pruebas

### Prueba Rápida

Genera datos de 1 día para verificar que funciona:

```bash
pnpm seed:sensors --days=1 --clean
```

### Verificar Datos

```bash
# Usando Prisma Studio
pnpm prisma:studio
# Navega a la tabla "mediciones"

# O consultar directamente
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.medicion.count({ where: { estacionId: 1 } })
  .then(count => console.log('Total registros:', count))
  .finally(() => prisma.\$disconnect());
"
```

### Visualizar Datos

```sql
-- Ver últimas 10 lecturas de temperatura
SELECT m.instante, m.valor, t.nombre_publico, t.unidad
FROM opws.mediciones m
JOIN opws.tipos_medicion t ON m.tipo_id = t.id
WHERE m.estacion_id = 1 AND t.clave = 'air_temp_c'
ORDER BY m.instante DESC
LIMIT 10;

-- Ver eventos de lluvia
SELECT m.instante, m.valor
FROM opws.mediciones m
JOIN opws.tipos_medicion t ON m.tipo_id = t.id
WHERE m.estacion_id = 1
  AND t.clave = 'rainfall_mm'
  AND m.valor > 0
ORDER BY m.instante;

-- Estadísticas por tipo
SELECT
  t.nombre_publico,
  COUNT(*) as total,
  ROUND(AVG(m.valor)::numeric, 2) as promedio,
  ROUND(MIN(m.valor)::numeric, 2) as minimo,
  ROUND(MAX(m.valor)::numeric, 2) as maximo
FROM opws.mediciones m
JOIN opws.tipos_medicion t ON m.tipo_id = t.id
WHERE m.estacion_id = 1
GROUP BY t.nombre_publico, t.unidad
ORDER BY t.nombre_publico;
```

## ⚠️ Notas Importantes

1. **Opción `--clean`**: Elimina TODOS los datos previos de la estación especificada. Úsala con precaución en producción.

2. **Rendimiento**: Para grandes volúmenes de datos (>60 días con intervalos pequeños), la inserción puede tomar varios minutos.

3. **Zona Horaria**: Los timestamps se generan en UTC. Asegúrate de ajustar según la zona horaria de Guatemala (America/Guatemala) en tu aplicación.

4. **Datos Únicos**: El script usa `skipDuplicates: true` al insertar. Si ejecutas el script dos veces sin `--clean`, ignorará registros duplicados.

## 🐛 Troubleshooting

### Error: "No se encontró la estación"

```bash
# Verificar estaciones disponibles
pnpm prisma:studio
# O crear la estación primero
pnpm db:seed
```

### Error: "Faltan tipos de medición"

```bash
# Ejecutar el seed principal para crear tipos
pnpm db:seed
```

### Script muy lento

- Reduce el número de días: `--days=7`
- Aumenta el intervalo: `--interval=30`
- Verifica la conexión a la base de datos

## 📚 Algoritmos

### Temperatura del Aire

```typescript
temp = 26 + 6 * sin((hora - 4) / 12 * π)
- 2-4°C si llueve
+ ruido aleatorio (-0.75 a +0.75°C)
limitado a rango 20-32°C
```

### Humedad Relativa

```typescript
hum = 65 + (32 - temp) / 12 * 20 - 10 * sin((hora - 4) / 12 * π)
= 85-95% si llueve
+ ruido aleatorio (-1.5 a +1.5%)
limitado a rango 60-95%
```

### Humedad del Suelo

```typescript
hum_suelo = hum_anterior - 0.5% por hora
+ precipitación * 2.5 (absorción)
- 0.15% extra en horas 10-16 (evaporación)
+ ruido aleatorio
limitado a rango 40-80%
```

### Luminosidad

```typescript
lux = 100,000 * sin((hora - 6) / 12 * π)  // día 06:00-18:00
* 0.2-0.5 si llueve (nubes)
* 0.7-1.0 variación normal
= 0-5 lux de noche
```

### Precipitación

```typescript
probabilidad_lluvia_por_día = 18%
hora_inicio = 14:00 - 18:00
duración = 30-120 minutos
intensidad = 0.5-15 mm/hora
lluvia_15min = intensidad / 4 * (0.8-1.2) // variación ±20%
```

## 📝 Licencia

Este script es parte del proyecto OPWS.
