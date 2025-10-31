// src/services/auth.service.ts
import { http } from "../config/api";

export type LoginApiResponse =
  | { token: string; user?: any }
  | { access: string; role?: string; mustChangePassword?: boolean; profile?: any };

export const AuthApi = {
  login(identifier: string, password: string) {
    return http<LoginApiResponse>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // 👇 enviamos los tres para compatibilidad con backend viejo o nuevo
      body: JSON.stringify({
        identifier,
        email: identifier,
        username: identifier,
        password,
      }),
    });
  },

  changePassword(currentPassword: string, newPassword: string) {
    return http<{ access: string }>("/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
};
