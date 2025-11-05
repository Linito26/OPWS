# Documentación de Seguridad - OPWS Backend

Este documento describe las medidas de seguridad implementadas en el backend de OPWS para garantizar un despliegue seguro en producción.

## 📋 Índice

1. [Dependencias de Seguridad](#dependencias-de-seguridad)
2. [Headers de Seguridad (Helmet)](#headers-de-seguridad-helmet)
3. [Rate Limiting](#rate-limiting)
4. [CORS (Cross-Origin Resource Sharing)](#cors-cross-origin-resource-sharing)
5. [Validación de Secrets](#validación-de-secrets)
6. [Logging de Seguridad](#logging-de-seguridad)
7. [Protección de Payload](#protección-de-payload)
8. [Variables de Entorno](#variables-de-entorno)
9. [Mejores Prácticas](#mejores-prácticas)
10. [Checklist de Deployment](#checklist-de-deployment)

---

## 1. Dependencias de Seguridad

El backend utiliza las siguientes dependencias para mejorar la seguridad:

### Instaladas

- **`helmet`**: Configura headers HTTP seguros
- **`express-rate-limit`**: Implementa rate limiting para prevenir ataques de fuerza bruta
- **`dotenv`**: Manejo seguro de variables de entorno
- **`cors`**: Control de acceso entre orígenes
- **`bcryptjs`**: Hash seguro de contraseñas (12 rounds)
- **`jsonwebtoken`**: Autenticación basada en JWT

### Instalación

```bash
npm install helmet express-rate-limit dotenv cors bcryptjs jsonwebtoken
npm install --save-dev @types/express-rate-limit
```

---

## 2. Headers de Seguridad (Helmet)

Helmet configura automáticamente varios headers HTTP para proteger contra vulnerabilidades comunes.

### Configuración (`src/index.ts`)

```typescript
app.use(
  helmet({
    contentSecurityPolicy: false, // Desactivado para APIs
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000, // 1 año
      includeSubDomains: true,
      preload: true,
    },
  })
);
```

### Headers Configurados

| Header | Valor | Propósito |
|--------|-------|-----------|
| `X-Content-Type-Options` | `nosniff` | Previene MIME-type sniffing |
| `X-Frame-Options` | `DENY` | Previene clickjacking |
| `X-XSS-Protection` | `1; mode=block` | Protección contra XSS |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Fuerza HTTPS |
| `X-Powered-By` | Removido | Oculta información del servidor |

---

## 3. Rate Limiting

Implementado para proteger contra ataques de fuerza bruta y abuso de API.

### 3.1 Rate Limiting Global

**Configuración**: 100 requests por 15 minutos por IP

```typescript
// src/config/security.ts
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests
  message: {
    error: "Demasiadas solicitudes desde esta IP, por favor intenta más tarde"
  }
});
```

**Aplicado a**: Todas las rutas del API

### 3.2 Rate Limiting para Login

**Configuración**: 5 intentos por 15 minutos por IP

```typescript
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true, // Solo cuenta intentos fallidos
});
```

**Aplicado a**: `POST /api/auth/login`

### 3.3 Rate Limiting para Cambio de Contraseña

**Configuración**: 3 intentos por hora por IP

```typescript
export const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3,
  skipSuccessfulRequests: true,
});
```

**Aplicado a**: `POST /api/auth/change-password`

### Personalización

Puedes personalizar los límites mediante variables de entorno:

```bash
RATE_LIMIT_WINDOW_MS=900000  # 15 minutos en ms
RATE_LIMIT_MAX=100           # Máximo de requests
```

---

## 4. CORS (Cross-Origin Resource Sharing)

### Configuración

```typescript
const ALLOWED = (
  process.env.CORS_ORIGINS ??
  process.env.FRONTEND_URL ??
  "http://localhost:5173"
)
  .split(",")
  .map((s) => s.trim());

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || ALLOWED.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  })
);
```

### Variables de Entorno

```bash
# Opción 1: URL única
FRONTEND_URL=https://opws.yourdomain.com

# Opción 2: Múltiples URLs
CORS_ORIGINS=https://opws.yourdomain.com,https://www.opws.yourdomain.com
```

### Importante

⚠️ **En producción, NUNCA uses `origin: "*"`**. Siempre especifica las URLs exactas permitidas.

---

## 5. Validación de Secrets

El backend valida variables de entorno críticas al inicio y falla rápido si hay problemas.

### Validaciones Implementadas

```typescript
// src/config/security.ts
export function validateSecrets() {
  // ✅ JWT_SECRET debe existir
  // ✅ JWT_SECRET debe tener al menos 32 caracteres
  // ✅ JWT_SECRET no puede ser el valor por defecto en producción
  // ✅ DATABASE_URL debe estar configurado
  // ✅ NODE_ENV debe estar configurado
}
```

### Ejemplo de Error

```bash
❌ ERROR: Variables de entorno críticas faltantes o inválidas:

   - JWT_SECRET debe tener al menos 32 caracteres (actual: 16)
   - DATABASE_URL no está configurado

Revisa el archivo .env.example para ver las variables requeridas.
```

### Generar un JWT_SECRET Seguro

```bash
# Opción 1: OpenSSL
openssl rand -base64 48

# Opción 2: Node.js
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

---

## 6. Logging de Seguridad

Se registran eventos de seguridad importantes sin exponer información sensible.

### Eventos Registrados

#### Login Exitoso
```
[SECURITY] [2025-01-15T10:30:00.000Z] Login exitoso - Identifier: user@example.com - IP: 192.168.1.100 - UserID: 42
```

#### Login Fallido
```
[SECURITY] [2025-01-15T10:30:00.000Z] Login fallido - Identifier: user@example.com - IP: 192.168.1.100 - Razón: Contraseña incorrecta
```

#### Cambio de Contraseña
```
[SECURITY] [2025-01-15T10:30:00.000Z] Contraseña cambiada exitosamente - UserID: 42 - IP: 192.168.1.100
```

#### Rate Limit Excedido
```
[RATE LIMIT] IP bloqueada temporalmente: 192.168.1.100 - Ruta: /api/auth/login
```

### Qué NO Se Registra

❌ **NUNCA se registra**:
- Contraseñas (ni actuales ni nuevas)
- Tokens JWT completos
- Datos sensibles de usuarios

✅ **SÍ se registra**:
- Identificadores de usuario (email, username)
- IDs de usuario
- IPs de origen
- Razones de fallo (sin detalles sensibles)
- Timestamps

---

## 7. Protección de Payload

### Límite de Tamaño

```typescript
app.use(express.json({ limit: process.env.JSON_LIMIT || "10mb" }));
```

**Por defecto**: 10MB máximo

**Personalización**:
```bash
JSON_LIMIT=5mb  # Reduce a 5MB si no necesitas archivos grandes
```

### Ventajas

- Protege contra ataques de denegación de servicio (DoS)
- Previene consumo excesivo de memoria
- Mejora el rendimiento del servidor

---

## 8. Variables de Entorno

### Variables Críticas (Requeridas)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `NODE_ENV` | Entorno de ejecución | `production` |
| `DATABASE_URL` | URL de PostgreSQL | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Secreto para JWT (min 32 chars) | `generado-con-openssl-rand-base64-48` |

### Variables Opcionales

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PORT` | Puerto del servidor | `2002` |
| `JWT_EXPIRES_IN` | Expiración de JWT | `7d` |
| `FRONTEND_URL` | URL del frontend para CORS | `http://localhost:5173` |
| `RATE_LIMIT_WINDOW_MS` | Ventana de rate limit | `900000` (15 min) |
| `RATE_LIMIT_MAX` | Max requests por ventana | `100` |
| `JSON_LIMIT` | Límite de payload JSON | `10mb` |

### Archivo .env.example

Ver `/backend/.env.example` para una plantilla completa.

---

## 9. Mejores Prácticas

### 🔐 Secrets y Credenciales

- ✅ Usa secretos fuertes (mínimo 32 caracteres)
- ✅ Genera secretos únicos para cada entorno
- ✅ Nunca comitees archivos `.env` al repositorio
- ✅ Rota secretos regularmente (cada 90 días recomendado)
- ✅ Usa gestores de secretos en producción (AWS Secrets Manager, HashiCorp Vault)

### 🌐 CORS

- ✅ Lista blanca de dominios específicos
- ❌ NUNCA uses `origin: "*"` en producción
- ✅ Separa configuraciones de desarrollo y producción

### 🔑 JWT

- ✅ Usa tiempos de expiración razonables (7-30 días)
- ✅ Implementa refresh tokens para sesiones largas
- ✅ Revoca tokens en caso de compromiso
- ✅ Usa algoritmo HS256 o superior

### 📊 Logging

- ✅ Registra eventos de seguridad
- ❌ NUNCA registres contraseñas o tokens completos
- ✅ Implementa rotación de logs
- ✅ Monitorea logs en tiempo real

### 🚦 Rate Limiting

- ✅ Ajusta límites según tu tráfico esperado
- ✅ Usa límites más estrictos para rutas sensibles (login, registro)
- ✅ Considera whitelist de IPs confiables si es necesario

### 🔄 Actualizaciones

- ✅ Mantén dependencias actualizadas
- ✅ Ejecuta `npm audit` regularmente
- ✅ Suscríbete a alertas de seguridad

```bash
# Auditar dependencias
npm audit

# Corregir vulnerabilidades
npm audit fix
```

---

## 10. Checklist de Deployment

### Antes del Deployment

- [ ] Validar que `JWT_SECRET` tiene mínimo 32 caracteres
- [ ] Configurar `NODE_ENV=production`
- [ ] Configurar `DATABASE_URL` con credenciales de producción
- [ ] Configurar `FRONTEND_URL` con el dominio real
- [ ] Revisar límites de rate limiting
- [ ] Ejecutar `npm audit` y corregir vulnerabilidades
- [ ] Verificar que `.env` NO está en el repositorio
- [ ] Configurar HTTPS en el servidor
- [ ] Configurar firewall para limitar acceso al puerto del backend

### Después del Deployment

- [ ] Verificar que los headers de seguridad están configurados
- [ ] Probar rate limiting en rutas críticas
- [ ] Verificar que CORS solo permite orígenes autorizados
- [ ] Monitorear logs de seguridad
- [ ] Configurar alertas para intentos de acceso fallidos
- [ ] Realizar pruebas de penetración básicas
- [ ] Documentar configuración de producción

### Testing de Seguridad

```bash
# Verificar headers de seguridad
curl -I https://api.opws.yourdomain.com/health

# Probar rate limiting
for i in {1..10}; do curl -X POST https://api.opws.yourdomain.com/api/auth/login -d '{"identifier":"test","password":"test"}' -H "Content-Type: application/json"; done

# Verificar CORS
curl -H "Origin: https://malicious.com" -I https://api.opws.yourdomain.com/api/health
```

---

## 📞 Soporte

Si encuentras alguna vulnerabilidad de seguridad, por favor repórtala de manera responsable:

1. **NO** la hagas pública inmediatamente
2. Contacta al equipo de desarrollo
3. Proporciona detalles técnicos y pasos para reproducir
4. Espera confirmación antes de divulgar

---

## 📚 Referencias

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [Express Rate Limit](https://github.com/express-rate-limit/express-rate-limit)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [CORS Best Practices](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

---

**Última actualización**: 2025-11-05

**Versión**: 1.0.0
