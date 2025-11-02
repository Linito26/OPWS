import { useEffect, useMemo, useState } from "react";
import { http } from "../../config/api";
import { Link } from "react-router-dom";

type Row = {
  id: number;
  username: string | null;
  nombre: string | null;
  apellido: string | null;
  email: string;
  rol: string | null; // ADMINISTRADOR / VISUALIZADOR
  activo: boolean;
  mustChangePassword: boolean;
  creadoEn?: string;
};

export default function UsuariosList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        // nuestro wrapper ya antepone /api, así que pedimos /users
        const data = await http<Row[]>("/users");
        setRows(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setErr(e?.message || "No se pudo cargar la lista de usuarios.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [
        r.username ?? "",
        r.nombre ?? "",
        r.apellido ?? "",
        r.email ?? "",
        r.rol ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(s)
    );
  }, [rows, q]);

  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white/80 backdrop-blur-sm shadow-sm">
      <div className="p-5 sm:p-6 border-b flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">Usuarios</h3>
          <p className="text-sm text-neutral-500">
            Revisa y administra cuentas del sistema.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, usuario o correo"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 w-64"
          />
          <Link
            to="/admin/usuarios/crear"
            className="rounded-full bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700"
          >
            + Crear usuario
          </Link>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {loading && (
          <div className="text-sm text-neutral-500">Cargando usuarios…</div>
        )}
        {err && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
            {err}
          </div>
        )}
        {!loading && !err && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500 border-b">
                  <th className="py-2 pr-3">Usuario</th>
                  <th className="py-2 pr-3">Nombre</th>
                  <th className="py-2 pr-3">Correo</th>
                  <th className="py-2 pr-3">Rol</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">MCP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-3">{r.username ?? "—"}</td>
                    <td className="py-2 pr-3">
                      {[r.nombre, r.apellido].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="py-2 pr-3">{r.email}</td>
                    <td className="py-2 pr-3">{r.rol ?? "—"}</td>
                    <td className="py-2 pr-3">
                      {r.activo ? (
                        <span className="text-emerald-700">Activo</span>
                      ) : (
                        <span className="text-neutral-500">Inactivo</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {r.mustChangePassword ? "Sí" : "No"}
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-neutral-500">
                      {rows.length ? "Sin coincidencias" : "Sin usuarios"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
