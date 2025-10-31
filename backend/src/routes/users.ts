// backend/src/routes/users.ts
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { requireAuth, requireRole } from "../middlewares/auth";
import { sendWelcomeTempPassword } from "../utils/email";

export const users = Router();
const prisma = new PrismaClient();

// EN/ES → guardamos SIEMPRE en ES
function mapRoleInputToDBName(input?: string): "ADMINISTRADOR" | "VISUALIZADOR" {
  const v = String(input || "").trim().toUpperCase();
  if (["ADMIN", "ADMINISTRADOR"].includes(v)) return "ADMINISTRADOR";
  if (["VIEWER", "VISUALIZADOR", "LECTOR"].includes(v)) return "VISUALIZADOR";
  return "VISUALIZADOR";
}

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ""));
}
function mapUserRow(u: any) {
  return {
    id: u.id as number,
    username: (u.username ?? null) as string | null,
    nombre: (u.nombre ?? null) as string | null,
    apellido: (u.apellido ?? null) as string | null,
    email: u.email as string,
    rol: (u.rol?.nombre ?? null) as string | null,
    activo: u.activo as boolean,
    mustChangePassword: u.mustChangePassword as boolean,
    creadoEn: u.creadoEn as Date,
  };
}
function generateTempPassword(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@$%*?";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** Crear usuario (solo ADMINISTRADOR) */
users.post("/", requireAuth, requireRole(["ADMINISTRADOR", "ADMIN"]), async (req, res) => {
  try {
    const body = (req.body ?? {}) as {
      username?: string;
      firstName?: string; lastName?: string;
      nombre?: string; apellido?: string;
      email: string;
      role?: string; // admite EN/ES
    };

    const firstName = (body.firstName ?? body.nombre ?? "").trim();
    const lastName  = (body.lastName  ?? body.apellido ?? "").trim();
    const username  = (body.username  ?? "").trim();
    const email     = (body.email     ?? "").trim();
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: "nombre/firstName, apellido/lastName y email son requeridos" });
    }
    if (!isEmail(email)) return res.status(400).json({ error: "email inválido" });

    const rolNombreDB = mapRoleInputToDBName(body.role);
    const rolRow = await prisma.rol.findUnique({ where: { nombre: rolNombreDB } });
    if (!rolRow) return res.status(400).json({ error: `Rol '${rolNombreDB}' no existe. Ejecuta el seed.` });

    const temp = generateTempPassword(12);
    const hash = await bcrypt.hash(temp, 12);

    const u = await prisma.usuario.create({
      data: {
        username: username || null,
        nombre: firstName,
        apellido: lastName,
        email,
        password: hash,
        mustChangePassword: true,
        activo: true,
        rolId: rolRow.id,
      },
      select: {
        id: true, username: true, nombre: true, apellido: true, email: true,
        activo: true, mustChangePassword: true, creadoEn: true,
        rol: { select: { nombre: true } },
      },
    });

    // enviar correo (firma flexible)
    await (sendWelcomeTempPassword as unknown as (args: any) => Promise<void>)({
      to: u.email,
      username: u.username ?? email,
      password: temp,
      temp,
      tempPassword: temp,
    });

    return res.status(201).json(mapUserRow(u));
  } catch (e: any) {
    if (e?.code === "P2002") return res.status(409).json({ error: "username o email ya existen" });
    console.error("[users.post] error:", e);
    return res.status(500).json({ error: "No se pudo crear el usuario" });
  }
});

/** Listar usuarios (solo ADMINISTRADOR) */
users.get("/", requireAuth, requireRole(["ADMINISTRADOR", "ADMIN"]), async (_req, res) => {
  const rows = await prisma.usuario.findMany({
    orderBy: { creadoEn: "desc" },
    select: {
      id: true, username: true, nombre: true, apellido: true, email: true,
      activo: true, mustChangePassword: true, creadoEn: true,
      rol: { select: { nombre: true } },
    },
  });
  return res.json(rows.map(mapUserRow));
});

/** Activar/desactivar usuario (solo ADMINISTRADOR) */
users.patch("/:id/active", requireAuth, requireRole(["ADMINISTRADOR", "ADMIN"]), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "id inválido" });
  const { isActive } = (req.body ?? {}) as { isActive: boolean };
  if (typeof isActive !== "boolean") return res.status(400).json({ error: "isActive debe ser boolean" });

  const u = await prisma.usuario.update({
    where: { id },
    data: { activo: isActive },
    select: {
      id: true, username: true, nombre: true, apellido: true, email: true,
      activo: true, mustChangePassword: true, creadoEn: true,
      rol: { select: { nombre: true } },
    },
  });
  return res.json(mapUserRow(u));
});

/** Cambiar rol (solo ADMINISTRADOR) */
users.patch("/:id/role", requireAuth, requireRole(["ADMINISTRADOR", "ADMIN"]), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "id inválido" });

  const rolNombreDB = mapRoleInputToDBName((req.body ?? {}).role);
  const rolRow = await prisma.rol.findUnique({ where: { nombre: rolNombreDB } });
  if (!rolRow) return res.status(400).json({ error: `Rol '${rolNombreDB}' no existe. Ejecuta el seed.` });

  const u = await prisma.usuario.update({
    where: { id },
    data: { rolId: rolRow.id },
    select: {
      id: true, username: true, nombre: true, apellido: true, email: true,
      activo: true, mustChangePassword: true, creadoEn: true,
      rol: { select: { nombre: true } },
    },
  });
  return res.json(mapUserRow(u));
});

/** Regenerar temporal + forzar MCP (solo ADMINISTRADOR) */
users.post("/:id/reset-temp", requireAuth, requireRole(["ADMINISTRADOR", "ADMIN"]), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "id inválido" });

  const u0 = await prisma.usuario.findUnique({
    where: { id },
    select: { id: true, email: true, username: true, nombre: true },
  });
  if (!u0) return res.status(404).json({ error: "Usuario no encontrado" });

  const temp = generateTempPassword(12);
  const hash = await bcrypt.hash(temp, 12);

  const u = await prisma.usuario.update({
    where: { id },
    data: { password: hash, mustChangePassword: true, intentosFallidos: 0 },
    select: {
      id: true, username: true, nombre: true, apellido: true, email: true,
      activo: true, mustChangePassword: true, creadoEn: true,
      rol: { select: { nombre: true } },
    },
  });

  const uname = (u.username ?? u0.username) ?? u0.email;

  await (sendWelcomeTempPassword as unknown as (args: any) => Promise<void>)({
    to: u.email,
    username: uname,
    password: temp,
    temp,
    tempPassword: temp,
  });

  return res.json(mapUserRow(u));
});

export default users;
