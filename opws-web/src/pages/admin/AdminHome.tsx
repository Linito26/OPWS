// src/pages/admin/AdminHome.tsx
import { Link } from "react-router-dom";

export default function AdminHome() {
  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white/80 backdrop-blur-sm shadow-sm">
      <div className="p-5 sm:p-6 border-b">
        <h3 className="text-lg font-semibold text-neutral-900">Accesos rápidos</h3>
        <p className="text-sm text-neutral-500">Tareas frecuentes de administración.</p>
      </div>

      <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          to="/admin/usuarios/crear"
          className="rounded-xl border border-neutral-200 bg-white/70 p-4 hover:shadow transition"
        >
          <div className="text-sm text-neutral-500">Usuarios</div>
          <div className="mt-1 text-lg font-semibold">Crear usuario</div>
          <p className="mt-1 text-sm text-neutral-500">
            Alta de cuentas con contraseña temporal.
          </p>
        </Link>

        <Link
          to="/admin/usuarios"
          className="rounded-xl border border-neutral-200 bg-white/70 p-4 hover:shadow transition"
        >
          <div className="text-sm text-neutral-500">Usuarios</div>
          <div className="mt-1 text-lg font-semibold">Gestión de usuarios</div>
          <p className="mt-1 text-sm text-neutral-500">
            Estados, roles y política MCP.
          </p>
        </Link>

        {/* Agrega más “tiles” cuando quieras (estaciones, permisos, etc.) */}
      </div>
    </div>
  );
}
