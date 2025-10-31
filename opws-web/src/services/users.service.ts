// src/services/users.service.ts
import { http } from "../config/api";

export type CreateUserPayload = {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role?: "ADMIN" | "VIEWER";
};

export const UsersApi = {
  create(payload: CreateUserPayload) {
    return http<any>("/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  list() {
    return http<any[]>("/users");
  },

  setActive(id: number, isActive: boolean) {
    return http<any>(`/users/${id}/active`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
  },

  setRole(id: number, role: "ADMIN" | "VIEWER") {
    return http<any>(`/users/${id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
  },

  resetTemp(id: number) {
    return http<any>(`/users/${id}/reset-temp`, { method: "POST" });
  },
};
