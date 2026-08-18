import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "./use-auth";
import type { Role } from "@/convex/constants";

export type { Role };

export function useRole(): Role | undefined {
  const { user } = useAuth();
  return (user?.role as Role | undefined) ?? undefined;
}

export function canWriteRole(role?: Role): boolean {
  return role === "admin" || role === "dispatcher" || role === "operations";
}

export function canAdminRole(role?: Role): boolean {
  return role === "super_admin" || role === "admin";
}

export function useCanWrite(): boolean {
  return canWriteRole(useRole());
}

export function useCanAdmin(): boolean {
  return canAdminRole(useRole());
}

export function useSettings() {
  return useQuery(api.settings.get);
}

export function useTimezone(): string {
  const settings = useSettings();
  return settings?.settings?.timezone ?? "America/Chicago";
}
