import { cache } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";
import { parseScope, type Scope } from "./data";

export type Perfil = {
  id: string;
  nombre: string;
  rol: "dueno" | "encargado";
  sucursal: "Boulevard" | "Andenes" | null;
};

/**
 * Perfil del usuario con sesión válida; null si no hay sesión o perfil.
 * cache() lo deduplica dentro de la misma petición (layout + página).
 */
export const getPerfil = cache(async (): Promise<Perfil | null> => {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) return null;
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, nombre, rol, sucursal")
    .eq("id", uid)
    .maybeSingle();
  return (perfil as Perfil | null) ?? null;
});

/** Como getPerfil, pero redirige a /login si no hay sesión o perfil. */
export async function requirePerfil(): Promise<Perfil> {
  const perfil = await getPerfil();
  if (!perfil) redirect("/login");
  return perfil;
}

/** Alcance efectivo: el dueño elige con ?s=; el encargado siempre ve su sucursal. */
export function scopeDe(perfil: Perfil, s: string | undefined): Scope {
  if (perfil.rol === "encargado" && perfil.sucursal) return perfil.sucursal;
  return parseScope(s);
}
