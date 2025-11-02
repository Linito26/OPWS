// src/pages/AdminCrearUsuario.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../config/api";

type RoleUI = "ADMINISTRADOR" | "VISUALIZADOR";
type RoleAPI = "ADMIN" | "VIEWER";

function roleUiToApi(r: RoleUI): RoleAPI {
  return r === "ADMINISTRADOR" ? "ADMIN" : "VIEWER";
}

export default function AdminCrearUsuario() {
  // estado del formulario (UI en español)
  const [username, setUsername] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [rolUI, setRolUI] = useState<RoleUI>("VISUALIZADOR");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    // validación mínima
    if (!email.trim()) {
      setErr("El correo es obligatorio.");
      return;
    }
    if (!nombre.trim() || !apellido.trim()) {
      setErr("Nombre y apellido son obligatorios.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        username: username.trim() || undefined,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        email: email.trim(),
        role: roleUiToApi(rolUI) as RoleAPI, // lo que espera el backend
      };

      await http("/users", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setOk("Usuario creado. Se envió una contraseña temporal al correo.");
      // redirige a la lista
      setTimeout(() => navigate("/admin/usuarios", { replace: true }), 1000);
    } catch (e: any) {
      // intenta extraer mensaje útil
      const msg =
        e?.response?.data?.error ||
        e?.message?.replace(/^HTTP \d+\s+[^\:]+:\s*/, "") ||
        "No se pudo crear el usuario.";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  // IMPORTANTE: este componente NO pinta el hero. Ese lo maneja AdminLayout.
  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white/80 backdrop-blur-sm shadow-sm">
      {/* Header de la tarjeta */}
      <div className="p-5 sm:p-6 border-b">
        <h3 className="text-lg font-semibold text-neutral-900">Datos del usuario</h3>
        <p className="text-sm text-neutral-500">
          Se enviará una contraseña temporal al correo.
        </p>
      </div>

      {/* Formulario */}
      <form
        onSubmit={onSubmit}
        className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {err && (
          <div className="md:col-span-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {err}
          </div>
        )}
        {ok && (
          <div className="md:col-span-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
            {ok}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Usuario (opcional)</label>
          <input
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ej. jdoe"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Correo</label>
          <input
            type="email"
            required
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tucorreo@dominio.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Nombre</label>
          <input
            required
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Apellido</label>
          <input
            required
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
            value={apellido}
            onChange={(e) => setApellido(e.target.value)}
            placeholder="Apellido"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Rol</label>
          <select
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
            value={rolUI}
            onChange={(e) => setRolUI(e.target.value as RoleUI)}
          >
            <option value="VISUALIZADOR">VISUALIZADOR</option>
            <option value="ADMINISTRADOR">ADMINISTRADOR</option>
          </select>
        </div>

        <div className="md:col-span-2 flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 text-sm disabled:opacity-60"
          >
            {loading ? "Creando…" : "Crear usuario"}
          </button>
        </div>
      </form>
    </div>
  );
}
