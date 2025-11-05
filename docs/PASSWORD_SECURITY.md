# Seguridad de Contraseñas

Este documento describe el sistema de seguridad de contraseñas implementado en OPWS, incluyendo políticas, historial y validaciones.

## 📋 Índice

1. [Política de contraseñas](#política-de-contraseñas)
2. [Historial de contraseñas](#historial-de-contraseñas)
3. [Implementación técnica](#implementación-técnica)
4. [API Endpoints](#api-endpoints)
5. [Base de datos](#base-de-datos)
6. [Flujo de cambio de contraseña](#flujo-de-cambio-de-contraseña)
7. [Seguridad](#seguridad)

---

## 🔒 Política de contraseñas

### Requisitos actuales

Todas las contraseñas en OPWS deben cumplir con los siguientes requisitos:

| Requisito | Valor | Descripción |
|-----------|-------|-------------|
| **Longitud mínima** | 8 caracteres | La contraseña debe tener al menos 8 caracteres |
| **Mayúsculas** | ✅ Obligatorio | Al menos una letra mayúscula (A-Z) |
| **Minúsculas** | ✅ Obligatorio | Al menos una letra minúscula (a-z) |
| **Números** | ✅ Obligatorio | Al menos un dígito (0-9) |
| **Símbolos especiales** | ✅ Obligatorio | Al menos un carácter especial (!@#$%^&*...) |
| **Historial** | 5 contraseñas | No puede reutilizar las últimas 5 contraseñas |

### Expresión regular de validación

```javascript
const POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;
```

Desglose:
- `(?=.*[a-z])` - Lookahead: al menos una minúscula
- `(?=.*[A-Z])` - Lookahead: al menos una mayúscula
- `(?=.*\d)` - Lookahead: al menos un dígito
- `(?=.*[^\w\s])` - Lookahead: al menos un símbolo (no alfanumérico ni espacio)
- `.{8,}` - Al menos 8 caracteres de cualquier tipo

### Ejemplos

✅ **Contraseñas válidas:**
- `P@ssw0rd`
- `Secure#2024`
- `MyP@ss123`
- `Admin!2025`

❌ **Contraseñas inválidas:**
- `password` (sin mayúscula, número ni símbolo)
- `PASSWORD123` (sin minúscula ni símbolo)
- `Pass123` (sin símbolo, menos de 8 caracteres)
- `P@ss` (menos de 8 caracteres)

---

## 📚 Historial de contraseñas

### Descripción

OPWS mantiene un historial de las últimas 5 contraseñas de cada usuario para prevenir la reutilización de contraseñas recientes. Esto mejora significativamente la seguridad al obligar a los usuarios a crear contraseñas nuevas y únicas.

### Funcionamiento

1. **Al cambiar contraseña:**
   - La contraseña **actual** se guarda en el historial
   - La nueva contraseña se valida contra las últimas 5 del historial
   - Si coincide con alguna, se rechaza el cambio
   - Si pasa la validación, se actualiza la contraseña del usuario

2. **Límite de registros:**
   - Se mantienen exactamente las últimas 5 contraseñas
   - Al guardar la 6ª, se elimina automáticamente la más antigua
   - Cada usuario tiene su propio historial independiente

3. **Comparación segura:**
   - Las contraseñas del historial están hasheadas con bcrypt
   - La comparación usa `bcrypt.compare()` para validar contra cada hash
   - Nunca se almacenan contraseñas en texto plano

### Tabla de base de datos

```sql
CREATE TABLE "password_history" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "password_hash" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_history_pkey" PRIMARY KEY ("id")
);
```

---

## 🛠️ Implementación técnica

### Backend (Node.js + Express + Prisma)

#### Modelo Prisma

```prisma
model PasswordHistory {
  @@map("password_history")
  id Int @id @default(autoincrement())
  usuarioId Int @map("usuario_id")
  passwordHash String @map("password_hash")
  creadoEn DateTime @map("creado_en") @default(now())

  usuario Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)

  @@index([usuarioId])
  @@index([creadoEn])
}
```

#### Validación de historial

```typescript
// 1. Obtener las últimas 5 contraseñas del historial
const history = await prisma.passwordHistory.findMany({
  where: { usuarioId: user.id },
  orderBy: { creadoEn: "desc" },
  take: 5,
});

// 2. Verificar si la nueva contraseña coincide con alguna del historial
for (const record of history) {
  const matches = await bcrypt.compare(newPassword, record.passwordHash);
  if (matches) {
    return res.status(400).json({
      error: "No puedes reutilizar tus últimas 5 contraseñas"
    });
  }
}

// 3. Guardar la contraseña actual en el historial
await prisma.passwordHistory.create({
  data: {
    usuarioId: user.id,
    passwordHash: user.password, // Hash actual (antes del cambio)
  },
});

// 4. Actualizar a la nueva contraseña
await prisma.usuario.update({
  where: { id: user.id },
  data: {
    password: await bcrypt.hash(newPassword, 12),
    mustChangePassword: false,
  },
});

// 5. Limpiar historial (mantener solo las últimas 5)
const allHistory = await prisma.passwordHistory.findMany({
  where: { usuarioId: user.id },
  orderBy: { creadoEn: "desc" },
});

if (allHistory.length > 5) {
  const idsToDelete = allHistory.slice(5).map((h) => h.id);
  await prisma.passwordHistory.deleteMany({
    where: { id: { in: idsToDelete } },
  });
}
```

### Frontend (React + TypeScript)

#### Obtener política de contraseñas

```typescript
useEffect(() => {
  async function loadPolicy() {
    try {
      const data = await http<PasswordPolicy>("/auth/password-policy");
      setPolicy(data);
    } catch (err) {
      console.error("Error al cargar política:", err);
    }
  }
  loadPolicy();
}, []);
```

#### Mostrar reglas dinámicamente

```tsx
{policy && (
  <ul className="list-disc list-inside">
    <li>Mínimo {policy.minLength} caracteres</li>
    {policy.requireUppercase && <li>Al menos una letra mayúscula</li>}
    {policy.requireLowercase && <li>Al menos una letra minúscula</li>}
    {policy.requireNumber && <li>Al menos un número</li>}
    {policy.requireSymbol && <li>Al menos un símbolo especial</li>}
    {policy.historyCount > 0 && (
      <li>No puede ser igual a las últimas {policy.historyCount} contraseñas</li>
    )}
  </ul>
)}
```

---

## 🔌 API Endpoints

### GET /api/auth/password-policy

Endpoint público que devuelve las reglas de contraseña del sistema.

**Autenticación:** No requerida

**Respuesta exitosa (200 OK):**

```json
{
  "minLength": 8,
  "requireUppercase": true,
  "requireLowercase": true,
  "requireNumber": true,
  "requireSymbol": true,
  "historyCount": 5
}
```

**Ejemplo de uso:**

```bash
curl http://localhost:2002/api/auth/password-policy
```

```javascript
// Frontend
const policy = await http<PasswordPolicy>("/auth/password-policy");
```

### POST /api/auth/change-password

Endpoint protegido para cambiar la contraseña del usuario autenticado.

**Autenticación:** JWT Bearer Token requerido

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body:**
```json
{
  "currentPassword": "OldP@ss123",
  "newPassword": "NewP@ss456"
}
```

**Respuesta exitosa (200 OK):**

```json
{
  "ok": true,
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errores posibles:**

| Status | Error | Causa |
|--------|-------|-------|
| 400 | `currentPassword y newPassword requeridos` | Campos faltantes |
| 400 | `La contraseña no cumple la política (8+, mayúscula, minúscula, número y símbolo)` | No cumple requisitos |
| 400 | `No puedes reutilizar tus últimas 5 contraseñas` | Contraseña en historial |
| 401 | `Falta token` | Sin header Authorization |
| 401 | `Token inválido` | JWT malformado o expirado |
| 401 | `Contraseña actual incorrecta` | currentPassword incorrecta |
| 404 | `Usuario no encontrado` | Usuario no existe o fue eliminado |

**Ejemplo de uso:**

```bash
curl -X POST http://localhost:2002/api/auth/change-password \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "OldP@ss123",
    "newPassword": "NewP@ss456"
  }'
```

---

## 💾 Base de datos

### Esquema de la tabla password_history

```sql
CREATE TABLE "password_history" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "password_hash" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_history_pkey" PRIMARY KEY ("id")
);

-- Índices
CREATE INDEX "password_history_usuario_id_idx"
  ON "password_history"("usuario_id");

CREATE INDEX "password_history_creado_en_idx"
  ON "password_history"("creado_en");

-- Clave foránea
ALTER TABLE "password_history"
  ADD CONSTRAINT "password_history_usuario_id_fkey"
  FOREIGN KEY ("usuario_id")
  REFERENCES "usuarios"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
```

### Migración

**Ubicación:** `backend/prisma/migrations/20251105_password_history/migration.sql`

**Aplicar migración:**

```bash
cd backend
pnpm prisma migrate deploy
```

**Verificar migración:**

```bash
pnpm prisma db pull
pnpm prisma generate
```

### Datos de ejemplo

```sql
-- Ver historial de un usuario específico
SELECT
  ph.id,
  u.email,
  ph.password_hash,
  ph.creado_en
FROM password_history ph
JOIN usuarios u ON ph.usuario_id = u.id
WHERE u.email = 'admin@example.com'
ORDER BY ph.creado_en DESC
LIMIT 5;

-- Contar registros de historial por usuario
SELECT
  u.email,
  COUNT(ph.id) as total_passwords
FROM usuarios u
LEFT JOIN password_history ph ON u.id = ph.usuario_id
GROUP BY u.id, u.email
ORDER BY total_passwords DESC;
```

---

## 🔄 Flujo de cambio de contraseña

### Diagrama de flujo

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Usuario envía currentPassword + newPassword               │
└─────────────────────┬────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Validar JWT token                                         │
│    ❌ Inválido → 401 "Token inválido"                        │
└─────────────────────┬────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Validar que newPassword cumple política regex             │
│    ❌ No cumple → 400 "No cumple la política"                │
└─────────────────────┬────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. Verificar currentPassword con bcrypt.compare()            │
│    ❌ Incorrecta → 401 "Contraseña actual incorrecta"        │
└─────────────────────┬────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. Obtener últimas 5 contraseñas del historial               │
│    SELECT * FROM password_history                            │
│    WHERE usuario_id = ? ORDER BY creado_en DESC LIMIT 5      │
└─────────────────────┬────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. Comparar newPassword con cada hash del historial          │
│    FOR EACH hash: bcrypt.compare(newPassword, hash)          │
│    ❌ Coincide → 400 "No puedes reutilizar..."               │
└─────────────────────┬────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────┐
│ 7. Guardar contraseña ACTUAL en password_history             │
│    INSERT INTO password_history (usuario_id, password_hash)  │
│    VALUES (user.id, user.password)                           │
└─────────────────────┬────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────┐
│ 8. Actualizar contraseña del usuario                         │
│    UPDATE usuarios SET password = bcrypt.hash(newPassword)   │
│    WHERE id = user.id                                        │
└─────────────────────┬────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────┐
│ 9. Limpiar historial (mantener solo últimas 5)               │
│    DELETE FROM password_history WHERE id IN (...)            │
│    (eliminar registros más antiguos si hay > 5)              │
└─────────────────────┬────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────┐
│ 10. Generar nuevo JWT (con MCP=false)                        │
│     Responder: { ok: true, access: newToken }                │
└──────────────────────────────────────────────────────────────┘
```

### Complejidad temporal

- **Validaciones:** O(1)
- **Comparación con historial:** O(n) donde n = 5 (constante)
- **Hashing bcrypt:** O(1) - tiempo fijo por diseño
- **Limpieza de historial:** O(n) donde n ≤ 5 (constante)

**Total:** O(1) - tiempo constante en la práctica

---

## 🔐 Seguridad

### Hashing con bcrypt

#### ¿Por qué bcrypt?

- **Resistente a fuerza bruta:** Diseñado para ser lento (configurable con rounds)
- **Salt incorporado:** Cada hash tiene su propio salt único
- **Probado en batalla:** Estándar de la industria desde 1999
- **Inmune a rainbow tables:** Gracias al salt aleatorio

#### Configuración actual

```javascript
const rounds = 12; // 2^12 = 4096 iteraciones
const hash = await bcrypt.hash(password, rounds);
```

Con 12 rounds, cada hash toma ~250ms en hardware moderno. Esto es ideal para:
- ✅ Prevenir ataques de fuerza bruta
- ✅ No afectar significativamente la experiencia del usuario
- ✅ Escalable para la mayoría de aplicaciones

#### Comparación de métodos de hashing

| Algoritmo | ¿Seguro? | ¿Salted? | Velocidad | Uso recomendado |
|-----------|----------|----------|-----------|-----------------|
| **bcrypt** | ✅ Sí | ✅ Automático | 🐢 Lento (por diseño) | ✅ Contraseñas |
| **scrypt** | ✅ Sí | ⚠️ Manual | 🐢 Lento | ✅ Contraseñas (alternativa) |
| **argon2** | ✅ Sí | ⚠️ Manual | 🐢 Lento | ✅ Contraseñas (más reciente) |
| SHA-256 | ⚠️ Débil | ❌ No | ⚡ Rápido | ❌ NO para contraseñas |
| MD5 | ❌ Roto | ❌ No | ⚡ Muy rápido | ❌ NUNCA usar |

### Prevención de ataques

#### 1. **Rainbow Table Attack**
- **Protección:** Salt único por contraseña (automático en bcrypt)
- **Estado:** ✅ Protegido

#### 2. **Brute Force Attack**
- **Protección:** 12 rounds de bcrypt (~250ms por intento)
- **Límite adicional:** Campo `intentos_fallidos` en tabla usuarios
- **Estado:** ✅ Protegido

#### 3. **Dictionary Attack**
- **Protección:** Política de contraseñas fuerte (8+ chars, complejidad)
- **Estado:** ✅ Protegido

#### 4. **Password Reuse**
- **Protección:** Historial de 5 contraseñas
- **Estado:** ✅ Protegido

#### 5. **Credential Stuffing**
- **Protección:** Hashes únicos por usuario
- **Recomendación:** Implementar rate limiting en el login
- **Estado:** ⚠️ Considerar mejoras

### Recomendaciones de seguridad adicionales

1. **Implementar rate limiting:**
   ```javascript
   // Limitar intentos de cambio de contraseña
   app.use('/api/auth/change-password', rateLimiter({
     windowMs: 15 * 60 * 1000, // 15 minutos
     max: 5 // 5 intentos por ventana
   }));
   ```

2. **Forzar cambio periódico:**
   ```sql
   -- Agregar campo password_expires_at a usuarios
   ALTER TABLE usuarios
   ADD COLUMN password_expires_at TIMESTAMP;

   -- Forzar cambio cada 90 días
   UPDATE usuarios
   SET must_change_password = true
   WHERE password_expires_at < NOW();
   ```

3. **Notificar cambios de contraseña:**
   ```javascript
   // Enviar email al usuario cuando cambia la contraseña
   await sendEmail({
     to: user.email,
     subject: "Contraseña actualizada",
     body: "Tu contraseña fue cambiada exitosamente."
   });
   ```

4. **Auditar cambios:**
   ```sql
   -- Tabla de auditoría
   CREATE TABLE password_change_log (
     id SERIAL PRIMARY KEY,
     usuario_id INT REFERENCES usuarios(id),
     ip_address VARCHAR(45),
     user_agent TEXT,
     changed_at TIMESTAMP DEFAULT NOW()
   );
   ```

---

## 🧪 Testing

### Casos de prueba

#### 1. Contraseña cumple política pero está en historial

```bash
# Primera vez (debe funcionar)
curl -X POST /api/auth/change-password \
  -H "Authorization: Bearer TOKEN" \
  -d '{"currentPassword": "Old@123", "newPassword": "New@456"}'

# Intentar volver a la anterior (debe fallar)
curl -X POST /api/auth/change-password \
  -H "Authorization: Bearer TOKEN" \
  -d '{"currentPassword": "New@456", "newPassword": "Old@123"}'

# Respuesta esperada:
# { "error": "No puedes reutilizar tus últimas 5 contraseñas" }
```

#### 2. Contraseña no cumple política

```bash
curl -X POST /api/auth/change-password \
  -H "Authorization: Bearer TOKEN" \
  -d '{"currentPassword": "Valid@123", "newPassword": "weak"}'

# Respuesta esperada:
# { "error": "La contraseña no cumple la política..." }
```

#### 3. Historial se limpia correctamente

```javascript
// Cambiar contraseña 6 veces
for (let i = 1; i <= 6; i++) {
  await changePassword(`Pass${i}@123`);
}

// Verificar que solo hay 5 registros
const history = await prisma.passwordHistory.findMany({
  where: { usuarioId: user.id }
});

assert(history.length === 5); // ✅ Debe pasar
```

---

## 📚 Referencias

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [NIST Digital Identity Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [bcrypt documentation](https://github.com/kelektiv/node.bcrypt.js)
- [Prisma documentation](https://www.prisma.io/docs/)

---

## 🆘 Soporte

Si encuentras problemas relacionados con la seguridad de contraseñas:

1. Revisa los logs del backend:
   ```bash
   docker compose logs -f api
   ```

2. Verifica el estado del historial:
   ```sql
   SELECT COUNT(*) FROM password_history WHERE usuario_id = ?;
   ```

3. Consulta la política actual:
   ```bash
   curl http://localhost:2002/api/auth/password-policy
   ```

---

**Última actualización:** 2025-11-05
**Versión:** 1.0.0
**Responsable:** Equipo de Desarrollo OPWS
