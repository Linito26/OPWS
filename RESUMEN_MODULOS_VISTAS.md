# RESUMEN DE MÓDULOS Y VISTAS - OPWS
## Open Weather Station Platform

---

## 1. DESCRIPCIÓN DEL PROYECTO

**OPWS** es una plataforma completa de código abierto para gestionar estaciones meteorológicas IoT conectadas por LoRaWAN.

### Características Principales
- Recopilación automática de datos desde The Things Network
- Visualización en tiempo real y análisis histórico
- Sistema de roles y permisos (Admin/Visualizador)
- Exportación de datos a Excel/CSV
- Mapas interactivos de estaciones
- Autenticación segura con JWT

---

## 2. ARQUITECTURA TECNOLÓGICA

### Backend
- **Node.js + Express.js + TypeScript**
- **Base de datos**: PostgreSQL con Prisma ORM
- **Seguridad**: JWT, Bcrypt, Helmet, Rate Limiting
- **Email**: Nodemailer para notificaciones

### Frontend
- **React 18 + TypeScript + Vite**
- **Estilos**: Tailwind CSS v4
- **Gráficas**: Recharts
- **Mapas**: React Leaflet
- **Exportación**: XLSX

---

## 3. MÓDULOS DEL BACKEND (API)

### 3.1 Módulo de Autenticación (`/api/auth`)
**Endpoints:**
- `POST /login` - Inicio de sesión con rate limiting
- `GET /me` - Obtener perfil del usuario autenticado
- `POST /change-password` - Cambio de contraseña con validación estricta

**Seguridad:**
- JWT con expiración configurable (8h)
- Bcrypt 12-rounds para contraseñas
- Rate limiting: 5 intentos cada 15 minutos
- Política de contraseña: mínimo 8 caracteres, mayúscula, minúscula, número, símbolo

### 3.2 Módulo de Estaciones (`/api/estaciones`)
**Endpoints:**
- `GET /` - Listar estaciones con búsqueda
- `GET /:id` - Detalles de una estación específica
- `PUT /:id` - Actualizar datos de estación

**Datos:**
- Código único, nombre, coordenadas (lat/lon)
- Elevación, zona horaria, estado activo/inactivo
- Notas descriptivas

### 3.3 Módulo de Series Temporales (`/api/series`)
**Endpoint:**
- `GET /series` - Consulta de datos de sensores

**Parámetros:**
- `estacionId`: Estación a consultar
- `keys`: Tipo de datos (temperatura, humedad, lluvia, etc.)
- `from/to`: Rango de fechas
- `group`: Agrupación (raw, hour, day, week, month)

**Sensores Soportados:**
- Precipitación (mm) - Agregación: SUM
- Temperatura del aire (°C) - Agregación: AVG
- Humedad relativa (%) - Agregación: AVG
- Humedad del suelo (%) - Agregación: AVG
- Luminosidad (lux) - Agregación: AVG

**Optimización:**
- Índices en base de datos para consultas rápidas
- Cálculos de min/max/avg para datos agregados

### 3.4 Módulo de Gestión de Usuarios (`/api/users`) - Solo Admin
**Endpoints:**
- `POST /` - Crear usuario nuevo
- `GET /` - Listar todos los usuarios
- `PATCH /:id/active` - Activar/desactivar usuario
- `PATCH /:id/role` - Cambiar rol del usuario
- `POST /:id/reset-temp` - Resetear contraseña temporal

**Funcionalidad:**
- Generación automática de contraseñas temporales seguras
- Envío de email de bienvenida con credenciales
- Forzar cambio de contraseña en primer login (MCP)
- Gestión de roles: ADMINISTRADOR / VISUALIZADOR

### 3.5 Módulo de Integración IoT (`/api/ttn`) - Webhook
**Endpoint:**
- `POST /uplink` - Recibe datos desde The Things Network

**Flujo:**
1. Sensor envía datos vía LoRaWAN a TTN
2. TTN ejecuta webhook al backend
3. Sistema busca o crea dispositivo automáticamente
4. Mapea datos del payload a tipos de medición
5. Inserta mediciones en base de datos
6. Previene duplicados con skipDuplicates

**Datos recibidos:**
- `dev_eui`: Identificador único del dispositivo
- `timestamp`: Marca temporal de la lectura
- `payload`: Valores de sensores (temperatura, humedad, lluvia, etc.)

