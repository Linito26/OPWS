import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";

function isAdminRole(user: any): boolean {
  // rol puede venir plano, anidado o normalizado por el AuthContext
  const raw =
    (user?.roleName as string) ??
    (user?.rol as string) ??
    (user?.rol?.nombre as string) ??
    "";
  const rol = String(raw || "").trim().toUpperCase();
  const byPerm = Array.isArray(user?.permisos)
    ? user.permisos.includes("GESTIONAR_USUARIOS")
    : false;

  return rol === "ADMIN" || rol === "ADMINISTRADOR" || byPerm;
}

export default function PageTopBar() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isAdmin = isAdminRole(user);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 rounded-full text-sm ${
      isActive ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"
    }`;

  // Dropdown ADMIN
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setOpen(false), [pathname]); // cerrar al navegar
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node;
      if (!btnRef.current || !menuRef.current) return;
      if (!btnRef.current.contains(t) && !menuRef.current.contains(t)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const adminActive = pathname.startsWith("/admin");

  return (
    <header className="w-full border-b bg-white/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-neutral-900 text-white grid place-items-center text-sm font-bold">
            O
          </span>
          <span className="font-semibold tracking-wide">OPWS</span>
        </div>

        <nav className="flex items-center gap-2">
          <NavLink to="/panel" className={linkClass}>
            Panel
          </NavLink>
          <NavLink to="/sensores" className={linkClass}>
            Sensores
          </NavLink>

          {isAdmin && (
            <div className="relative">
              <button
                ref={btnRef}
                onClick={() => setOpen((s) => !s)}
                className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1 ${
                  adminActive ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                ADMIN
                <svg width="14" height="14" viewBox="0 0 20 20" className="opacity-80">
                  <path d="M5 7l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
              </button>

              {open && (
                <div
                  ref={menuRef}
                  className="absolute right-0 mt-2 w-64 rounded-xl border border-neutral-200 bg-white shadow-lg p-1.5"
                >
                  <div className="px-3 pt-1 pb-2 text-[11px] uppercase tracking-wide text-neutral-500">
                    Configuración
                  </div>

                  <Link
                    to="/admin/usuarios"
                    className="block px-3 py-2 rounded-md text-sm hover:bg-neutral-100"
                  >
                    Gestión de usuarios
                  </Link>
                  <Link
                    to="/admin/usuarios/crear"
                    className="block px-3 py-2 rounded-md text-sm hover:bg-neutral-100"
                  >
                    Crear usuario
                  </Link>
                </div>
              )}
            </div>
          )}

          {isAuthenticated && (
            <button
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
              className="ml-2 px-3 py-1.5 rounded-full text-sm border hover:bg-neutral-100"
            >
              Salir
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
