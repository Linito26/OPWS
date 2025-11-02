// backend/src/utils/email.ts
import nodemailer, { Transporter } from "nodemailer";

const MAIL_FROM = process.env.MAIL_FROM || process.env.SMTP_USER || "";
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || "587");
const SMTP_SECURE = (process.env.SMTP_SECURE || "false").toLowerCase() === "true";
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = (process.env.SMTP_PASS || "").replace(/\s+/g, ""); // por si pegaste la app password con espacios

let transporter: Transporter | null = null;

function ensureEnv() {
  const missing: string[] = [];
  if (!MAIL_FROM) missing.push("MAIL_FROM o SMTP_USER");
  if (!SMTP_HOST) missing.push("SMTP_HOST");
  if (!SMTP_PORT) missing.push("SMTP_PORT");
  if (!SMTP_USER) missing.push("SMTP_USER");
  if (!SMTP_PASS) missing.push("SMTP_PASS (App Password sin espacios)");
  if (missing.length) {
    throw new Error(`[email] Faltan variables de entorno: ${missing.join(", ")}`);
  }
}

function getTransporter(): Transporter {
  if (transporter) return transporter;
  ensureEnv();

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,                 // smtp.gmail.com
    port: SMTP_PORT,                 // 587 (STARTTLS) o 465 (SSL)
    secure: SMTP_SECURE || SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    pool: true,
    tls: {
      // Gmail funciona con STARTTLS/SSL; si estás detrás de proxy MITM podrías requerir:
      // rejectUnauthorized: false
    },
  });

  return transporter;
}

type WelcomeData = {
  to: string;           // destinatario
  username: string;     // usuario mostrado
  tempPassword: string; // contraseña temporal
};

// Plantillas
function renderWelcomeHTML(username: string, tempPassword: string) {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#111">
    <h2 style="margin:0 0 8px">Bienvenido a OPWS</h2>
    <p>Se creó una cuenta para ti. Usa estas credenciales en tu primer inicio de sesión y cambia la contraseña cuando se te solicite:</p>
    <ul>
      <li><b>Usuario</b>: ${username}</li>
      <li><b>Contraseña temporal</b>: ${tempPassword}</li>
    </ul>
    <p>Accede en <a href="http://localhost:2002/login">http://localhost:2002/login</a></p>
    <p style="color:#6b7280;font-size:12px">Si no reconoces este correo, ignóralo.</p>
  </div>
  `;
}

function renderWelcomeText(username: string, tempPassword: string) {
  return [
    "Bienvenido a OPWS",
    "",
    `Usuario: ${username}`,
    `Contraseña temporal: ${tempPassword}`,
    "",
    "Inicia en: http://localhost:2002/login",
  ].join("\n");
}

// API nueva: objeto
export async function sendWelcomeTempPassword(data: WelcomeData): Promise<void>;
// Compat antigua: (to, username, tempPassword)
export async function sendWelcomeTempPassword(to: string, username: string, tempPassword: string): Promise<void>;
export async function sendWelcomeTempPassword(
  a: WelcomeData | string,
  b?: string,
  c?: string
) {
  const payload: WelcomeData = typeof a === "string"
    ? { to: a, username: b || "", tempPassword: c || "" }
    : a;

  if (!payload.to || !payload.username || !payload.tempPassword) {
    throw new Error("[email] Faltan campos: to, username, tempPassword");
  }

  const t = getTransporter();

  const info = await t.sendMail({
    from: MAIL_FROM,                   // ej: 'OPWS <tu@gmail.com>'
    to: payload.to,
    subject: "OPWS – Tu contraseña temporal",
    text: renderWelcomeText(payload.username, payload.tempPassword),
    html: renderWelcomeHTML(payload.username, payload.tempPassword),
  });

  console.log(`[email] Enviado a ${payload.to} – id: ${info.messageId}`);
}
