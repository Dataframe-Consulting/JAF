"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { fmtMesLargo } from "@/lib/format";
import { cerrarSesion } from "@/app/login/actions";
import type { Perfil } from "@/lib/auth";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/ventas", label: "Ventas y productos" },
  { href: "/compras", label: "Compras" },
  { href: "/resultados", label: "Resultados" },
  { href: "/clientes", label: "Clientes" },
  { href: "/merma", label: "Inventario y merma" },
  { href: "/cortes", label: "Caja y cortes" },
];

const SCOPES = [
  { value: "global", label: "Global" },
  { value: "Boulevard", label: "Boulevard" },
  { value: "Andenes", label: "Andenes" },
];

function buildQs(s: string, m: string): string {
  const p = new URLSearchParams();
  if (s !== "global") p.set("s", s);
  if (m) p.set("m", m);
  const q = p.toString();
  return q ? `?${q}` : "";
}

const chipStyle = {
  border: "1px solid var(--band-line)",
  color: "var(--band-muted)",
} as const;

const selectStyle = {
  background: "transparent",
  color: "var(--band-ink)",
  border: "1px solid var(--band-line)",
} as const;

function IconoEngrane({ size = 17 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function Header({ meses, perfil }: { meses: string[]; perfil: Perfil }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const esEncargado = perfil.rol === "encargado";
  // El encargado no elige sucursal: su alcance lo fija el perfil en el servidor.
  const scope = esEncargado ? "global" : (params.get("s") ?? "global");
  const mes = params.get("m") ?? "";
  const qs = buildQs(scope, mes);
  const ultimo = meses[meses.length - 1];
  // Sin parámetro, las páginas anclan al mes actual: el dropdown lo refleja.
  const mesMostrado = mes || (ultimo ?? "").slice(0, 7);

  const cerrarMenu = () => setMenuAbierto(false);

  return (
    <header
      // Fija al hacer scroll; fondo translúcido + blur para que el contenido
      // que pasa por detrás no se confunda con la barra. z-40: debajo de los
      // modales (z-50/60), encima de todo lo demás.
      className="sticky top-0 z-40 backdrop-blur-md"
      style={{
        background: "var(--band-bg)",
        color: "var(--band-ink)",
        borderBottom: "1px solid var(--band-edge)",
      }}
    >
      <div className="w-full px-4 sm:px-5 lg:px-8 2xl:px-12 py-3 lg:py-5 flex flex-wrap items-center gap-x-3 lg:gap-x-4 gap-y-2.5">
        {/* Hamburguesa: solo móvil; el menú, Configuración y Salir viven adentro. */}
        <button
          type="button"
          onClick={() => setMenuAbierto(!menuAbierto)}
          aria-expanded={menuAbierto}
          aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
          className="lg:hidden order-2 ml-auto p-1.5 -mr-1.5 rounded-lg cursor-pointer"
          style={{ color: "var(--band-ink)" }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {menuAbierto ? (
              <>
                <line x1="5" y1="5" x2="19" y2="19" />
                <line x1="19" y1="5" x2="5" y2="19" />
              </>
            ) : (
              <>
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </>
            )}
          </svg>
        </button>

        <Link href={`/${qs}`} className="order-1 shrink-0 lg:mr-6" aria-label="Inicio" onClick={cerrarMenu}>
          <Image src="/logo-jaf.avif" alt="Solo JAF" width={48} height={33} priority className="logo-jaf" />
        </Link>

        {/* Menú de secciones en la barra: solo desktop (centrado entre logo y filtros). */}
        <nav className="hidden lg:block lg:order-2 lg:flex-1 min-w-0 overflow-x-auto" aria-label="Módulos">
          <div className="flex items-center gap-1 w-max mx-auto">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={`${item.href}${qs}`}
                  className="text-[13px] px-3 py-1.5 rounded-full whitespace-nowrap transition-colors"
                  style={
                    active
                      ? { color: "var(--band-ink)", background: "var(--band-soft)", fontWeight: 600 }
                      : { color: "var(--band-muted)" }
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="order-3 w-full lg:w-auto flex items-center justify-end gap-2 lg:gap-2.5 lg:ml-auto min-w-0">
          <select
            aria-label="Mes"
            value={mesMostrado}
            onChange={(e) => router.push(`${pathname}${buildQs(scope, e.target.value)}`)}
            className="text-[12.5px] font-semibold rounded-full px-3 py-1.5 cursor-pointer max-w-[46vw]"
            style={selectStyle}
          >
            {[...meses].reverse().map((m) => (
              <option key={m} value={m.slice(0, 7)} style={{ color: "#221a15" }}>
                {fmtMesLargo(m)}
                {m === ultimo ? " (en curso)" : ""}
              </option>
            ))}
            <option value="todo" style={{ color: "#221a15" }}>
              Todo el periodo
            </option>
          </select>

          {esEncargado ? (
            <span
              className="text-[12.5px] font-semibold px-4 py-1.5 rounded-full whitespace-nowrap"
              style={chipStyle}
              title="Tu acceso está limitado a esta sucursal"
            >
              <span className="sm:hidden">{perfil.sucursal}</span>
              <span className="hidden sm:inline">Sucursal {perfil.sucursal}</span>
            </span>
          ) : pathname === "/compras" ? (
            // Las compras del respaldo son un solo libro: aquí no hay sucursal que elegir.
            <span
              className="text-[12.5px] font-semibold px-4 py-1.5 rounded-full whitespace-nowrap"
              style={chipStyle}
              title="El respaldo de SICAR trae un solo libro de compras para el negocio"
            >
              <span className="sm:hidden">Consolidado</span>
              <span className="hidden sm:inline">Consolidado · ambas sucursales</span>
            </span>
          ) : (
            // Sucursal: dropdown en todos los tamaños (mismo trato que el selector de mes).
            <select
              aria-label="Sucursal"
              value={scope}
              onChange={(e) => router.push(`${pathname}${buildQs(e.target.value, mes)}`)}
              className="text-[12.5px] font-semibold rounded-full px-3 py-1.5 cursor-pointer"
              style={selectStyle}
            >
              {SCOPES.map((s) => (
                <option key={s.value} value={s.value} style={{ color: "#221a15" }}>
                  {s.label}
                </option>
              ))}
            </select>
          )}

          {/* En móvil, Configuración y Salir viven en el menú hamburguesa. */}
          <Link
            href={`/configuracion${qs}`}
            aria-label="Configuración"
            title="Configuración"
            className="hidden lg:block p-1.5 rounded-full transition-colors"
            style={
              pathname === "/configuracion"
                ? { color: "var(--band-ink)", background: "var(--band-soft)" }
                : { color: "var(--band-muted)" }
            }
          >
            <IconoEngrane />
          </Link>

          <form action={cerrarSesion} className="hidden lg:block">
            <button
              type="submit"
              className="text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full cursor-pointer"
              style={chipStyle}
              title={perfil.nombre}
            >
              Salir
            </button>
          </form>
        </div>

        {/* Panel del menú hamburguesa (móvil): secciones + Configuración + Salir. */}
        {menuAbierto && (
          <nav
            className="lg:hidden w-full order-last grid gap-0.5 pt-2.5 pb-1"
            aria-label="Módulos"
            style={{ borderTop: "1px solid var(--band-edge)" }}
          >
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={`${item.href}${qs}`}
                  onClick={cerrarMenu}
                  className="text-[14px] px-3 py-2.5 rounded-lg"
                  style={
                    active
                      ? { color: "var(--band-ink)", background: "var(--band-soft)", fontWeight: 600 }
                      : { color: "var(--band-muted)" }
                  }
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              href={`/configuracion${qs}`}
              onClick={cerrarMenu}
              className="text-[14px] px-3 py-2.5 rounded-lg inline-flex items-center gap-2"
              style={
                pathname === "/configuracion"
                  ? { color: "var(--band-ink)", background: "var(--band-soft)", fontWeight: 600 }
                  : { color: "var(--band-muted)" }
              }
            >
              <IconoEngrane size={15} />
              Configuración
            </Link>
            <div
              className="flex items-center justify-between px-3 py-2.5 mt-1"
              style={{ borderTop: "1px solid var(--band-edge)" }}
            >
              <span className="text-[12.5px]" style={{ color: "var(--band-muted)" }}>
                {perfil.nombre}
              </span>
              <form action={cerrarSesion}>
                <button
                  type="submit"
                  className="text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full cursor-pointer"
                  style={chipStyle}
                >
                  Salir
                </button>
              </form>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
