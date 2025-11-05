# 🌦️ OPWS - Open Weather Station Platform

**OPWS** (Open Weather Station) es una plataforma completa de código abierto para la gestión y visualización de datos de estaciones meteorológicas IoT.

## 📋 Descripción

OPWS proporciona una solución integral para:
- 📊 **Recopilación de datos** de sensores meteorológicos vía The Things Network (LoRaWAN)
- 📈 **Visualización** de datos en tiempo real y históricos
- 🔐 **Gestión de usuarios** con roles y permisos
- 📤 **Exportación** de datos en formatos Excel y CSV
- 🗺️ **Mapas interactivos** de estaciones meteorológicas

## 🏗️ Arquitectura del Proyecto

\`\`\`
OPWS/
├── backend/          # API REST con Express.js
│   ├── src/
│   │   ├── routes/      # Endpoints del API
│   │   ├── middlewares/ # Auth, validación, etc.
│   │   ├── config/      # Configuración y seguridad
│   │   └── lib/         # Utilidades y DB
│   ├── prisma/          # Esquema y migraciones de base de datos
│   └── package.json
│
├── opws-web/        # Frontend con React + Vite
│   ├── src/
│   │   ├── pages/      # Páginas de la aplicación
│   │   ├── components/ # Componentes reutilizables
│   │   ├── auth/       # Contexto y lógica de autenticación
│   │   └── services/   # Servicios API
│   └── package.json
│
├── docs/            # Documentación del proyecto
│   ├── SECURITY.md       # Guía de seguridad
│   ├── AUDIT_REPORT.md   # Informe de auditoría
│   └── TTN_INTEGRATION.md # Integración con TTN
│
└── scripts/         # Scripts útiles de automatización
\`\`\`

## 🚀 Tecnologías Utilizadas

### Backend
- **Node.js** (>=20.19) - Runtime de JavaScript
- **Express.js** v5 - Framework web
- **Prisma** - ORM para PostgreSQL
- **PostgreSQL** - Base de datos
- **TypeScript** - Tipado estático
- **JWT** - Autenticación
- **Helmet** + **express-rate-limit** - Seguridad

### Frontend
- **React** 18 - Librería UI
- **Vite** - Build tool y dev server
- **TypeScript** - Tipado estático
- **Tailwind CSS** v4 - Estilos
- **Recharts** - Gráficas de datos
- **React Leaflet** - Mapas interactivos
- **XLSX** - Exportación de datos

## 📦 Instalación y Configuración

### Requisitos Previos

- Node.js >= 20.19 o >= 22.12
- PostgreSQL >= 14
- pnpm >= 9.7.1 (recomendado) o npm

### 1. Clonar el Repositorio

\`\`\`bash
git clone https://github.com/Linito26/OPWS.git
cd OPWS
\`\`\`

### 2. Configurar Backend

\`\`\`bash
cd backend

# Instalar dependencias
pnpm install  # o npm install

# Configurar variables de entorno
cp .env.example .env
# Edita .env y configura:
# - DATABASE_URL
# - JWT_SECRET (mínimo 32 caracteres)
# - FRONTEND_URL

# Generar cliente Prisma
pnpm prisma:generate

# Ejecutar migraciones
pnpm prisma:migrate

# (Opcional) Seed de datos iniciales
pnpm db:seed

# Iniciar servidor de desarrollo
pnpm dev
\`\`\`

El backend estará corriendo en \`http://localhost:2002\`

### 3. Configurar Frontend

\`\`\`bash
cd ../opws-web

# Instalar dependencias
pnpm install  # o npm install

# Configurar variables de entorno (opcional)
# Crea un archivo .env.local si necesitas variables personalizadas
echo "VITE_API_URL=http://localhost:2002/api" > .env.local

# Iniciar servidor de desarrollo
pnpm dev
\`\`\`

El frontend estará corriendo en \`http://localhost:5173\`

## 🔐 Seguridad

OPWS implementa múltiples capas de seguridad:

- ✅ **Headers HTTP seguros** (Helmet)
- ✅ **Rate limiting** (anti brute-force)
- ✅ **CORS** configurado con whitelist
- ✅ **JWT** para autenticación
- ✅ **Bcrypt** para hashing de contraseñas (12 rounds)
- ✅ **Validación de secrets** al inicio
- ✅ **Logging de eventos** de seguridad

Ver [docs/SECURITY.md](./docs/SECURITY.md) para más detalles.

## 📊 Sensores Soportados

| Sensor | Descripción | Unidad |
|--------|-------------|--------|
| Precipitación | Lluvia acumulada | mm |
| Temperatura del Aire | Temperatura ambiente | °C |
| Humedad Relativa | Humedad del aire | % |
| Humedad del Suelo | Humedad en el suelo | % |
| Temperatura del Suelo | Temperatura del suelo | °C |
| Luminosidad | Luz solar (convertida a minutos) | min |

## 👥 Roles y Permisos

1. **ADMINISTRADOR** - Acceso completo al sistema
2. **VISUALIZADOR** - Solo lectura de datos  
3. **Usuario básico** - Acceso limitado

## 🤝 Contribuir

Las contribuciones son bienvenidas!

---

**Hecho con ❤️ para la comunidad open source**
