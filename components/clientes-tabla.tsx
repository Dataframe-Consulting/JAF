"use client";

import { useState } from "react";
import { fmtMoney, fmtInt, fmtFecha } from "@/lib/format";
import { ClienteDetalle } from "./cliente-detalle";

export type ClienteResumen = {
  cliente: string;
  ventas: number;
  monto: number;
  ticket: number;
  ultima: string;
};

export function ClientesTabla({
  rows,
  scope,
  vacio = "Sin clientes para mostrar.",
}: {
  rows: ClienteResumen[];
  scope: string;
  vacio?: string;
}) {
  const [seleccionado, setSeleccionado] = useState<string | null>(null);

  return (
    <>
      <table className="w-full text-[13px] tnum">
        <thead className="sticky top-0" style={{ background: "var(--surface)" }}>
          <tr
            className="text-left text-[11.5px] uppercase tracking-wider"
            style={{ color: "var(--muted)" }}
          >
            <th className="py-2.5 pr-3 font-semibold">Cliente</th>
            <th className="py-2.5 px-3 font-semibold text-right">Compras</th>
            <th className="py-2.5 px-3 font-semibold text-right">Monto</th>
            <th className="py-2.5 px-3 font-semibold text-right">Ticket prom.</th>
            <th className="py-2.5 pl-3 font-semibold text-right">Última compra</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr
              key={c.cliente}
              onClick={() => setSeleccionado(c.cliente)}
              className="cursor-pointer transition-colors hover:[&>td:first-child]:underline"
              style={{ borderTop: "1px solid var(--line)" }}
            >
              <td className="py-2 pr-3 font-medium" style={{ color: "var(--accent)" }}>
                {c.cliente}
              </td>
              <td className="py-2 px-3 text-right">{fmtInt(c.ventas)}</td>
              <td className="py-2 px-3 text-right font-semibold">{fmtMoney(c.monto)}</td>
              <td className="py-2 px-3 text-right">{fmtMoney(c.ticket)}</td>
              <td className="py-2 pl-3 text-right" style={{ color: "var(--ink-2)" }}>
                {fmtFecha(c.ultima)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center" style={{ color: "var(--muted)" }}>
                {vacio}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {seleccionado && (
        <ClienteDetalle
          key={`${scope}|${seleccionado}`}
          cliente={seleccionado}
          scope={scope}
          onClose={() => setSeleccionado(null)}
        />
      )}
    </>
  );
}
