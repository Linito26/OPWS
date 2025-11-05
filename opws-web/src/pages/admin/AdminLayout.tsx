// src/pages/admin/AdminLayout.tsx
import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState, createContext, useContext } from "react";
import { useAuth } from "../../auth/AuthContext";

/** Context opcional por si alguna subvista quiere cambiar el título en runtime */
type Header = { title: string; subtitle?: string };
type Ctx = { header: Header; setHeader: (h: Header) => void };
const AdminHeaderCtx = createContext<Ctx>({
  header: { title: "Administración", subtitle: "Gestión del sistema." },
  setHeader: () => {},
});
export const useAdminHeader = () => useContext(AdminHeaderCtx);

/** Deriva título/subtítulo en base a la ruta actual */
function deriveHeader(pathname: string): Header {
  if (/\/admin\/usuarios\/crear/.test(pathname)) {
    return {
      title: "Crear usuario",
      subtitle: "Alta de cuentas tipo ADMIN o VIEWER.",
    };
  }
  if (/\/admin\/usuarios(\/)?$/.test(pathname)) {
    return {
      title: "Gestión de usuarios",
      subtitle: "Revisa y administra cuentas del sistema.",
    };
  }
  if (/\/admin\/estaciones/.test(pathname)) {
    return {
      title: "Configurar estaciones",
      subtitle: "Define la ubicación geográfica de cada estación.",
    };
  }
  return { title: "Administración", subtitle: "Gestión del sistema." };
}

export default function AdminLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  const [header, setHeader] = useState<Header>(() => deriveHeader(pathname));

  // Actualiza automáticamente el título cuando cambias de subruta
  useEffect(() => {
    setHeader(deriveHeader(pathname));
  }, [pathname]);

  const ctxValue = useMemo<Ctx>(() => ({ header, setHeader }), [header]);

  return (
    <AdminHeaderCtx.Provider value={ctxValue}>
      <div className="min-h-[calc(100vh-64px)]">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-r from-emerald-600 via-emerald-500 to-emerald-600" />
          <div
            className="absolute inset-0 opacity-20"
            style={{ backgroundImage: "radial-gradient(transparent 60%, #000 61%)" }}
          />
          <div className="relative px-5 sm:px-8 py-8 text-white">
            <div className="max-w-6xl mx-auto flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-white/20 grid place-items-center backdrop-blur">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 13c0-5 4-9 10-9h6v6c0 6-4 10-10 10S4 19 4 13Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path d="M8 15c1.5-1.5 4-3 7-3" stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold leading-tight">
                  {header.title}
                </h1>
                <p className="text-white/80 text-sm">
                  {header.subtitle} {user?.email ? "" : ""}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Contenido de subrutas */}
        <main className="max-w-6xl mx-auto px-5 sm:px-8 py-8">
          <Outlet />
        </main>
      </div>
    </AdminHeaderCtx.Provider>
  );
}
