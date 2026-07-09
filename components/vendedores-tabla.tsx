"use client";

import { useState } from "react";
import { fmtMoney, fmtInt, fmtPct, fmtFecha } from "@/lib/format";
import { VendedorDetalle } from "./vendedor-detalle";

export type VendedorResumen = {
  vendedor: string;
  ventas: number;
  monto: number;
  ticket: number;
  utilidad: number;
  ultima: string | null;
};

export function VendedoresTabla({
  rows,
  scope,
  esMes,
}: {
  rows: VendedorResumen[];
  scope: string;
  /** En vista mensual la última venta no aplica (la vista mensual no la trae). */
  esMes: boolean;
}) {
  const [seleccionado, setSeleccionado] = useState<string | null>(null);

  return (
    <>
      <table className="w-full text-[13px] tnum">
        <thead>
          <tr
            className="text-left text-[11.5px] uppercase tracking-wider"
            style={{ color: "var(--muted)" }}
          >
            <th className="py-2.5 pr-3 font-semibold">Vendedor</th>
            <th className="py-2.5 px-3 font-semibold text-right">Ventas</th>
            <th className="py-2.5 px-3 font-semibold text-right">Monto</th>
            <th className="py-2.5 px-3 font-semibold text-right">Ticket prom.</th>
            <th className="py-2.5 px-3 font-semibold text-right">Utilidad</th>
            <th className="py-2.5 px-3 font-semibold text-right">Margen</th>
            {!esMes && <th className="py-2.5 pl-3 font-semibold text-right">Última venta</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr
              key={v.vendedor}
              onClick={() => setSeleccionado(v.vendedor)}
              className="cursor-pointer transition-colors hover:[&>td:first-child]:underline"
              style={{ borderTop: "1px solid var(--line)" }}
            >
              <td className="py-2 pr-3 font-medium" style={{ color: "var(--accent)" }}>
                {v.vendedor}
              </td>
              <td className="py-2 px-3 text-right">{fmtInt(v.ventas)}</td>
              <td className="py-2 px-3 text-right font-semibold">{fmtMoney(v.monto)}</td>
              <td className="py-2 px-3 text-right">{fmtMoney(v.ticket)}</td>
              <td className="py-2 px-3 text-right">{fmtMoney(v.utilidad)}</td>
              <td className="py-2 px-3 text-right" style={{ color: "var(--ink-2)" }}>
                {v.monto > 0 ? fmtPct((v.utilidad / v.monto) * 100, 0) : "—"}
              </td>
              {!esMes && (
                <td className="py-2 pl-3 text-right" style={{ color: "var(--ink-2)" }}>
                  {v.ultima ? fmtFecha(v.ultima) : "—"}
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={esMes ? 6 : 7} className="py-8 text-center" style={{ color: "var(--muted)" }}>
                Sin ventas con vendedor asignado en este periodo.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {seleccionado && (
        <VendedorDetalle
          key={`${scope}|${seleccionado}`}
          vendedor={seleccionado}
          scope={scope}
          onClose={() => setSeleccionado(null)}
        />
      )}
    </>
  );
}
