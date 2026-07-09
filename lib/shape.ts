import type { Scope } from "./data";
import type { Serie } from "@/components/charts";
import { fmtMes } from "./format";

export const SERIE_COLOR: Record<string, string> = {
  Boulevard: "var(--s-boulevard)",
  Andenes: "var(--s-andenes)",
};

export function seriesFor(scope: Scope): Serie[] {
  if (scope === "global") {
    return [
      { key: "Boulevard", color: SERIE_COLOR.Boulevard, label: "Boulevard" },
      { key: "Andenes", color: SERIE_COLOR.Andenes, label: "Andenes" },
    ];
  }
  return [{ key: scope, color: SERIE_COLOR[scope], label: scope }];
}

/**
 * Pivotea filas {sucursal, <xKey>, <valueKey>} a
 * [{ x: "jun 26", Boulevard: n, Andenes: n }] ordenado por x.
 */
export function pivot<T extends Record<string, unknown>>(
  rows: T[],
  xKey: keyof T,
  valueKey: keyof T,
  labelFmt: (x: string) => string = fmtMes
): Record<string, string | number>[] {
  const keys = [...new Set(rows.map((r) => String(r[xKey])))];
  const numeric = keys.every((k) => !Number.isNaN(Number(k)));
  keys.sort(numeric ? (a, b) => Number(a) - Number(b) : undefined);
  return keys.map((k) => {
    const out: Record<string, string | number> = { x: labelFmt(k), xRaw: k };
    for (const r of rows.filter((r) => String(r[xKey]) === k)) {
      out[String(r.sucursal)] = Number(r[valueKey]);
    }
    return out;
  });
}

/** Suma un campo entre sucursales para el mismo x (para KPIs en alcance global). */
export function sumBy<T extends Record<string, unknown>>(
  rows: T[],
  field: keyof T
): number {
  return rows.reduce((acc, r) => acc + Number(r[field] ?? 0), 0);
}

/**
 * Los KPIs del dashboard se anclan a los meses de los datos:
 * el último mes es parcial (el respaldo corta a mitad de mes),
 * así que "último mes completo" = penúltimo mes con datos.
 */
export function mesesClave(meses: string[]): {
  enCurso: string;
  ultimoCompleto: string;
  anterior: string;
} {
  const ordered = [...new Set(meses)].sort();
  const n = ordered.length;
  return {
    enCurso: ordered[n - 1],
    ultimoCompleto: ordered[n - 2],
    anterior: ordered[n - 3],
  };
}

export const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** "2026-06" (URL) → "2026-06-01" (ISO de las vistas); inválido → null. */
export function parseMes(m: string | undefined): string | null {
  if (!m || !/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) return null;
  return `${m}-01`;
}

/** Mes calendario actual como ISO de las vistas ("2026-07-01"). */
export function mesActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Filtro de mes con el presente como default: sin parámetro → mes actual;
 * "todo" → todo el periodo (null); "YYYY-MM" → ese mes.
 */
export function resolverMes(param: string | undefined): string | null {
  if (param === "todo") return null;
  return parseMes(param) ?? mesActual();
}

export function nextMonth(mesIso: string): string {
  const [y, mo] = mesIso.split("-").map(Number);
  return new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 10);
}

export function prevMonth(mesIso: string): string {
  const [y, mo] = mesIso.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 10);
}

/** Mismo mes del año anterior: "2026-06-01" → "2025-06-01". */
export function prevYear(mesIso: string): string {
  const [y] = mesIso.split("-");
  return `${Number(y) - 1}${mesIso.slice(4)}`;
}

/** Variación porcentual vs base; null si no hay base. */
export function deltaPct(actual: number, base: number): number | null {
  return base > 0 ? ((actual - base) / base) * 100 : null;
}

/**
 * Colores por año para los comparativos "vs año": el año en curso lleva el
 * champagne de la marca y los anteriores matices propios (violeta, teal) —
 * nunca el ámbar/azul de las sucursales, que en la misma gráfica significarían
 * otra cosa. CVD validado sobre #171410 (ΔE 42+); el champagne queda fuera de
 * la banda de luminosidad a propósito (acento de marca, con leyenda y gaps).
 */
const PALETA_ANIOS = ["#ded1a9", "#9678cc", "#2fa889", "#8a94a0"];

export function seriesAnios(anios: string[]): Serie[] {
  return anios.map((a, i) => ({
    key: a,
    color: PALETA_ANIOS[Math.min(anios.length - 1 - i, PALETA_ANIOS.length - 1)],
    label: a,
  }));
}

/** "+12.3%" / "−4.1%" para mostrar junto a un KPI. */
export function fmtDelta(pct: number, decimals = 1): string {
  return `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(decimals)}%`;
}
