// src/routes/auth.routes.ts
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { requireAuth } from "../middlewares/auth";

export const auth = Router();
const prisma = new PrismaClient();

/* ===== helpers ===== */

const POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

type JwtClaims = { id: number; role?: string; mcp?: boolean };

function signToken(payload: JwtClaims) {
  const secret = process.env.JWT_SECRET || "dev_secret_change_me";
  type ExpiresIn = NonNullable<SignOptions["expiresIn"]>;
  const envVal = (process.env.JWT_EXPIRES_IN ?? "8h") as ExpiresIn;

  return jwt.sign(payload, secret, {
    algorithm: "HS256",
    expiresIn: envVal,
  });
}

function pickIdentifier(body: any): string | undefined {
  return body?.identifier ?? body?.email ?? body?.username;
}

function mapProfile(u: any) {
  return {
    id: u.id,
    username: u.username ?? null,
    nombre: u.nombre ?? null,
    apellido: u.apellido ?? null,
    email: u.email,
    rol: u.rol?.nombre ?? null,
    permisos: [
      ...(u.rol?.permisos?.map((rp: any) => rp?.permiso?.nombre).filter(Boolean) ?? []),
      ...(u.permisos?.map((up: any) => up?.permiso?.nombre).filter(Boolean) ?? []),
    ],
  };
}

/* ===== /auth/login =====
 * Acepta: { identifier | email | username, password }
 * Busca por email o username
 * Devuelve: { access, role, mustChangePassword, profile }
 */
auth.post("/login", async (req, res) => {
  const identifier = pickIdentifier(req.body);
  const password = req.body?.password as string | undefined;

  if (!identifier || !password) {
    return res.status(400).json({ error: "Email/usuario y contraseña requeridos" });
  }

  const user = await prisma.usuario.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
    include: {
      rol: { include: { permisos: { include: { permiso: true } } } },
      permisos: { include: { permiso: true } },
    },
  });

  if (!user || !user.activo) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

  const role = user.rol?.nombre ?? undefined;
  const mcp = !!user.mustChangePassword;

  const access = signToken({ id: user.id, role, mcp });
  return res.json({
    access,
    role: role ?? null,
    mustChangePassword: mcp,
    profile: mapProfile(user),
  });
});

/* ===== /auth/me =====
 * Requiere JWT. Devuelve { user: profile }
 */
auth.get("/me", requireAuth, async (req, res) => {
  // req.user viene del middleware, pero refrescamos desde DB por si cambió algo.
  const u = await prisma.usuario.findUnique({
    where: { id: req.user!.id },
    include: {
      rol: { include: { permisos: { include: { permiso: true } } } },
      permisos: { include: { permiso: true } },
    },
  });
  if (!u) return res.status(404).json({ error: "Usuario no encontrado" });
  return res.json({ user: mapProfile(u) });
});

/* ===== /auth/change-password =====
 * Requiere JWT (Authorization: Bearer ...)
 * Body: { currentPassword, newPassword }
 * Aplica política y pone mustChangePassword=false
 * Devuelve: { ok: true, access }
 */
auth.post("/change-password", async (req, res) => {
  const hdr = req.headers.authorization ?? "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Falta token" });

  let claims: JwtClaims | null = null;
  try {
    claims = jwt.verify(token, process.env.JWT_SECRET || "dev_secret_change_me") as JwtClaims;
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
  if (!claims?.id) return res.status(401).json({ error: "Token inválido" });

  const { currentPassword, newPassword } = (req.body ?? {}) as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "currentPassword y newPassword requeridos" });
  }
  if (!POLICY.test(newPassword)) {
    return res
      .status(400)
      .json({ error: "La contraseña no cumple la política (8+, mayúscula, minúscula, número y símbolo)" });
  }

  const u = await prisma.usuario.findUnique({ where: { id: claims.id } });
  if (!u) return res.status(404).json({ error: "Usuario no encontrado" });

  const ok = await bcrypt.compare(currentPassword, u.password);
  if (!ok) return res.status(401).json({ error: "Contraseña actual incorrecta" });

  await prisma.usuario.update({
    where: { id: u.id },
    data: { password: await bcrypt.hash(newPassword, 12), mustChangePassword: false, intentosFallidos: 0 },
  });

  const role = (await prisma.rol.findUnique({ where: { id: u.rolId ?? 0 } }))?.nombre ?? undefined;
  const access = signToken({ id: u.id, role, mcp: false });

  return res.json({ ok: true, access });
});

export default auth;
