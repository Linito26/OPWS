// src/App.tsx
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";

// Públicas / comunes
import Login from "./pages/Login";
import Panel from "./pages/Panel";
import Sensores from "./pages/Sensores";
import PrivateRoute from "./auth/PrivateRoute";
import PageTopBar from "./components/PageTopBar";
import ChangePassword from "./pages/ChangePassword";

// ADMIN
import AdminLayout from "./pages/admin/AdminLayout";
import AdminHome from "./pages/admin/AdminHome";           // portada de admin
import UsuariosList from "./pages/admin/UsuariosList";
import AdminCrearUsuario from "./pages/AdminCrearUsuario"; // si lo moviste a /pages/admin cambia el import

function Landing() {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? "/panel" : "/login"} replace />;
}

function Shell() {
  const { pathname } = useLocation();
  // Oculta la TopBar en login y en la pantalla de cambio de contraseña
  const hideTopBar =
    pathname.startsWith("/login") || pathname.startsWith("/change-password");

  return (
    <>
      {!hideTopBar && <PageTopBar />}
      <Routes>
        {/* Públicas */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />

        {/* Cambio de contraseña: requiere auth pero permite pasar aunque MCP=true
           y NO restringe por rol (allow={[]}) */}
        <Route
          path="/change-password"
          element={
            <PrivateRoute allow={[]} bypassMCP>
              <ChangePassword />
            </PrivateRoute>
          }
        />

        {/* Protegidas (cualquier autenticado; no restringimos rol → allow={[]}) */}
        <Route
          path="/panel"
          element={
            <PrivateRoute allow={[]}>
              <Panel />
            </PrivateRoute>
          }
        />
        <Route
          path="/sensores"
          element={
            <PrivateRoute allow={[]}>
              <Sensores />
            </PrivateRoute>
          }
        />

        {/* ============ ADMIN ============ 
            Sólo ADMIN / ADMINISTRADOR */}
        <Route
          path="/admin"
          element={
            <PrivateRoute allow={["ADMIN", "ADMINISTRADOR"]}>
              <AdminLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<AdminHome />} />
          <Route path="usuarios" element={<UsuariosList />} />
          <Route path="usuarios/crear" element={<AdminCrearUsuario />} />
        </Route>

        {/* compat: si alguien navega a /dashboard lo mandamos a /panel */}
        <Route path="/dashboard" element={<Navigate to="/panel" replace />} />

        {/* 404 → home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return <Shell />;
}
