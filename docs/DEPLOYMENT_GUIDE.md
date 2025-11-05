# 🚀 Guía de Deployment y Depuración - OPWS

Esta guía te ayudará a:
1. Bajar y aplicar los cambios de la auditoría en tu laptop local
2. Ejecutar el proyecto localmente
3. Depurar cada función modificada
4. Validar que todo funciona correctamente

---

## 📥 Parte 1: Bajar y Aplicar Cambios

### Paso 1: Verificar el Estado Actual de tu Repositorio Local

Antes de bajar cambios, asegúrate de que tu trabajo local esté guardado:

```bash
# Verificar el estado de tu repositorio
git status

# Si tienes cambios sin commitear, guárdalos
git stash save "Mis cambios locales antes de pull"
```

### Paso 2: Obtener los Últimos Cambios

```bash
# Asegúrate de estar en el directorio raíz del proyecto
cd /ruta/a/OPWS

# Obtener la información más reciente del remoto
git fetch origin

# Ver qué cambios hay en la rama remota
git log HEAD..origin/claude/excel-export-per-sensor-011CUpD1NUMzDYRwU14snfrw --oneline

# Hacer pull de los cambios
git pull origin claude/excel-export-per-sensor-011CUpD1NUMzDYRwU14snfrw
```

### Paso 3: Reinstalar Dependencias

Los cambios eliminaron algunas dependencias, así que necesitas reinstalar:

#### Backend

```bash
cd backend

# Eliminar node_modules y lockfile (para empezar limpio)
rm -rf node_modules package-lock.json

# Reinstalar dependencias
npm install
# O si usas pnpm:
# pnpm install

# Generar cliente Prisma (importante después de cambios)
npm run prisma:generate
```

#### Frontend

```bash
cd ../opws-web

# Eliminar node_modules y lockfile
rm -rf node_modules package-lock.json

# Reinstalar dependencias
npm install
# O si usas pnpm:
# pnpm install
```

### Paso 4: Verificar Archivos Movidos/Eliminados

Los siguientes archivos fueron modificados. Verifica que los cambios se aplicaron:

```bash
# Verificar que AdminCrearUsuario.tsx está en la carpeta correcta
ls opws-web/src/pages/admin/AdminCrearUsuario.tsx

# Verificar que los archivos eliminados ya no existen
ls opws-web/src/App.css 2>/dev/null && echo "ERROR: App.css aún existe" || echo "✅ App.css eliminado"
ls opws-web/src/pages/Home.tsx 2>/dev/null && echo "ERROR: Home.tsx aún existe" || echo "✅ Home.tsx eliminado"

# Verificar nuevo .gitignore en backend
ls backend/.gitignore && echo "✅ .gitignore creado" || echo "ERROR: falta .gitignore"
```

---

## 💻 Parte 2: Ejecutar el Proyecto Localmente

### Configuración Inicial (Solo Primera Vez)

#### 1. Configurar Base de Datos

```bash
# Asegúrate de que PostgreSQL está corriendo
# En Linux/Mac:
sudo service postgresql status
# En Windows (si usas WSL):
sudo service postgresql start

# Crear la base de datos (si no existe)
createdb opws_db

# O desde psql:
psql -U postgres
CREATE DATABASE opws_db;
\q
```

#### 2. Configurar Variables de Entorno

```bash
cd backend

# Copiar el archivo de ejemplo
cp .env.example .env

# Editar .env con tu editor preferido
nano .env  # o vim, code, etc.
```

**Configuración mínima requerida**:

```env
NODE_ENV=development
PORT=2002
DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/opws_db
JWT_SECRET=tu-secret-super-seguro-minimo-32-caracteres-aqui
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
```

#### 3. Ejecutar Migraciones

```bash
cd backend

# Ejecutar migraciones de Prisma
npm run prisma:migrate

# Verificar que las tablas se crearon
npm run prisma:studio
# Esto abrirá una interfaz web en http://localhost:5555
```

#### 4. (Opcional) Cargar Datos de Prueba

```bash
cd backend

# Ejecutar seed
npm run db:seed

# Esto creará:
# - Roles: ADMINISTRADOR, VISUALIZADOR
# - Usuario admin por defecto (verifica el script seed.ts para credenciales)
```

### Iniciar el Proyecto

#### Terminal 1: Backend

```bash
cd backend

# Modo desarrollo (con hot-reload)
npm run dev

# El servidor debería mostrar:
# ✅ Validación de secrets completada
# OPWS API en http://localhost:2002
```