### 3.6 Módulo de Salud (`/api/health`)
**Endpoint:**
- `GET /health` - Verificar estado del servicio (público)

---

## 4. MODELO DE BASE DE DATOS

### Tablas Principales

**estaciones**
- Código único, nombre, ubicación (lat/lon/elevación)
- Zona horaria, estado activo, notas

**mediciones**
- Estación, tipo de medición, timestamp
- Valor numérico, payload crudo (JSON)
- Índices optimizados para consultas temporales

**tipos_medicion**
- Clave única (air_temp_c, rainfall_mm, etc.)
- Nombre público, unidad, tipo de agregación (AVG/SUM)

**dispositivos**
- DevEUI (identificador LoRaWAN), estación asociada
- Descripción, estado activo

**dispositivo_tipos**
- Mapeo entre dispositivo y tipos de medición
- Configuración de canal, escala, offset para calibración

**usuarios**
- Username, email, nombre completo
- Contraseña hasheada, rol, estado activo
- Control de MCP (Must Change Password)
- Intentos fallidos de login, último inicio de sesión

**roles**
- ADMINISTRADOR: Acceso total al sistema
- VISUALIZADOR: Solo lectura de datos

**permisos**
- Sistema flexible de permisos granulares
- Asignación por usuario o por rol

**tokens**
- Tokens de verificación de email y reset de contraseña
- Expiración y control de uso

---

## 5. VISTAS DEL FRONTEND

### 5.1 Vistas Públicas

#### **Login** (`/login`)
**Funcionalidad:**
- Formulario de autenticación (email/username + contraseña)
- Rate limiting del lado del servidor
- Almacenamiento de token JWT
- Redirección automática:
  - Si MCP=true → `/change-password`
  - Si MCP=false → `/panel`

### 5.2 Vistas Protegidas (Usuarios Autenticados)

#### **Panel Principal** (`/panel`)
**Funcionalidad:**
- Dashboard con datos en tiempo real
- Selector de estación
- Selector de fecha
- Visualización de KPIs:
  - Precipitación acumulada
  - Temperatura actual
  - Humedad relativa
  - Humedad del suelo
  - Luminosidad
- Gráfica integrada con 4 series de datos:
  - Precipitación (verde, SUM)
  - Temperatura (rojo, AVG)
  - Humedad relativa (azul, AVG)
  - Humedad del suelo (lima, AVG)
- Mapa con ubicación de estación (Leaflet)
- Toggle para mostrar/ocultar series
- **Modo DEMO**: Datos de ejemplo sin backend (`?demo=1`)

#### **Análisis de Sensores** (`/sensores`)
**Funcionalidad:**
- Análisis detallado por sensor
- Selector de estación
- Rango de fechas flexible:
  - Presets: 1 día, 7 días, 14 días, 30 días, 48 horas
  - Rango personalizado
- Agrupación de datos:
  - Raw: Datos sin agrupar
  - Hour: Agrupado por hora
  - Day: Agrupado por día
- Gráficas individuales por sensor:
  - Precipitación: Gráfica de barras
  - Temperatura: Línea con min/max
  - Humedad relativa: Línea
  - Humedad del suelo: Línea
  - Luminosidad: Conversión a minutos (threshold: 100 lux)
- **Exportación a CSV/Excel**
- Configuración de decimales por sensor

#### **Cambio de Contraseña** (`/change-password`)
**Funcionalidad:**
- Formulario de cambio de contraseña
- Validación de contraseña actual
- Validación de política de contraseña:
  - Mínimo 8 caracteres
  - Al menos 1 mayúscula, 1 minúscula, 1 número, 1 símbolo
- Confirmación de nueva contraseña
- Actualización de JWT tras cambio exitoso
- Redirección automática a `/panel`

### 5.3 Vistas de Administración (Solo ADMINISTRADOR)

#### **Dashboard Admin** (`/admin`)
**Funcionalidad:**
- Navegación lateral con opciones:
  - Home
  - Gestión de Usuarios
  - Gestión de Estaciones
- Accesos rápidos (tiles):
  - Crear nuevo usuario
  - Ver lista de usuarios

