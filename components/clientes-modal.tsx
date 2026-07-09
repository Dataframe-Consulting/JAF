"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClienteRow } from "@/lib/data";
import { fmtInt } from "@/lib/format";
import { ClientesTabla } from "./clientes-tabla";

const ANONIMOS = new Set(["Público en General", "(Sin cliente)"]);
const MAYOREO_MIN = 3000; // ticket promedio a partir del cual se considera mayoreo

type SortKey = "monto" | "ventas" | "ticket" | "ultima" | "nombre";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "monto", label: "Mayor compra" },
  { value: "ventas", label: "Más compras" },
  { value: "ticket", label: "Mayor ticket promedio" },
  { value: "ultima", label: "Compra más reciente" },
  { value: "nombre", label: "Nombre (A–Z)" },
];

type Agrupado = {
  cliente: string;
  ventas: number;
  monto: number;
  ticket: number;
  ultima: string;
};

function normaliza(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function ClientesModal({
  rows,
  scope,
  esMes,
}: {
  rows: ClienteRow[];
  scope: string;
  esMes: boolean;
}) {
  const esGlobal = scope === "global";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("monto");
  const [fSucursal, setFSucursal] = useState("todas");
  const [fActividad, setFActividad] = useState("todos");
  const [fTipo, setFTipo] = useState("todos");
  const searchRef = useRef<HTMLInputElement>(null);

  // Fecha de corte de los datos = la compra más reciente registrada.
  const corte = useMemo(
    () => rows.reduce((max, r) => (r.ultima_compra > max ? r.ultima_compra : max), ""),
    [rows]
  );
  const hace90 = useMemo(() => {
    if (!corte) return "";
    const d = new Date(corte);
    d.setDate(d.getDate() - 90);
    return d.toISOString().slice(0, 10);
  }, [corte]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    searchRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const lista = useMemo<Agrupado[]>(() => {
    const base = rows.filter(
      (r) =>
        !ANONIMOS.has(r.cliente) &&
        (fSucursal === "todas" || r.sucursal === fSucursal)
    );
    const map = new Map<string, Agrupado>();
    for (const r of base) {
      const acc = map.get(r.cliente);
      if (!acc) {
        map.set(r.cliente, {
          cliente: r.cliente,
          ventas: r.ventas,
          monto: r.monto,
          ticket: 0,
          ultima: r.ultima_compra,
        });
      } else {
        acc.ventas += r.ventas;
        acc.monto += r.monto;
        if (r.ultima_compra > acc.ultima) acc.ultima = r.ultima_compra;
      }
    }
    let out = [...map.values()].map((c) => ({ ...c, ticket: c.monto / c.ventas }));

    if (query.trim()) {
      const q = normaliza(query.trim());
      out = out.filter((c) => normaliza(c.cliente).includes(q));
    }
    if (fActividad === "activos") out = out.filter((c) => c.ultima >= hace90);
    if (fActividad === "inactivos") out = out.filter((c) => c.ultima < hace90);
    if (fTipo === "mayoreo") out = out.filter((c) => c.ticket >= MAYOREO_MIN);
    if (fTipo === "menudeo") out = out.filter((c) => c.ticket < MAYOREO_MIN);

    out.sort((a, b) => {
      switch (sortBy) {
        case "monto": return b.monto - a.monto;
        case "ventas": return b.ventas - a.ventas;
        case "ticket": return b.ticket - a.ticket;
        case "ultima": return a.ultima < b.ultima ? 1 : -1;
        case "nombre": return a.cliente.localeCompare(b.cliente, "es");
      }
    });
    return out;
  }, [rows, query, sortBy, fSucursal, fActividad, fTipo, hace90]);

  const selectStyle = {
    background: "var(--surface)",
    color: "var(--ink)",
    border: "1px solid var(--line)",
  } as const;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-4 text-[13px] font-semibold px-4 py-2 rounded-full cursor-pointer"
        style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
      >
        Ver todos los clientes
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0, 0, 0, 0.65)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Todos los clientes"
        >
          <div
            className="card w-full max-w-4xl flex flex-col"
            style={{ maxHeight: "85vh" }}
          >
            <div
              className="flex items-center justify-between px-4 sm:px-6 pt-5 pb-4"
              style={{ borderBottom: "1px solid var(--line)" }}
            >
              <div>
                <h2 className="text-[17px] font-semibold">Todos los clientes</h2>
                <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>
                  {fmtInt(lista.length)} clientes identificados
                  {esMes ? " en el mes seleccionado" : ""}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="text-[22px] leading-none px-2 py-1 rounded cursor-pointer"
                style={{ color: "var(--muted)" }}
              >
                ×
              </button>
            </div>

            <div className="flex flex-wrap gap-2 px-4 sm:px-6 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
              <input
                ref={searchRef}
                type="search"
                placeholder="Buscar cliente…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="text-[13px] rounded-full px-4 py-1.5 flex-1 min-w-[180px]"
                style={selectStyle}
              />
              <select
                aria-label="Ordenar por"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="text-[13px] rounded-full px-3 py-1.5 cursor-pointer"
                style={selectStyle}
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    Ordenar: {s.label}
                  </option>
                ))}
              </select>
              {esGlobal && (
                <select
                  aria-label="Sucursal"
                  value={fSucursal}
                  onChange={(e) => setFSucursal(e.target.value)}
                  className="text-[13px] rounded-full px-3 py-1.5 cursor-pointer"
                  style={selectStyle}
                >
                  <option value="todas">Ambas sucursales</option>
                  <option value="Boulevard">Boulevard</option>
                  <option value="Andenes">Andenes</option>
                </select>
              )}
              {!esMes && (
                <select
                  aria-label="Actividad"
                  value={fActividad}
                  onChange={(e) => setFActividad(e.target.value)}
                  className="text-[13px] rounded-full px-3 py-1.5 cursor-pointer"
                  style={selectStyle}
                >
                  <option value="todos">Actividad: todos</option>
                  <option value="activos">Activos (últimos 90 días)</option>
                  <option value="inactivos">Inactivos (+90 días sin comprar)</option>
                </select>
              )}
              <select
                aria-label="Tipo de cliente"
                value={fTipo}
                onChange={(e) => setFTipo(e.target.value)}
                className="text-[13px] rounded-full px-3 py-1.5 cursor-pointer"
                style={selectStyle}
              >
                <option value="todos">Tipo: todos</option>
                <option value="mayoreo">Mayoreo (ticket ≥ $3,000)</option>
                <option value="menudeo">Menudeo (ticket &lt; $3,000)</option>
              </select>
            </div>

            <div className="overflow-y-auto px-4 sm:px-6 pb-5">
              <ClientesTabla
                rows={lista}
                scope={fSucursal !== "todas" ? fSucursal : scope}
                vacio="Ningún cliente coincide con la búsqueda y los filtros."
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
