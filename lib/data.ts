import { supabaseServer } from "./supabase/server";
import { nextMonth } from "./shape";

export type Scope = "global" | "Boulevard" | "Andenes";

export function parseScope(s: string | undefined): Scope {
  if (s === "Boulevard" || s === "Andenes") return s;
  return "global";
}

export const SUCURSALES = ["Boulevard", "Andenes"] as const;

/* ---------- row types (mirror the SQL views) ---------- */

export type MesRow = { sucursal: string; mes: string; ventas: number; monto: number; utilidad: number };
export type DiaRow = { sucursal: string; dia: string; ventas: number; monto: number; utilidad: number };
export type CatRow = { sucursal: string; categoria: string; vendido: number; utilidad: number };
export type ProdRow = { sucursal: string; producto: string; vendido: number; utilidad: number; cantidad: number };
export type MermaMesRow = { sucursal: string; mes: string; costo: number; eventos: number };
export type MermaDiaRow = { sucursal: string; dia: string; costo: number; eventos: number };
export type MermaProdRow = { sucursal: string; producto: string; costo: number; cantidad: number };
export type PagoRow = { sucursal: string; tipo: string; pagos: number; monto: number };
export type CorteRow = { sucursal: string; fecha: string; contado: number; calculado: number; diferencia: number; retiro: number };
export type CorteMesRow = {
  sucursal: string; mes: string; cortes: number; diferencia_total: number;
  sobrantes_100: number; faltantes_100: number; peor: number; mayor: number;
};
export type SemanaRow = { sucursal: string; dow: number; ventas: number; monto: number };
export type HoraRow = { sucursal: string; hora: number; ventas: number; monto: number };
export type ClienteRow = { sucursal: string; cliente: string; ventas: number; monto: number; ultima_compra: string };
export type IdentificadaRow = { sucursal: string; mes: string; identificada: number; anonima: number };
export type TraspasoRutaRow = { mes: string; origen: string; destino: string; traspasos: number; monto: number };
export type CortesiaRow = { sucursal: string; mes: string; concepto: string; monto: number; costo: number; eventos: number };
export type CortesiaDiaRow = { sucursal: string; dia: string; concepto: string; monto: number; costo: number; eventos: number };
export type CreditoRow = { sucursal: string; mes: string; tipo: string; ventas: number; monto: number; utilidad: number };
export type UnidadRow = { sucursal: string; mes: string; unidad: string; monto: number; utilidad: number; tickets: number };
export type CompraMesRow = { mes: string; compras: number; monto: number };
export type CompraProvRow = { proveedor: string; compras: number; monto: number; ultima_compra: string };
export type PrecioCompraRow = {
  mes: string; articulo: string; proveedor: string; unidad: string;
  cantidad: number; importe: number; precio_prom: number | null;
  precio_min: number; precio_max: number; compras: number; ultima_compra: string;
};
export type InventarioDeptoRow = { departamento: string; articulos: number; unidades: number; valor_costo: number; valor_venta: number };
export type VendedorRow = {
  sucursal: string; vendedor: string; ventas: number; monto: number;
  utilidad: number; ultima_venta: string | null;
};
export type VendedorMesRow = { sucursal: string; vendedor: string; mes: string; ventas: number; monto: number; utilidad: number };
export type VendedorProdRow = { sucursal: string; vendedor: string; producto: string; vendido: number; utilidad: number; cantidad: number };
export type StockMinimoRow = { articulo: string; departamento: string; categoria: string; unidad: string; existencia: number; inv_min: number };

/** Mes ISO ("2026-06-01") o null = todo el periodo. */
export type Mes = string | null;

type FetchOpts = {
  order?: { col: string; asc?: boolean };
  limit?: number;
  eq?: Record<string, string>;
  range?: { col: string; desde: string; hastaExcl: string };
};

async function fetchView<T>(view: string, scope: Scope, opts?: FetchOpts): Promise<T[]> {
  const supabase = await supabaseServer();
  let q = supabase.from(view).select("*");
  if (scope !== "global") q = q.eq("sucursal", scope);
  for (const [col, val] of Object.entries(opts?.eq ?? {})) q = q.eq(col, val);
  if (opts?.range) q = q.gte(opts.range.col, opts.range.desde).lt(opts.range.col, opts.range.hastaExcl);
  if (opts?.order) q = q.order(opts.order.col, { ascending: opts.order.asc ?? false });
  // Límite explícito siempre: PostgREST corta en 1000 filas y un corte
  // silencioso significaría cifras incompletas.
  q = q.limit(opts?.limit ?? 500);
  const { data, error } = await q;
  if (error) throw new Error(`${view}: ${error.message}`);
  return (data ?? []) as T[];
}

