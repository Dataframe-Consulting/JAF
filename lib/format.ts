const nf = new Intl.NumberFormat("es-MX");

export function fmtInt(n: number): string {
  return nf.format(Math.round(n));
}

export function fmtMoney(n: number): string {
  const v = Math.round(n);
  return (v < 0 ? "−$" : "$") + nf.format(Math.abs(v));
}

export function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${Math.round(abs)}`;
}

export function fmtPct(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}

export const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];
const MESES = MESES_CORTOS;

/** "2026-06-01" -> "jun 26" */
export function fmtMes(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MESES[m - 1]} ${String(y).slice(2)}`;
}

/** "2026-06-01" -> "junio 2026" */
const MESES_LARGO = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
export function fmtMesLargo(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MESES_LARGO[m - 1]} ${y}`;
}

export function fmtFecha(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}