#### Terminal 2: Frontend

```bash
cd opws-web

# Modo desarrollo (con hot-reload)
npm run dev

# Vite debería mostrar:
# ➜  Local:   http://localhost:5173/
# ➜  Network: use --host to expose
```

#### Verificar que Todo Funciona

Abre tu navegador en `http://localhost:5173` y verifica:

1. ✅ La página de login carga correctamente
2. ✅ No hay errores en la consola del navegador
3. ✅ El backend responde en `http://localhost:2002/health`

```bash
# Probar health endpoint
curl http://localhost:2002/health
# Debería retornar: {"ok":true,"service":"OPWS API"}
```

---

## 🐛 Parte 3: Depuración de Funciones Modificadas

### 1. Depurar Exportación Individual de Sensores

**Archivo modificado**: `opws-web/src/pages/Sensores.tsx`

#### Herramientas Necesarias:
- **Chrome DevTools** o **Firefox DevTools**

#### Pasos de Depuración:

```bash
# 1. Abre la aplicación y navega a /sensores
# URL: http://localhost:5173/sensores

# 2. Abre DevTools (F12)
# 3. Ve a la pestaña "Sources" (Chrome) o "Debugger" (Firefox)
# 4. Busca el archivo: Sensores.tsx
```

**Puntos de Breakpoint Recomendados**:

- Línea ~200: Función `exportSingleSensor`
- Línea ~206: Validación de datos
- Línea ~224: Creación de filas Excel
- Línea ~237: Generación del nombre de archivo

**Pruebas a Realizar**:

1. **Test 1: Exportar sensor con datos**
   - Selecciona un rango de fechas que tenga datos
   - Click en "Exportar Excel" de cualquier sensor
   - ✅ Debe descargar un archivo `.xlsx`
   - ✅ El nombre debe seguir el patrón: `OPWS_[Sensor]_[fecha1]_[fecha2].xlsx`

2. **Test 2: Exportar sensor sin datos**
   - Selecciona un rango sin datos
   - Click en "Exportar Excel"
   - ✅ Debe mostrar alert "No hay datos para exportar"

3. **Test 3: Badge de registros**
   - ✅ Cada gráfica debe mostrar "N registros"
   - ✅ El número debe coincidir con los puntos en la gráfica

**Verificar en Consola**:

```javascript
// En la consola del navegador, puedes inspeccionar:
// 1. El estado transformado
console.log(this.transformed);

// 2. Los datos del sensor
console.log(this.transformed['rainfall_mm']);
```

### 2. Depurar Seguridad del Backend

**Archivos modificados**:
- `backend/src/config/security.ts`
- `backend/src/routes/auth.routes.ts`
- `backend/src/index.ts`

#### Herramientas Necesarias:
- **Terminal** (para ver logs)
- **Postman** o **curl** (para hacer requests)
- **VS Code Debugger** (opcional)

#### Test 1: Validación de Secrets

```bash
# Detener el backend (Ctrl+C)

# Probar con JWT_SECRET inválido (muy corto)
cd backend
echo "JWT_SECRET=corto" > .env.temp

# Iniciar el backend
JWT_SECRET=corto npm run dev

# ❌ Debería fallar con:
# ❌ ERROR: Variables de entorno críticas faltantes o inválidas:
#    - JWT_SECRET debe tener al menos 32 caracteres (actual: 5)

# Restaurar .env correcto
rm .env.temp
```

#### Test 2: Rate Limiting de Login

```bash
# En una terminal, hacer múltiples intentos de login

# Intento 1-5 (deberían pasar)
for i in {1..5}; do
  curl -X POST http://localhost:2002/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"identifier":"test@test.com","password":"wrong"}' \
    -w "\nStatus: %{http_code}\n\n"
  sleep 1
done

# Intento 6 (debería ser bloqueado con 429)
curl -X POST http://localhost:2002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test@test.com","password":"wrong"}'

# ✅ Debe retornar 429 Too Many Requests
# ✅ En los logs del backend debe aparecer:
# [RATE LIMIT] IP bloqueada temporalmente: ::1 - Ruta: /api/auth/login
```

#### Test 3: Logging de Seguridad

```bash
# Observar los logs del backend mientras pruebas login

# Login fallido (contraseña incorrecta)
curl -X POST http://localhost:2002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin@opws.com","password":"wrong_password"}'

# ✅ En los logs debe aparecer algo como:
# [SECURITY] [2025-11-05T...] Login fallido - Identifier: admin@opws.com - IP: ::1 - Razón: Contraseña incorrecta

# Login exitoso (con credenciales correctas)
curl -X POST http://localhost:2002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin@opws.com","password":"admin123!"}'

# ✅ Debe aparecer:
# [SECURITY] [2025-11-05T...] Login exitoso - Identifier: admin@opws.com - IP: ::1 - UserID: 1
```