/** Para vistas donde el "todo el periodo" y el "por mes" viven en vistas distintas. */
function pickView(mes: Mes, agregada: string, mensual: string): { view: string; eq?: Record<string, string> } {
  return mes ? { view: mensual, eq: { mes } } : { view: agregada };
}

/** Trae top-N por sucursal y concatena (evita que el tope global recorte una sucursal). */
async function fetchPerBranch<T>(view: string, scope: Scope, opts: FetchOpts): Promise<T[]> {
  if (scope !== "global") return fetchView<T>(view, scope, opts);
  const per = await Promise.all(SUCURSALES.map((b) => fetchView<T>(view, b, opts)));
  return per.flat();
}

/** Vistas consolidadas sin columna sucursal (compras e inventario: el respaldo trae un solo libro). */
async function fetchConsolidada<T>(view: string, opts?: FetchOpts): Promise<T[]> {
  const supabase = await supabaseServer();
  let q = supabase.from(view).select("*");
  for (const [col, val] of Object.entries(opts?.eq ?? {})) q = q.eq(col, val);
  if (opts?.order) q = q.order(opts.order.col, { ascending: opts.order.asc ?? false });
  q = q.limit(opts?.limit ?? 500);
  const { data, error } = await q;
  if (error) throw new Error(`${view}: ${error.message}`);
  return (data ?? []) as T[];
}

/* ---------- getters ---------- */

export const getVentasMensual = (s: Scope) =>
  fetchView<MesRow>("v_ventas_mensual", s, { order: { col: "mes", asc: true }, limit: 100 });

export const getVentasDiaria = (s: Scope, mes: string) =>
  fetchView<DiaRow>("v_ventas_diaria", s, {
    order: { col: "dia", asc: true },
    limit: 100,
    range: { col: "dia", desde: mes, hastaExcl: nextMonth(mes) },
  });

export function getCategorias(s: Scope, mes: Mes = null) {
  const { view, eq } = pickView(mes, "v_venta_categoria", "v_venta_categoria_mensual");
  return fetchView<CatRow>(view, s, { order: { col: "vendido" }, limit: 200, eq });
}

export function getTopProductos(s: Scope, mes: Mes = null) {
  const { view, eq } = pickView(mes, "v_top_productos", "v_top_productos_mensual");
  return fetchPerBranch<ProdRow>(view, s, { order: { col: "vendido" }, limit: 200, eq });
}

export const getMermaMensual = (s: Scope) =>
  fetchView<MermaMesRow>("v_merma_mensual", s, { order: { col: "mes", asc: true }, limit: 100 });

export const getMermaDiaria = (s: Scope, mes: string) =>
  fetchView<MermaDiaRow>("v_merma_diaria", s, {
    order: { col: "dia", asc: true },
    limit: 100,
    range: { col: "dia", desde: mes, hastaExcl: nextMonth(mes) },
  });

export function getMermaProductos(s: Scope, mes: Mes = null) {
  const { view, eq } = pickView(mes, "v_merma_productos", "v_merma_productos_mensual");
  return fetchPerBranch<MermaProdRow>(view, s, { order: { col: "costo" }, limit: 200, eq });
}

export function getPagos(s: Scope, mes: Mes = null) {
  const { view, eq } = pickView(mes, "v_pagos", "v_pagos_mensual");
  return fetchView<PagoRow>(view, s, { order: { col: "monto" }, limit: 50, eq });
}

export const getCortesMensual = (s: Scope) =>
  fetchView<CorteMesRow>("v_cortes_mensual", s, { order: { col: "mes", asc: true }, limit: 100 });

export function getCortes(s: Scope, mes: Mes = null, n = 30) {
  if (mes) {
    return fetchView<CorteRow>("v_cortes", s, {
      order: { col: "fecha" },
      limit: 150,
      range: { col: "fecha", desde: mes, hastaExcl: nextMonth(mes) },
    });
  }
  return fetchView<CorteRow>("v_cortes", s, { order: { col: "fecha" }, limit: n });
}

export function getSemana(s: Scope, mes: Mes = null) {
  const { view, eq } = pickView(mes, "v_ventas_semana", "v_ventas_semana_mensual");
  return fetchView<SemanaRow>(view, s, { limit: 100, eq });
}

