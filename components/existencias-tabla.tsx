"use client";

import { useMemo, useState } from "react";
import type { ExistenciaRow } from "@/lib/data";
import { fmtInt, fmtMoney } from "@/lib/format";

const TOPE = 80; // filas visibles sin búsqueda: el buscador da acceso al resto

function normaliza(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

const inputStyle = {
  background: "transparent",
  color: "var(--ink)",
  border: "1px solid var(--line)",
} as const;

export function ExistenciasTabla({ rows, esGlobal }: { rows: ExistenciaRow[]; esGlobal: boolean }) {
  const [query, setQuery] = useState("");

  const filtradas = useMemo(() => {
    const q = normaliza(query.trim());
    const base = q
      ? rows.filter(
          (r) => normaliza(r.articulo).includes(q) || normaliza(r.departamento).includes(q)
        )
      : rows;
    return [...base].sort((a, b) => b.valor_costo - a.valor_costo);
  }, [rows, query]);

  const visibles = filtradas.slice(0, TOPE);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          type="search"
          placeholder="Buscar artículo o departamento…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="text-[13px] rounded-full px-4 py-1.5 flex-1 min-w-[200px] max-w-sm"
          style={inputStyle}
          aria-label="Buscar artículo"
        />
        <span className="text-[12px]" style={{ color: "var(--muted)" }}>
          {filtradas.length > TOPE
            ? `mostrando ${TOPE} de ${fmtInt(filtradas.length)} artículos · afina la búsqueda para ver el resto`
            : `${fmtInt(filtradas.length)} artículo${filtradas.length === 1 ? "" : "s"}`}
        </span>
      </div>
      <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
        <table className="w-full text-[13px] tnum">
          <thead>
            <tr
              className="text-left text-[11.5px] uppercase tracking-wider"
              style={{ color: "var(--muted)" }}
            >
              <th className="py-2 pr-3 font-semibold">Artículo</th>
              <th className="py-2 px-3 font-semibold">Departamento</th>
              {esGlobal && <th className="py-2 px-3 font-semibold">Sucursal</th>}
              <th className="py-2 px-3 font-semibold text-right">Existencia</th>
              <th className="py-2 px-3 font-semibold text-right">Mínimo</th>
              <th className="py-2 pl-3 font-semibold text-right">Valor a costo</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((r) => (
              <tr key={`${r.sucursal}·${r.articulo}`} style={{ borderTop: "1px solid var(--line)" }}>
                <td className="py-2 pr-3">{r.articulo}</td>
                <td className="py-2 px-3" style={{ color: "var(--ink-2)" }}>
                  {r.departamento}
                </td>
                {esGlobal && (
                  <td className="py-2 px-3" style={{ color: "var(--ink-2)" }}>
                    {r.sucursal}
                  </td>
                )}
                <td
                  className="py-2 px-3 text-right font-semibold"
                  style={{ color: r.existencia < 0 ? "var(--bad)" : "var(--ink)" }}
                >
                  {fmtInt(r.existencia)}
                  {r.unidad ? ` ${r.unidad.toLowerCase().slice(0, 2)}` : ""}
                </td>
                <td className="py-2 px-3 text-right" style={{ color: "var(--muted)" }}>
                  {r.inv_min > 0 ? fmtInt(r.inv_min) : "—"}
                </td>
                <td className="py-2 pl-3 text-right" style={{ color: "var(--ink-2)" }}>
                  {fmtMoney(r.valor_costo)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
