"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { pivot, seriesFor } from "@/lib/shape";
import type { Scope } from "@/lib/data";
import { fmtMoney, fmtCompact, fmtInt, fmtFecha, fmtMesLargo } from "@/lib/format";
import { Bars, HBars } from "./charts";

type Ficha = {
  cliente: string;
  telefono: string | null;
  celular: string | null;
  mail: string | null;
  rfc: string | null;
  domicilio: string | null;
  colonia: string | null;
  ciudad: string | null;
  limite_credito: number | null;
  dias_credito: number | null;
};
type MesRow = { sucursal: string; cliente: string; mes: string; ventas: number; monto: number };
type ProdRow = { sucursal: string; cliente: string; producto: string; vendido: number; cantidad: number };
type CompraRow = { sucursal: string; cliente: string; fecha: string; total: number };

type Detalle = {
  ficha: Ficha | null;
  mensual: MesRow[];
  productos: ProdRow[];
  compras: CompraRow[];
};

async function cargar(cliente: string, scope: string): Promise<Detalle> {
  const supabase = supabaseBrowser();
  let mensualQ = supabase.from("v_cliente_ventas_mensual").select("*").eq("cliente", cliente);
  let productosQ = supabase.from("v_cliente_productos").select("*").eq("cliente", cliente);
  let comprasQ = supabase.from("v_cliente_compras").select("*").eq("cliente", cliente);
  if (scope !== "global") {
    mensualQ = mensualQ.eq("sucursal", scope);
    productosQ = productosQ.eq("sucursal", scope);
    comprasQ = comprasQ.eq("sucursal", scope);
  }

  const [f, m, p, c] = await Promise.all([
    supabase.from("v_cliente_ficha").select("*").eq("cliente", cliente).limit(1),
    mensualQ.order("mes", { ascending: true }).limit(100),
    productosQ.order("vendido", { ascending: false }).limit(100),
    comprasQ.order("fecha", { ascending: false }).limit(12),
  ]);
  const err = f.error ?? m.error ?? p.error ?? c.error;
  if (err) throw new Error(err.message);
  return {
    ficha: (f.data?.[0] as Ficha) ?? null,
    mensual: (m.data ?? []) as MesRow[],
    productos: (p.data ?? []) as ProdRow[],
    compras: (c.data ?? []) as CompraRow[],
  };
}

function DatoFicha({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider font-semibold" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      <div className="text-[13px]" style={{ color: "var(--ink)" }}>
        {valor}
      </div>
    </div>
  );
}

export function ClienteDetalle({
  cliente,
  scope,
  onClose,
}: {
  cliente: string;
  scope: string;
  onClose: () => void;
}) {
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    cargar(cliente, scope)
      .then((d) => vivo && setDetalle(d))
      .catch((e: Error) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [cliente, scope]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const kpis = useMemo(() => {
    if (!detalle) return null;
    const total = detalle.mensual.reduce((a, r) => a + r.monto, 0);
    const compras = detalle.mensual.reduce((a, r) => a + r.ventas, 0);
    const meses = [...new Set(detalle.mensual.map((r) => r.mes))].sort();
    return {
      total,
      compras,
      ticket: compras > 0 ? total / compras : 0,
      desde: meses[0] ?? null,
      ultima: detalle.compras[0]?.fecha ?? null,
    };
  }, [detalle]);

  const topProductos = useMemo(() => {
    if (!detalle) return [];
    const map = new Map<string, { vendido: number; cantidad: number }>();
    for (const p of detalle.productos) {
      const acc = map.get(p.producto) ?? { vendido: 0, cantidad: 0 };
      acc.vendido += p.vendido;
      acc.cantidad += p.cantidad;
      map.set(p.producto, acc);
    }
    return [...map.entries()]
      .sort((a, b) => b[1].vendido - a[1].vendido)
      .slice(0, 6)
      .map(([producto, v]) => ({
        name: producto,
        value: v.vendido,
        extra: `${fmtInt(v.cantidad)} u.`,
      }));
  }, [detalle]);

  const ficha = detalle?.ficha;
  const direccion = ficha
    ? [ficha.domicilio, ficha.colonia, ficha.ciudad].filter(Boolean).join(", ")
    : "";
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
      aria-label={`Detalle de ${cliente}`}
    >
      <div className="card w-full max-w-3xl flex flex-col" style={{ maxHeight: "88vh" }}>
        <div
          className="flex items-start justify-between px-4 sm:px-6 pt-5 pb-4"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <div>
            <h2 className="text-[17px] font-semibold">{cliente}</h2>
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
              {(ficha?.telefono || ficha?.celular || ficha?.mail || ficha?.rfc || direccion ||
                (ficha?.limite_credito ?? 0) > 0) && (
                <div
                  className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 rounded-lg px-4 py-3.5 mb-4"
                  style={{ background: "var(--accent-soft)" }}
                >
                  {(ficha?.telefono || ficha?.celular) && (
                    <DatoFicha label="Teléfono" valor={ficha.telefono ?? ficha.celular ?? ""} />
                  )}
                  {ficha?.mail && <DatoFicha label="Correo" valor={ficha.mail} />}
                  {ficha?.rfc && <DatoFicha label="RFC" valor={ficha.rfc} />}
                  {direccion && <DatoFicha label="Dirección" valor={direccion} />}
                  {(ficha?.limite_credito ?? 0) > 0 && (
                    <DatoFicha
                      label="Crédito"
                      valor={`${fmtMoney(ficha!.limite_credito!)} · ${ficha!.dias_credito ?? 0} días`}
                    />
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <div className="card px-4 py-3">
                  <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>Total comprado</div>
                  <div className="text-[20px] font-semibold">{fmtCompact(kpis.total)}</div>
                </div>
                <div className="card px-4 py-3">
                  <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>Compras</div>
                  <div className="text-[20px] font-semibold">{fmtInt(kpis.compras)}</div>
                </div>
                <div className="card px-4 py-3">
                  <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>Ticket promedio</div>
                  <div className="text-[20px] font-semibold">{fmtMoney(kpis.ticket)}</div>
                </div>
                <div className="card px-4 py-3">
                  <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>Cliente desde</div>
                  <div className="text-[20px] font-semibold">
                    {kpis.desde ? fmtMesLargo(kpis.desde) : "—"}
                  </div>
                </div>
              </div>

              <h3 className="text-[13.5px] font-semibold mb-2">Compra mensual</h3>
              <Bars
                data={pivot(detalle.mensual, "mes", "monto")}
                xKey="x"
                series={series}
                tickEvery={3}
                height={170}
              />

              <div className="grid sm:grid-cols-2 gap-6 mt-5">
                <div>
                  <h3 className="text-[13.5px] font-semibold mb-3">Qué compra</h3>
                  <HBars data={topProductos} />
                </div>
                <div>
                  <h3 className="text-[13.5px] font-semibold mb-2">Últimas compras</h3>
                  <table className="w-full text-[12.5px] tnum">
                    <tbody>
                      {detalle.compras.map((c, i) => (
                        <tr key={i} style={{ borderTop: i ? "1px solid var(--line)" : undefined }}>
                          <td className="py-1.5 pr-2">{fmtFecha(c.fecha)}</td>
                          {scope === "global" && (
                            <td className="py-1.5 px-2" style={{ color: "var(--muted)" }}>
                              {c.sucursal}
                            </td>
                          )}
                          <td className="py-1.5 pl-2 text-right font-semibold">
                            {fmtMoney(c.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
