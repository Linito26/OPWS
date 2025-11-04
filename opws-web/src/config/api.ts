// src/config/api.ts
const RAW = (import.meta.env.VITE_API_URL as string | undefined) || "/api"; 
// Por defecto usamos /api detrás de Nginx

// Normaliza quitando slashes al final ("/api///" -> "/api")
const BASE = RAW.trim().replace(/\/+$/, "");

// token en memoria + localStorage
let _token: string | null = localStorage.getItem("auth_token") || null;

export function setAuthToken(t: string | null) {
  _token = t;
  if (t) localStorage.setItem("auth_token", t);
  else localStorage.removeItem("auth_token");
}
export const getAuthToken = () => _token;

export async function http<T>(path: string, init?: RequestInit): Promise<T> {
  // Asegura 1 solo slash entre BASE y el path
  const url = `${BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  const t = getAuthToken();
  if (t) headers.Authorization = `Bearer ${t}`;

  const res = await fetch(url, { ...init, headers });

  // Manejo 428 -> forzar cambio de contraseña
  if (res.status === 428) {
    localStorage.setItem("must_change_password", "1");
    if (location.pathname !== "/change-password") {
      location.href = "/change-password";
    }
    throw new Error("HTTP 428 MUST_CHANGE_PASSWORD");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }

  try {
    return (await res.json()) as T;
  } catch {
    return {} as T;
  }
}

console.log("[API BASE]", BASE);
