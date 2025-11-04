// src/pages/ChangePassword.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../config/api";
import { useAuth } from "../auth/AuthContext";

type ChangePwdResponse = { ok?: boolean; access: string };

const POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

export default function ChangePassword() {
  const [currentPassword, setCurrent] = useState<string>("");
  const [newPassword, setNewPwd] = useState<string>("");
  const [showCurr, setShowCurr] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { user, login, markPasswordChanged } = useAuth();
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(null);

    if (!POLICY.test(newPassword)) {
      setError("La nueva contraseña debe tener 8+ caracteres, mayúsculas, minúsculas, número y símbolo.");
      return;
    }

    setLoading(true);
    try {
      const data = await http<ChangePwdResponse>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (data?.access) {
        const safeUser = user ?? { id: 0, nombre: "Usuario", permisos: [] };
        login(data.access, safeUser as any);
        markPasswordChanged();
      }

      setOk("Contraseña actualizada correctamente.");
      setTimeout(() => navigate("/panel", { replace: true }), 900);
    } catch (err: any) {
      setError(
        err?.message?.replace(/^HTTP \d+ [\w ]+:\s*/, "") ||
          err?.response?.data?.error ||
          "Error al cambiar contraseña. Verifica la actual y la política."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)]">
      {/* ===== Hero ===== */}
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
                <path d="M4 13c0-5 4-9 10-9h6v6c0 6-4 10-10 10S4 19 4 13Z" stroke="currentColor" strokeWidth="2" />
                <path d="M8 15c1.5-1.5 4-3 7-3" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold leading-tight">Cambiar contraseña</h1>
              <p className="text-white/80 text-sm">Debes actualizar tu contraseña para continuar.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Card ===== */}
      <main className="max-w-6xl mx-auto px-5 sm:px-8 py-8">
        <div className="rounded-2xl border border-neutral-200/80 bg-white/80 backdrop-blur-sm shadow-sm">
          {/* Header */}
          <div className="p-5 sm:p-6 border-b">
            <h3 className="text-lg font-semibold text-neutral-900">Actualiza tu contraseña</h3>
            <p className="text-sm text-neutral-500">
              Mínimo 8 caracteres, mayúscula, minúscula, número y símbolo.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {error && (
              <div className="md:col-span-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </div>
            )}
            {ok && (
              <div className="md:col-span-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                {ok}
              </div>
            )}

            {/* Actual */}
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="currentPassword">
                Contraseña actual / temporal
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="10" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M7 10V7a5 5 0 1 1 10 0v3" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </span>
                <input
                  id="currentPassword"
                  name="currentPassword"
                  type={showCurr ? "text" : "password"}
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-neutral-300 pl-10 pr-24 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                  placeholder="********"
                  value={currentPassword}
                  onChange={(e) => setCurrent(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurr((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
                >
                  {showCurr ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>

            {/* Nueva */}
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="newPassword">
                Nueva contraseña
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="10" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M7 10V7a5 5 0 1 1 10 0v3" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </span>
                <input
                  id="newPassword"
                  name="newPassword"
                  type={showNew ? "text" : "password"}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-neutral-300 pl-10 pr-24 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                  placeholder="8+ caracteres, Mayús/minúscula/número/símbolo"
                  value={newPassword}
                  onChange={(e) => setNewPwd(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNew((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
                >
                  {showNew ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end pt-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 text-sm disabled:opacity-60"
              >
                {loading ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