export const getHoras = (s: Scope) =>
  fetchView<HoraRow>("v_ventas_hora", s, { limit: 100 });

export function getClientes(s: Scope, mes: Mes = null) {
  const { view, eq } = pickView(mes, "v_clientes", "v_clientes_mensual");
  return fetchPerBranch<ClienteRow>(view, s, { order: { col: "monto" }, limit: 600, eq });
}

export const getIdentificada = (s: Scope) =>
  fetchView<IdentificadaRow>("v_venta_identificada_mensual", s, {
    order: { col: "mes", asc: true },
    limit: 100,
  });

export async function getTraspasosRutas(mes: Mes = null): Promise<TraspasoRutaRow[]> {
  const supabase = await supabaseServer();
  let q = supabase.from("v_traspasos_ruta_mensual").select("*");
  if (mes) q = q.eq("mes", mes);
  const { data, error } = await q.limit(300);
  if (error) throw new Error(`v_traspasos_ruta_mensual: ${error.message}`);
  return (data ?? []) as TraspasoRutaRow[];
}

export const getCortesias = (s: Scope) =>
  fetchView<CortesiaRow>("v_cortesias_mensual", s, { order: { col: "mes", asc: true }, limit: 300 });

export const getCortesiasDiaria = (s: Scope, mes: string) =>
  fetchView<CortesiaDiaRow>("v_cortesias_diaria", s, {
    order: { col: "dia", asc: true },
    limit: 300,
    range: { col: "dia", desde: mes, hastaExcl: nextMonth(mes) },
  });

export const getCredito = (s: Scope) =>
  fetchView<CreditoRow>("v_ventas_credito_mensual", s, { order: { col: "mes", asc: true }, limit: 200 });

export const getUnidades = (s: Scope) =>
  fetchView<UnidadRow>("v_unidades_negocio_mensual", s, { order: { col: "mes", asc: true }, limit: 2000 });

export const getComprasMensual = () =>
  fetchConsolidada<CompraMesRow>("v_compras_mensual", { order: { col: "mes", asc: true }, limit: 100 });

export function getComprasProveedor(mes: Mes = null) {
  const { view, eq } = pickView(mes, "v_compras_proveedor", "v_compras_proveedor_mensual");
  return fetchConsolidada<CompraProvRow>(view, { order: { col: "monto" }, limit: 300, eq });
}

export function getPreciosCompra(mes: Mes = null) {
  return fetchConsolidada<PrecioCompraRow>("v_precios_compra_mensual", {
    order: { col: "importe" },
    limit: 1000,
    eq: mes ? { mes } : undefined,
  });
}

/** Venta por vendedor; con mes la vista mensual no trae ultima_venta. */
export async function getVentasVendedor(s: Scope, mes: Mes = null): Promise<VendedorRow[]> {
  if (mes) {
    const rows = await fetchPerBranch<VendedorMesRow>("v_ventas_vendedor_mensual", s, {
      order: { col: "monto" },
      limit: 100,
      eq: { mes },
    });
    return rows.map((r) => ({ ...r, ultima_venta: null }));
  }
  return fetchPerBranch<VendedorRow>("v_ventas_vendedor", s, {
    order: { col: "monto" },
    limit: 100,
  });
}

export const getInventarioDepto = () =>
  fetchConsolidada<InventarioDeptoRow>("v_inventario_departamento", {
    order: { col: "valor_costo" },
    limit: 100,
  });

export const getStockMinimo = () =>
  fetchConsolidada<StockMinimoRow>("v_stock_minimo", { order: { col: "existencia", asc: true }, limit: 200 });

/** Lista de meses con datos (para el selector del header). */
export async function getMeses(): Promise<string[]> {
  const rows = await fetchView<{ mes: string }>("v_ventas_mensual", "Andenes", {
    order: { col: "mes", asc: true },
    limit: 100,
  });
  return [...new Set(rows.map((r) => r.mes))];
}

/* ---------- aggregation helpers (scope "global" = suma de sucursales) ---------- */

/** Agrupa filas por una llave sumando los campos numéricos indicados. */
export function rollup<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T,
  numeric: (keyof T)[]
): T[] {
  const map = new Map<unknown, T>();
  for (const row of rows) {
    const k = row[key];
    const acc = map.get(k);
    if (!acc) {
      map.set(k, { ...row });
    } else {
      const rec = acc as Record<string, unknown>;
      for (const f of numeric) {
        rec[f as string] = (rec[f as string] as number) + (row[f] as number);
      }
    }
  }
  return [...map.values()];
}