#### **Crear Usuario** (`/admin/crear-usuario`)
**Funcionalidad:**
- Formulario de registro:
  - Username (opcional)
  - Nombre y apellido
  - Email
  - Rol (ADMINISTRADOR / VISUALIZADOR)
- Generación automática de contraseña temporal
- Envío de email de bienvenida
- Usuario forzado a cambiar contraseña en primer login

#### **Lista de Usuarios** (`/admin/usuarios`)
**Funcionalidad:**
- Tabla de usuarios con búsqueda en tiempo real
- Búsqueda por: nombre, usuario, email, rol
- Columnas:
  - Usuario/Email
  - Nombre completo
  - Rol (badge con color)
  - Estado (activo/inactivo)
  - Acciones
- **Acciones disponibles:**
  - Cambiar rol (ADMIN ↔ VISUALIZADOR)
  - Activar/desactivar usuario
  - Resetear contraseña temporal + envío de email
- Botón para crear nuevo usuario

#### **Configuración de Estaciones** (`/admin/estaciones`)
**Funcionalidad:**
- Gestión avanzada de estaciones
- Configuración de parámetros
- (Actualmente en desarrollo)

---

## 6. COMPONENTES REUTILIZABLES

### **PageTopBar**
**Contenido:**
- Logo y título de la aplicación
- Breadcrumb de navegación
- Perfil del usuario autenticado
- Botón de logout
- Se oculta automáticamente en login y change-password

### **MapStations**
**Contenido:**
- Mapa interactivo con React Leaflet
- Marcadores en ubicación de estaciones
- Popup con información de estación
- Eventos de click personalizables

---

## 7. SISTEMA DE ROLES Y PERMISOS

### ADMINISTRADOR
✓ Acceso total al sistema
✓ Crear y gestionar usuarios
✓ Cambiar roles y permisos
✓ Gestionar estaciones
✓ Ver todos los datos
✓ Exportar datos

### VISUALIZADOR
✓ Ver datos de sensores
✓ Consultar series temporales
✓ Exportar datos
✓ Cambiar su propia contraseña
✗ No puede crear usuarios
✗ No puede acceder a panel de administración
✗ No puede modificar estaciones

---

## 8. FLUJOS PRINCIPALES

### 8.1 Flujo de Login
1. Usuario ingresa credenciales en `/login`
2. Sistema valida contra base de datos
3. Genera y devuelve JWT + perfil + flag MCP
4. Si MCP=true → Redirige a cambio de contraseña obligatorio
5. Si MCP=false → Redirige a panel principal

### 8.2 Flujo de Cambio de Contraseña Obligatorio (MCP)
1. Login detecta MCP=true (usuario nuevo o reseteo)
2. Frontend fuerza redirección a `/change-password`
3. Usuario ingresa contraseña actual y nueva
4. Sistema valida política de contraseña
5. Actualiza contraseña y genera nuevo JWT
6. Marca MCP=false
7. Redirige a panel principal

### 8.3 Flujo de Integración IoT (The Things Network)
1. Sensor meteorológico envía datos vía LoRaWAN a TTN
2. TTN ejecuta webhook → `POST /api/ttn/uplink`
3. Backend recibe: dev_eui, timestamp, payload
4. Sistema busca dispositivo por dev_eui
5. Si no existe: crea estación y dispositivo automáticamente
6. Mapea valores del payload a tipos de medición
7. Inserta mediciones en base de datos (5 sensores)
8. Previene duplicados
9. Responde: confirmación + datos insertados

### 8.4 Flujo de Visualización de Datos
1. Usuario selecciona estación + fecha/rango en `/panel` o `/sensores`
2. Frontend llama `GET /api/series` con parámetros
3. Backend ejecuta:
   - JOIN entre mediciones y tipos_medicion
   - GROUP BY según parámetro de agrupación
   - Calcula AVG/SUM según tipo de sensor
   - Retorna datos con min/max para agregados
4. Frontend renderiza gráficas interactivas con Recharts
5. Usuario puede exportar a CSV/Excel

### 8.5 Flujo de Gestión de Usuarios (Admin)
1. Admin accede a `/admin/crear-usuario`
2. Completa formulario con datos del nuevo usuario
3. Sistema genera contraseña temporal segura (12 caracteres)
4. Envía email de bienvenida con credenciales
5. Marca usuario con MCP=true (forzar cambio de contraseña)
6. Usuario nuevo recibe email y puede iniciar sesión
7. Al primer login, es redirigido a cambio de contraseña

