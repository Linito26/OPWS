// src/auth/PrivateRoute.tsx
import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";

/** Aceptamos EN/ES para compatibilidad */
type AnyRole = "ADMIN" | "VIEWER" | "ADMINISTRADOR" | "VISUALIZADOR" | "LECTOR";

/** Normaliza rol EN/ES al canónico en ES */
function normalizeRole(v?: string | null): "ADMINISTRADOR" | "VISUALIZADOR" | "" {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "ADMIN" || s === "ADMINISTRADOR") return "ADMINISTRADOR";
  if (s === "VIEWER" || s === "VISUALIZADOR" || s === "LECTOR") return "VISUALIZADOR";
  return "";
}

type Props = {
  children: ReactNode;
  /** Roles permitidos (por defecto permite ambos: admin/visualizador en EN/ES) */
  allow?: AnyRole[];
  /** Permite pasar aunque deba cambiar contraseña (para /change-password) */
  bypassMCP?: boolean;
};

export default function PrivateRoute({
  children,
  allow = ["ADMIN", "ADMINISTRADOR", "VIEWER", "VISUALIZADOR"],
  bypassMCP = false,
}: Props) {
  const { isAuthenticated, user, mustChangePassword } = useAuth();
  const loc = useLocation();

  // No autenticado → a login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }

  // Debe cambiar contraseña → redirige a /change-password (salvo bypass o si ya está ahí)
  if (mustChangePassword && !bypassMCP && loc.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace state={{ from: loc }} />;
  }

  // Validación de rol (normalizamos EN/ES)
  const roleCanon = normalizeRole(user?.rol);
  const allowCanon = new Set(
    (allow ?? []).map((r) => normalizeRole(String(r))).filter(Boolean)
  );

  if (allowCanon.size > 0 && (roleCanon === "" || !allowCanon.has(roleCanon))) {
    // Si no tiene rol permitido, mándalo a /panel (o a una 403 si tienes)
    return <Navigate to="/panel" replace />;
  }

  return <>{children}</>;
}
