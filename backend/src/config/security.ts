// src/config/security.ts
import rateLimit from "express-rate-limit";

/**
 * Valida que las variables de entorno críticas estén configuradas correctamente
 * Falla rápido si falta alguna variable crítica o no cumple con los requisitos
 */
export function validateSecrets() {
  const errors: string[] = [];

  // Validar JWT_SECRET
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    errors.push("JWT_SECRET no está configurado");
  } else if (jwtSecret.length < 32) {
    errors.push(
      `JWT_SECRET debe tener al menos 32 caracteres (actual: ${jwtSecret.length})`
    );
  } else if (jwtSecret === "dev_secret_change_me") {
    if (process.env.NODE_ENV === "production") {
      errors.push("JWT_SECRET no puede ser el valor por defecto en producción");
    } else {
      console.warn(
        "⚠️  ADVERTENCIA: Usando JWT_SECRET por defecto. Esto es inseguro en producción."
      );
    }
  }

  // Validar DATABASE_URL
  if (!process.env.DATABASE_URL) {
    errors.push("DATABASE_URL no está configurado");
  }

  // Validar NODE_ENV
  if (!process.env.NODE_ENV) {
    console.warn(
      "⚠️  ADVERTENCIA: NODE_ENV no está configurado. Usando 'development' por defecto."
    );
    process.env.NODE_ENV = "development";
  }

  // Si hay errores, falla rápido
  if (errors.length > 0) {
    console.error("❌ ERROR: Variables de entorno críticas faltantes o inválidas:\n");
    errors.forEach((err) => console.error(`   - ${err}`));
    console.error(
      "\nRevisa el archivo .env.example para ver las variables requeridas.\n"
    );
    process.exit(1);
  }

  console.log("✅ Validación de secrets completada");
}

/**
 * Rate limiter global para todas las rutas
 * 100 requests por 15 minutos por IP
 */
export const globalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: Number(process.env.RATE_LIMIT_MAX) || 100, // 100 requests
  message: {
    error: "Demasiadas solicitudes desde esta IP, por favor intenta más tarde",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Handler para logging
  handler: (req, res) => {
    console.warn(
      `[RATE LIMIT] IP bloqueada temporalmente: ${req.ip} - Ruta: ${req.path}`
    );
    res.status(429).json({
      error: "Demasiadas solicitudes desde esta IP, por favor intenta más tarde",
    });
  },
});

/**
 * Rate limiter estricto para login
 * 5 intentos por 15 minutos por IP
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos
  skipSuccessfulRequests: true, // No contar requests exitosos
  message: {
    error:
      "Demasiados intentos de inicio de sesión. Por favor intenta de nuevo en 15 minutos",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(
      `[SECURITY] Demasiados intentos de login desde IP: ${req.ip} - Identifier: ${
        req.body?.identifier || req.body?.email || req.body?.username || "desconocido"
      }`
    );
    res.status(429).json({
      error:
        "Demasiados intentos de inicio de sesión. Por favor intenta de nuevo en 15 minutos",
    });
  },
});

/**
 * Rate limiter para cambio de contraseña
 * 3 intentos por hora por IP
 */
export const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 intentos
  skipSuccessfulRequests: true, // No contar requests exitosos
  message: {
    error:
      "Demasiados intentos de cambio de contraseña. Por favor intenta de nuevo en 1 hora",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(
      `[SECURITY] Demasiados intentos de cambio de contraseña desde IP: ${req.ip}`
    );
    res.status(429).json({
      error:
        "Demasiados intentos de cambio de contraseña. Por favor intenta de nuevo en 1 hora",
    });
  },
});

/**
 * Logger de seguridad para eventos importantes
 */
export const securityLogger = {
  /**
   * Loguea intento de login fallido
   */
  loginFailed: (identifier: string, ip: string | undefined, reason: string) => {
    const timestamp = new Date().toISOString();
    console.warn(
      `[SECURITY] [${timestamp}] Login fallido - Identifier: ${identifier} - IP: ${
        ip || "desconocida"
      } - Razón: ${reason}`
    );
  },

  /**
   * Loguea login exitoso
   */
  loginSuccess: (identifier: string, ip: string | undefined, userId: number) => {
    const timestamp = new Date().toISOString();
    console.log(
      `[SECURITY] [${timestamp}] Login exitoso - Identifier: ${identifier} - IP: ${
        ip || "desconocida"
      } - UserID: ${userId}`
    );
  },

  /**
   * Loguea cambio de contraseña exitoso
   */
  passwordChanged: (userId: number, ip: string | undefined) => {
    const timestamp = new Date().toISOString();
    console.log(
      `[SECURITY] [${timestamp}] Contraseña cambiada exitosamente - UserID: ${userId} - IP: ${
        ip || "desconocida"
      }`
    );
  },

  /**
   * Loguea cambio de contraseña fallido
   */
  passwordChangeFailed: (userId: number, ip: string | undefined, reason: string) => {
    const timestamp = new Date().toISOString();
    console.warn(
      `[SECURITY] [${timestamp}] Cambio de contraseña fallido - UserID: ${userId} - IP: ${
        ip || "desconocida"
      } - Razón: ${reason}`
    );
  },

  /**
   * Loguea acceso no autorizado
   */
  unauthorized: (path: string, ip: string | undefined, reason: string) => {
    const timestamp = new Date().toISOString();
    console.warn(
      `[SECURITY] [${timestamp}] Acceso no autorizado - Path: ${path} - IP: ${
        ip || "desconocida"
      } - Razón: ${reason}`
    );
  },
};