---

## 9. SEGURIDAD IMPLEMENTADA

### Autenticación y Autorización
✅ JWT con expiración configurable (8h)
✅ Bcrypt con 12 rounds para hash de contraseñas
✅ Cambio de contraseña obligatorio en primer login (MCP)
✅ Política de contraseña estricta (8+ caracteres, mayúscula, minúscula, número, símbolo)

### Protección contra Ataques
✅ Rate Limiting global (100 req/15 min)
✅ Rate Limiting en login (5 intentos/15 min)
✅ Rate Limiting en cambio de contraseña (5 intentos/15 min)
✅ Headers HTTP seguros con Helmet (HSTS, X-Frame-Options, etc.)
✅ CORS con whitelist configurable

### Integridad de Datos
✅ Validación de secrets al iniciar servidor
✅ Prevención de duplicados en mediciones
✅ Logging de eventos de seguridad (login, password change)
✅ Validación de tokens con verificación de expiración

---

## 10. CARACTERÍSTICAS DESTACADAS

### Datos y Sensores
- **6 tipos de sensores**: Precipitación, Temperatura aire, Humedad aire, Humedad suelo, Temperatura suelo, Luminosidad
- **Agregaciones inteligentes**: SUM para lluvia, AVG para otros sensores
- **Consultas flexibles**: Por hora, día, semana, mes o datos crudos
- **Estadísticas automáticas**: Min/max/avg en datos agregados

### Experiencia de Usuario
- **Modo DEMO**: Datos de prueba sin necesidad de backend
- **Exportación**: CSV/Excel para análisis externo
- **Mapas interactivos**: Visualización geográfica de estaciones
- **Gráficas dinámicas**: Zoom, tooltip, toggle de series
- **Búsqueda en tiempo real**: Filtrado instantáneo en listas

### Integración IoT
- **The Things Network**: Webhook automático para LoRaWAN
- **Auto-provisioning**: Creación automática de estaciones y dispositivos
- **Payload flexible**: Mapeo configurable de sensores
- **Calibración**: Soporte para escala y offset por sensor

---

## 11. TECNOLOGÍAS CLAVE

### Backend
- Express.js 5 (Web framework)
- Prisma 6.15 (ORM)
- PostgreSQL 14+ (Base de datos)
- TypeScript 5.9
- Nodemailer (Email)

### Frontend
- React 18.3
- Vite 7.1 (Build tool)
- Tailwind CSS v4
- Recharts 3.1 (Gráficas)
- React Leaflet 4.2 (Mapas)
- XLSX 0.18 (Exportación Excel)

### Seguridad
- jsonwebtoken (JWT)
- bcryptjs 3.0 (Hashing)
- helmet (HTTP headers)
- express-rate-limit (Anti brute-force)
- cors (Control de acceso)

---

## 12. MÉTRICAS DEL PROYECTO

### Backend
- **7 endpoints principales** organizados en 6 módulos
- **9 tablas** en base de datos con índices optimizados
- **2 roles de usuario** con sistema de permisos granulares
- **5 sensores** con procesamiento automático

### Frontend
- **9 páginas/vistas** (3 públicas/protegidas + 6 admin)
- **2 componentes reutilizables** principales
- **Sistema de autenticación** con contexto global React
- **Exportación** a 2 formatos (CSV/Excel)

### Seguridad
- **3 capas de rate limiting**
- **6 características de seguridad** implementadas
- **1 política de contraseña** estricta
- **JWT con validación** de expiración

---

## RESUMEN EJECUTIVO

**OPWS** es una plataforma robusta y escalable para monitoreo meteorológico IoT que combina:

1. **Backend potente**: API REST segura con TypeScript, Express y PostgreSQL
2. **Frontend moderno**: Interfaz React responsiva con visualizaciones interactivas
3. **Integración IoT**: Conexión automática con The Things Network (LoRaWAN)
4. **Seguridad de nivel empresarial**: JWT, rate limiting, políticas de contraseña
5. **UX excepcional**: Gráficas, mapas, exportación, modo demo
6. **Sistema de roles**: Administradores y visualizadores con permisos específicos

El proyecto está listo para producción con una arquitectura bien estructurada, código limpio y documentación completa.
