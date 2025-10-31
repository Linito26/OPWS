// src/auth/roles.ts
export type AnyRole = "ADMINISTRADOR" | "VISUALIZADOR" | "ADMIN" | "VIEWER" | "LECTOR" | "";

/** Normaliza nombres de rol EN/ES al nombre que guardamos en BD */
export function normalizeRole(input?: string | null): "ADMINISTRADOR" | "VISUALIZADOR" | "" {
  const v = String(input || "").trim().toUpperCase();
  if (v === "ADMIN" || v === "ADMINISTRADOR") return "ADMINISTRADOR";
  if (v === "VIEWER" || v === "VISUALIZADOR" || v === "LECTOR") return "VISUALIZADOR";
  return "";
}

export function isAdmin(input?: string | null): boolean {
  return normalizeRole(input) === "ADMINISTRADOR";
}

export function hasAnyRole(userRole?: string | null, allowed?: AnyRole[]): boolean {
  if (!allowed || allowed.length === 0) return true; // si no se especifica, basta con estar logueado
  const want = allowed.map((r) => normalizeRole(r));
  const got = normalizeRole(userRole);
  return got !== "" && want.includes(got);
}
