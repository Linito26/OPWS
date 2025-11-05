# Instalación y Configuración del Script de Seed

## Primer Uso

Si es la primera vez que ejecutas el script, sigue estos pasos:

### 1. Asegurar Dependencias

```bash
cd backend
pnpm install
```

### 2. Verificar que tsx tiene permisos de ejecución

Si obtienes un error de "Permission denied" al ejecutar tsx:

```bash
chmod +x node_modules/.bin/tsx
```

### 3. Verificar que existen las tablas necesarias

Asegúrate de que las migraciones de Prisma están aplicadas:

```bash
pnpm prisma:migrate
```

### 4. Ejecutar el seed principal primero

El seed principal crea las estaciones y tipos de medición necesarios:

```bash
pnpm db:seed
```

Esto creará:
- 3 estaciones (EST-01, EST-02, EST-03)
- Tipos de medición (air_temp_c, air_humidity_pct, soil_moisture_pct, luminosity_lx, rainfall_mm)
- 2 usuarios demo (admin@opws.test, viewer@opws.test)
- Datos de ejemplo para 7 días

### 5. Ejecutar el script de datos realistas

Una vez que el seed principal ha creado las estructuras básicas:

```bash
# Prueba rápida con 1 día
pnpm seed:sensors --days=1 --station=1 --clean

# Generación completa de 30 días
pnpm seed:sensors --days=30 --station=1 --clean
```

## Solución de Problemas

### Error: "tsx: Permission denied"

```bash
chmod +x node_modules/.bin/tsx
```

### Error: "Cannot find module 'tsx'"

Reinstalar dependencias:

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Error: "No se encontró la estación con ID X"

Ejecutar primero el seed principal:

```bash
pnpm db:seed
```

O crear la estación manualmente en Prisma Studio:

```bash
pnpm prisma:studio
```

### Error: "Faltan tipos de medición"

Ejecutar el seed principal que crea los tipos:

```bash
pnpm db:seed
```

### Error: "Cannot connect to database"

Verificar que la base de datos está corriendo y que la variable `DATABASE_URL` en `.env` es correcta:

```bash
# Ver el archivo .env
cat .env

# Ejemplo de DATABASE_URL para PostgreSQL local:
# DATABASE_URL="postgresql://usuario:password@localhost:5432/opws?schema=opws"
```

### El script es muy lento

Considera reducir el volumen de datos:

```bash
# Solo 7 días
pnpm seed:sensors --days=7 --station=1

# Intervalo más amplio (cada 30 minutos en vez de 15)
pnpm seed:sensors --days=30 --interval=30 --station=1
```

## Verificación Post-Ejecución

### Ver datos insertados con Prisma Studio

```bash
pnpm prisma:studio
```

Navega a la tabla `mediciones` para ver los datos generados.

### Consultar desde la terminal

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const count = await prisma.medicion.count({ where: { estacionId: 1 } });
  console.log('Total registros estación 1:', count);

  const tipos = await prisma.tipoMedicion.findMany();
  for (const tipo of tipos) {
    const tipoCount = await prisma.medicion.count({
      where: { estacionId: 1, tipoId: tipo.id }
    });
    console.log(\`  - \${tipo.nombrePublico}: \${tipoCount} registros\`);
  }

  await prisma.\$disconnect();
})();
"
```

### Consultar estadísticas en PostgreSQL

```sql
-- Conectarse a la base de datos
psql -U usuario -d opws

-- Ver estadísticas
SELECT
  t.nombre_publico,
  t.unidad,
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

## Flujo Recomendado para Desarrollo

### 1. Setup Inicial (una sola vez)

```bash
# Instalar dependencias
pnpm install

# Aplicar migraciones
pnpm prisma:migrate

# Seed inicial (estaciones, tipos, usuarios)
pnpm db:seed
```

### 2. Desarrollo Diario

```bash
# Limpiar y regenerar datos de prueba
pnpm seed:sensors --days=7 --station=1 --clean

# Iniciar servidor de desarrollo
pnpm dev
```

### 3. Testing con Diferentes Escenarios

```bash
# Escenario 1: Semana reciente
pnpm seed:sensors --days=7 --station=1 --clean

# Escenario 2: Mes completo
pnpm seed:sensors --days=30 --station=1 --clean

# Escenario 3: Múltiples estaciones
pnpm seed:sensors --days=30 --station=1 --clean
pnpm seed:sensors --days=30 --station=2
pnpm seed:sensors --days=30 --station=3

# Escenario 4: Alta frecuencia (cada 5 minutos)
pnpm seed:sensors --days=7 --interval=5 --station=1 --clean
```

## Variables de Entorno

Asegúrate de tener configurado tu archivo `.env`:

```env
DATABASE_URL="postgresql://usuario:password@localhost:5432/opws?schema=opws"
```

## Estructura del Proyecto

```
backend/
├── prisma/
│   ├── schema.prisma          # Esquema de base de datos
│   ├── seed.ts                # Seed principal (estaciones, tipos, usuarios)
│   └── migrations/            # Migraciones de base de datos
├── scripts/
│   ├── seed-sensor-data.ts    # Script de datos realistas (NUEVO)
│   ├── README.md              # Documentación del script
│   └── INSTALLATION.md        # Este archivo
├── src/
│   └── ...                    # Código fuente de la API
├── package.json
└── .env
```

## Comandos Disponibles

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Iniciar servidor de desarrollo |
| `pnpm build` | Compilar TypeScript |
| `pnpm start` | Ejecutar servidor compilado |
| `pnpm prisma:generate` | Generar cliente de Prisma |
| `pnpm prisma:migrate` | Aplicar migraciones |
| `pnpm prisma:studio` | Abrir interfaz visual de BD |
| `pnpm db:seed` | Seed principal (estaciones, tipos, usuarios) |
| `pnpm seed:sensors` | Seed de datos realistas de sensores (NUEVO) |

## Contacto y Soporte

Si encuentras problemas, verifica:
1. Que la base de datos está corriendo
2. Que las migraciones están aplicadas
3. Que el seed principal se ejecutó correctamente
4. Que las variables de entorno están configuradas

Para más información, consulta el README.md en esta carpeta.
