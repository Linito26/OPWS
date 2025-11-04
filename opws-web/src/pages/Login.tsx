// src/pages/Login.tsx
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import bg from "../assets/login-bg.jpg";
import { http } from "../config/api";
import { useAuth } from "../auth/AuthContext";
import { setAuthToken } from "../config/api"; // 👈 IMPORTANTE

type ApiLoginV1 = { token: string; user?: any };
type ApiLoginV2 = { access: string; role?: string; mustChangePassword?: boolean; profile?: any };
type LoginResponse = ApiLoginV1 | ApiLoginV2;

export default function Login() {
  const [identifier, setIdentifier] = useState("admin@opws.test");
  const [password, setPassword] = useState("admin123");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as any;
  const from = location?.state?.from?.pathname || "/panel";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Mandamos ambos campos para compatibilidad v1/v2 del backend
      const payload = { identifier, email: identifier, password };

      const data = await http<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // Unificar el token
      const token = ("access" in data ? data.access : (data as ApiLoginV1).token) as string;

      // 👈 MUY IMPORTANTE: que api.ts conozca el token
      setAuthToken(token);

      // Intentar obtener perfil si no vino
      let user: any = ("user" in data && data.user) || null;
      if (!user) {
        try {
          const me = await http<any>("/auth/me");
          user = (me?.user ?? me) || null;
        } catch {
          user = { nombre: "Usuario", permisos: [] };
        }
      }

      // Mantener tu estado global (AuthContext)
      login(token, user);

      navigate(from, { replace: true });
    } catch (err: any) {
      setError(
        err?.message?.replace(/^HTTP \d+ [\w ]+:\s*/, "") ||
          err?.response?.data?.error ||
          "Error al iniciar sesión"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen w-full relative bg-neutral-900 text-neutral-800"
      style={{ backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center" }}
    >
      <div className="absolute inset-0 bg-black/45" />

      <div className="relative min-h-screen grid place-items-center px-4">
        <div className="transform-gpu origin-center scale-100 md:scale-90 lg:scale-95 xl:scale-[.80] 2xl:scale-[.80] transition-transform">
          <div className="relative w-full max-w-[520px]">
            <div className="relative rounded-xl bg-white/85 backdrop-blur-md shadow-xl p-6 sm:p-7">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-full bg-neutral-900 text-white grid place-items-center font-bold">O</div>
                <div>
                  <div className="text-lg font-semibold tracking-wide">OPWS</div>
                  <div className="text-[11px] text-neutral-500 -mt-0.5">Oil Palm Weather System</div>
                </div>
              </div>

              <h1 className="text-xl font-semibold mb-1.5">Iniciar sesión</h1>
              <p className="text-sm text-neutral-500 mb-4">Accede al panel principal.</p>

              {error && (
                <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              <form onSubmit={onSubmit} autoComplete="on">
                <label className="block text-sm font-medium mb-1" htmlFor="identifier">
                  Usuario o correo
                </label>
                <div className="relative mb-3.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M12 12c2.761 0 5-2.343 5-5s-2.239-5-5-5-5 2.343-5 5 2.239 5 5 5Z" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M21 22c0-4.418-4.03-8-9-8s-9 3.582-9 8" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  </span>
                  <input
                    id="identifier"
                    name="identifier"
                    type="text"
                    autoComplete="username"
                    className="w-full rounded-md border border-neutral-300 pl-10 pr-3 py-2 outline-none focus:ring-2 focus:ring-neutral-900/30"
                    placeholder="usuario o correo"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    autoFocus
                    required
                  />
                </div>

                <label className="block text-sm font-medium mb-1" htmlFor="password">Contraseña</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="10" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M7 10V7a5 5 0 1 1 10 0v3" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  </span>
                  <input
                    id="password"
                    name="password"
                    type={showPass ? "text" : "password"}
                    autoComplete="current-password"
                    className="w-full rounded-md border border-neutral-300 pl-10 pr-24 py-2 outline-none focus:ring-2 focus:ring-neutral-900/30"
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
                  >
                    {showPass ? "Ocultar" : "Mostrar"}
                  </button>
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center justify-center rounded-md bg-emerald-600 hover:bg-emerald-700 
                               text-white font-medium px-5 py-2 shadow-lg focus:outline-none focus:ring-4 
                               focus:ring-emerald-500/30 disabled:opacity-60"
                  >
                    {loading ? "Entrando..." : "Entrar"}
                  </button>
                </div>
              </form>

              <div className="mt-5 flex items-center justify-between text-xs text-neutral-500">
                <span>OPWS • {new Date().getFullYear()}</span>
                <a href="/forgot" className="hover:underline">¿Olvidaste tu contraseña?</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
