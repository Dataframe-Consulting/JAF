"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { pivot, seriesFor } from "@/lib/shape";
import type { Scope, VendedorMesRow, VendedorProdRow } from "@/lib/data";
import { fmtMoney, fmtCompact, fmtInt, fmtPct } from "@/lib/format";
import { Bars, HBars } from "./charts";

type Detalle = {
  mensual: VendedorMesRow[];
  productos: VendedorProdRow[];
};

async function cargar(vendedor: string, scope: string): Promise<Detalle> {
  const supabase = supabaseBrowser();
  let mensualQ = supabase.from("v_ventas_vendedor_mensual").select("*").eq("vendedor", vendedor);
  let productosQ = supabase.from("v_vendedor_productos").select("*").eq("vendedor", vendedor);
  if (scope !== "global") {
    mensualQ = mensualQ.eq("sucursal", scope);
    productosQ = productosQ.eq("sucursal", scope);
  }

  const [m, p] = await Promise.all([
    mensualQ.order("mes", { ascending: true }).limit(200),
    productosQ.order("vendido", { ascending: false }).limit(200),
  ]);
  const err = m.error ?? p.error;
  if (err) throw new Error(err.message);
  return {
    mensual: (m.data ?? []) as VendedorMesRow[],
    productos: (p.data ?? []) as VendedorProdRow[],
  };
}

export function VendedorDetalle({
  vendedor,
  scope,
  onClose,
}: {
  vendedor: string;
  scope: string;
  onClose: () => void;
}) {
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    cargar(vendedor, scope)
      .then((d) => vivo && setDetalle(d))
      .catch((e: Error) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [vendedor, scope]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const kpis = useMemo(() => {
    if (!detalle) return null;
    const total = detalle.mensual.reduce((a, r) => a + Number(r.monto), 0);
    const utilidad = detalle.mensual.reduce((a, r) => a + Number(r.utilidad), 0);
    const ventas = detalle.mensual.reduce((a, r) => a + Number(r.ventas), 0);
    const meses = [...new Set(detalle.mensual.map((r) => r.mes))].sort();
    return {
      total,
      ventas,
      ticket: ventas > 0 ? total / ventas : 0,
      margen: total > 0 ? (utilidad / total) * 100 : null,
      desde: meses[0] ?? null,
      hasta: meses[meses.length - 1] ?? null,
    };
  }, [detalle]);

  // El detalle mensual llega por sucursal; el top de productos se re-agrupa
  // aquí porque en alcance global cada sucursal trae su propio renglón.
  const topProductos = useMemo(() => {
    if (!detalle) return [];
    const map = new Map<string, { vendido: number; utilidad: number; cantidad: number }>();
    for (const p of detalle.productos) {
      const acc = map.get(p.producto) ?? { vendido: 0, utilidad: 0, cantidad: 0 };
      acc.vendido += Number(p.vendido);
      acc.utilidad += Number(p.utilidad);
      acc.cantidad += Number(p.cantidad);
      map.set(p.producto, acc);
    }
    return [...map.entries()]
      .sort((a, b) => b[1].vendido - a[1].vendido)
      .slice(0, 8)
      .map(([producto, v]) => ({
        name: producto,
        value: v.vendido,
        extra: `${fmtPct((v.utilidad / v.vendido) * 100, 0)} margen`,
      }));
  }, [detalle]);

  const series = seriesFor(scope as Scope);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.65)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle de ${vendedor}`}
    >
      <div className="card w-full max-w-3xl flex flex-col" style={{ maxHeight: "88vh" }}>
        <div
          className="flex items-start justify-between px-4 sm:px-6 pt-5 pb-4"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <div>
            <h2 className="text-[17px] font-semibold">{vendedor}</h2>
            <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>
              {scope === "global" ? "ambas sucursales" : `sucursal ${scope}`} · historial completo
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="text-[22px] leading-none px-2 py-1 rounded cursor-pointer"
            style={{ color: "var(--muted)" }}
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto px-4 sm:px-6 py-5">
          {error && (
            <p className="text-[13px]" style={{ color: "var(--bad)" }}>
              No se pudo cargar el detalle: {error}
            </p>
          )}
          {!detalle && !error && (
            <p className="text-[13px] py-8 text-center" style={{ color: "var(--muted)" }}>
              Cargando historial…
            </p>
          )}

          {detalle && kpis && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <div className="card px-4 py-3">
                  <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>Total vendido</div>
                  <div className="text-[20px] font-semibold">{fmtCompact(kpis.total)}</div>
                </div>
                <div className="card px-4 py-3">
                  <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>Ventas</div>
                  <div className="text-[20px] font-semibold">{fmtInt(kpis.ventas)}</div>
                </div>
                <div className="card px-4 py-3">
                  <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>Ticket promedio</div>
                  <div className="text-[20px] font-semibold">{fmtMoney(kpis.ticket)}</div>
                </div>
                <div className="card px-4 py-3">
                  <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>Margen bruto</div>
                  <div className="text-[20px] font-semibold">
                    {kpis.margen !== null ? fmtPct(kpis.margen, 0) : "—"}
                  </div>
                </div>
              </div>

              <h3 className="text-[13.5px] font-semibold mb-2">Venta mensual</h3>
              <Bars
                data={pivot(detalle.mensual, "mes", "monto")}
                xKey="x"
                series={series}
                tickEvery={3}
                height={170}
              />

              <div className="mt-5">
                <h3 className="text-[13.5px] font-semibold mb-3">Qué vende</h3>
                <HBars data={topProductos} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