#### Test 4: Headers de Seguridad (Helmet)

```bash
# Verificar que los headers de seguridad están configurados
curl -I http://localhost:2002/health

# ✅ Debe incluir headers como:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### 3. Depurar Instancia Singleton de Prisma

**Archivos modificados**:
- `backend/src/routes/auth.routes.ts`
- `backend/src/routes/users.ts`
- `backend/src/routes/series.ts`

#### Verificar que No Hay Múltiples Conexiones

```bash
# Mientras el backend está corriendo, ejecuta:
cd backend

# Ver cuántas conexiones Prisma hay abiertas
# Esto se puede hacer revisando los logs de PostgreSQL

# O usando esta query en la base de datos:
psql -U postgres -d opws_db -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'opws_db';"

# ✅ Debería haber solo 1 conexión desde Prisma (más tu conexión psql)
```

#### Depurar con VS Code

1. Crear `.vscode/launch.json` en la raíz del proyecto:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/backend/src/index.ts",
      "preLaunchTask": "tsc: build - backend/tsconfig.json",
      "outFiles": ["${workspaceFolder}/backend/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

2. Poner breakpoints en:
   - `backend/src/lib/db.ts:3` (creación del singleton)
   - `backend/src/routes/auth.routes.ts:6` (import de prisma)

3. Presionar F5 para iniciar debugging

---

## ✅ Parte 4: Checklist de Validación

### Frontend

- [ ] La aplicación carga sin errores
- [ ] Login funciona correctamente
- [ ] Panel de sensores muestra gráficas
- [ ] Exportación individual funciona
- [ ] Badge de registros se muestra correctamente
- [ ] Tooltip "Exportar solo [sensor]" aparece
- [ ] Mapa de estaciones carga (si aplica)
- [ ] Admin puede crear usuarios

### Backend

- [ ] Servidor inicia correctamente
- [ ] Validación de secrets pasa
- [ ] Health endpoint responde
- [ ] Rate limiting funciona en login
- [ ] Rate limiting funciona en change-password
- [ ] Logging de seguridad aparece en consola
- [ ] Headers de seguridad están presentes
- [ ] Solo hay 1 conexión Prisma
- [ ] No hay dependencias no utilizadas

### Base de Datos

- [ ] Migraciones aplicadas correctamente
- [ ] Seed data cargado (si se ejecutó)
- [ ] Conexión funciona
- [ ] Tablas creadas correctamente

---

## 🔧 Solución de Problemas Comunes

### Error: "Cannot find module '@prisma/client'"

```bash
cd backend
npm run prisma:generate
npm install
```

### Error: "Port 2002 already in use"

```bash
# Encontrar qué proceso usa el puerto
lsof -i :2002  # Mac/Linux
netstat -ano | findstr :2002  # Windows

# Matar el proceso
kill -9 <PID>  # Mac/Linux
taskkill /PID <PID> /F  # Windows
```

### Error: "CORS policy" en el frontend

1. Verificar que `FRONTEND_URL` en `.env` del backend sea `http://localhost:5173`
2. Reiniciar el backend

### Error: "JWT_SECRET must be at least 32 characters"

```bash
# Generar un secret seguro
openssl rand -base64 48

# Copiarlo en .env
echo "JWT_SECRET=<secretGenerado>" >> backend/.env
```

### Frontend no se conecta al backend

1. Verificar que el backend está corriendo: `curl http://localhost:2002/health`
2. Verificar la configuración del API en `opws-web/src/config/api.ts`
3. Revisar la consola del navegador para ver el error exacto

---

## 📚 Recursos Adicionales

- [Documentación de Prisma](https://www.prisma.io/docs/)
- [Documentación de Express](https://expressjs.com/)
- [Documentación de React](https://react.dev/)
- [Documentación de Vite](https://vitejs.dev/)

---

## 🆘 Obtener Ayuda

Si encuentras problemas:

1. Revisa los logs del backend y frontend
2. Verifica que todas las dependencias estén instaladas
3. Asegúrate de que las variables de entorno estén configuradas
4. Consulta la documentación en `/docs`
5. Abre un issue en GitHub describiendo el problema

---

**¡Buena suerte con el deployment! 🚀**
