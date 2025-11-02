// src/auth/AuthContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { http, setAuthToken, getAuthToken } from "../config/api";

/* =======================
   Tipos
   ======================= */
export type User = {
  id: number;
  username?: string | null;
  nombre: string | null;
  apellido?: string | null;
  email?: string;
  /** Puede venir como 'ADMIN', 'VIEWER', 'ADMINISTRADOR' o 'VISUALIZADOR' */
  rol?: string | null;
  permisos: string[];
};

type AuthCtx = {
  user: User | null;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  /** Guarda token + usuario (desde /auth/login) */
  login: (token: string, user: User) => void;
  logout: () => void;
  /** Marca que ya cambió contraseña (MCP resuelto) */
  markPasswordChanged: () => void;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  isAuthenticated: false,
  mustChangePassword: false,
  login: () => {},
  logout: () => {},
  markPasswordChanged: () => {},
});

/* =======================
   Util: decode JWT
   ======================= */
function decodeJwt<T = any>(token?: string | null): T | null {
  try {
    if (!token) return null;
    const [, payload] = token.split(".");
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/* =======================
   Util: normalizar rol EN/ES
   ======================= */
function normalizeRole(v?: string | null): "ADMINISTRADOR" | "VISUALIZADOR" | "" {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "ADMIN" || s === "ADMINISTRADOR") return "ADMINISTRADOR";
  if (s === "VIEWER" || s === "VISUALIZADOR" || s === "LECTOR") return "VISUALIZADOR";
  return "";
}

/* =======================
   Provider
   ======================= */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem("auth_user");
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  });

  const [mustChangePassword, setMustChangePassword] = useState<boolean>(() => {
    return localStorage.getItem("must_change_password") === "1";
  });

  // Hidrata token en el wrapper http() al montar
  useEffect(() => {
    const t = localStorage.getItem("auth_token");
    setAuthToken(t);
  }, []);

  // Logout seguro (estable dentro de refs)
  const logoutRef = useRef<() => void>(() => {});
  useEffect(() => {
    logoutRef.current = () => {
      setAuthToken(null);
      setUser(null);
      setMustChangePassword(false);
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      localStorage.removeItem("must_change_password");
    };
  }, []);

  // Revalidación si hay token pero aún no hay user (p. ej. tras refresh)
  useEffect(() => {
    const t = getAuthToken();
    if (!t || user) return;

    (async () => {
      try {
        const data = await http<any>("/auth/me");
        // /auth/me puede devolver { user: {...} } o directamente el perfil
        const me: User | undefined = (data?.user as User) ?? (data as User);
        if (me && typeof me.id === "number") {
          const merged: User = {
            ...me,
            rol: normalizeRole(me.rol),
            permisos: Array.isArray(me.permisos) ? me.permisos : [],
          };
          setUser(merged);
          localStorage.setItem("auth_user", JSON.stringify(merged));
          if (typeof (me as any)?.mustChangePassword === "boolean") {
            const mcp = !!(me as any).mustChangePassword;
            setMustChangePassword(mcp);
            localStorage.setItem("must_change_password", mcp ? "1" : "0");
          }
        }
      } catch {
        // token inválido o expirado → limpiar
        logoutRef.current();
      }
    })();
  }, [user]);

  /* =======================
     login: guarda token+usuario y respeta claims
     - Si el token viene vencido (exp), hace logout inmediato
     ======================= */
  const login = (token: string, u: User) => {
    const claims = decodeJwt<{ role?: string; mcp?: boolean; exp?: number }>(token);

    // exp (segundos epoch). Si está vencido no guardamos nada.
    if (claims?.exp && Date.now() / 1000 >= claims.exp) {
      logoutRef.current();
      return;
    }

    // Guarda token para futuras llamadas http()
    setAuthToken(token);
    localStorage.setItem("auth_token", token);

    // Mezcla perfil con claims del JWT (rol) y normaliza EN/ES → ES
    const merged: User = {
      ...u,
      rol: normalizeRole(u.rol ?? claims?.role ?? ""),
      permisos: Array.isArray(u.permisos) ? u.permisos : [],
    };
    setUser(merged);
    localStorage.setItem("auth_user", JSON.stringify(merged));

    // Flag de cambio de contraseña obligatorio (MCP)
    const mcp = !!claims?.mcp;
    setMustChangePassword(mcp);
    localStorage.setItem("must_change_password", mcp ? "1" : "0");

    // Si debe cambiar contraseña, forzar ruta dedicada
    if (mcp && window.location.pathname !== "/change-password") {
      window.location.href = "/change-password";
    }
  };

  const logout = () => logoutRef.current();

  const markPasswordChanged = () => {
    setMustChangePassword(false);
    localStorage.setItem("must_change_password", "0");
  };

  // isAuthenticated basado SOLO en token (evita parpadeos tras refresh)
  const value = useMemo<AuthCtx>(
    () => ({
      user,
      isAuthenticated: !!getAuthToken(),
      mustChangePassword,
      login,
      logout,
      markPasswordChanged,
    }),
    [user, mustChangePassword]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* =======================
   Hook
   ======================= */
export const useAuth = () => useContext(Ctx);
