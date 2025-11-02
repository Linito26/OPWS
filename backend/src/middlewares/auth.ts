// backend/src/middlewares/auth.ts
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type JWTPayload = {
  id: number;                 // id de usuario (recomendado)
  role?: string | null;       // nombre del rol (opcional)
  mcp?: boolean;              // mustChangePassword (opcional)
  iat?: number; exp?: number;
};

declare global {
  // extendemos Express para poner user en la request
  namespace Express {
    interface User {
      id: number;
      email: string;
      activo: boolean;
      mustChangePassword: boolean;
      rol?: { nombre: string } | null;
    }
    interface Request {
      user?: User;
    }
  }
}

// Normaliza nombres de rol EN/ES
function normalizeRoleName(v?: string | null): "ADMINISTRADOR" | "VISUALIZADOR" | "" {
  const s = String(v || "").trim().toUpperCase();
  if (["ADMIN", "ADMINISTRADOR"].includes(s)) return "ADMINISTRADOR";
  if (["VIEWER", "VISUALIZADOR", "LECTOR"].includes(s)) return "VISUALIZADOR";
  return "";
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ error: "unauthorized" });

    const secret = process.env.JWT_SECRET || "";
    const decoded = jwt.verify(token, secret) as JWTPayload;

    // traemos el usuario de la BD para estado/rol actuales
    const user = await prisma.usuario.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        activo: true,
        mustChangePassword: true,
        rol: { select: { nombre: true } },
      },
    });

    if (!user || !user.activo) return res.status(401).json({ error: "unauthorized" });

    req.user = {
      id: user.id,
      email: user.email,
      activo: user.activo,
      mustChangePassword: user.mustChangePassword,
      rol: user.rol ? { nombre: user.rol.nombre } : null,
    };
    return next();
  } catch (e) {
    return res.status(401).json({ error: "unauthorized" });
  }
}

export function requirePasswordChanged() {
  return (req: Request, res: Response, next: NextFunction) => {
    // permite /auth/change-password sin bloquear
    if (req.path.endsWith("/auth/change-password")) return next();
    if (!req.user) return res.status(401).json({ error: "unauthorized" });

    if (req.user.mustChangePassword) {
      return res.status(428).json({ error: "must_change_password" }); // 428
    }
    next();
  };
}

export function requireRole(allowed: Array<string>) {
  const allowedNorm = new Set(
    allowed.map((r) => normalizeRoleName(r)).filter((r) => !!r)
  );

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "unauthorized" });
    const userRole = normalizeRoleName(req.user.rol?.nombre);
    if (!userRole || !allowedNorm.has(userRole)) {
      return res.status(403).json({ error: "forbidden" });
    }
    next();
  };
}
