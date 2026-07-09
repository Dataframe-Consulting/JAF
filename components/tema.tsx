"use client";

import { useSyncExternalStore } from "react";

type Tema = "dark" | "light";

const OPCIONES: { valor: Tema; label: string }[] = [
  { valor: "dark", label: "Oscuro" },
  { valor: "light", label: "Claro" },
];

/* El tema vive en el atributo data-theme de <html> (lo aplica el script del
   layout raíz antes de pintar). useSyncExternalStore lo lee sin desfasar la
   hidratación: en el servidor se asume oscuro, el default de la marca. */
function suscribir(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}

const leerTema = (): Tema =>
  document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";

export function SelectorTema() {
  const tema = useSyncExternalStore(suscribir, leerTema, () => "dark" as Tema);

  const aplicar = (t: Tema) => {
    if (t === "light") document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
    try {
      localStorage.setItem("jaf-tema", t);
    } catch {}
  };

  return (
    <div
      className="inline-flex rounded-full p-[3px] gap-[2px] text-[12.5px] font-semibold"
      style={{ border: "1px solid var(--line)" }}
      role="radiogroup"
      aria-label="Tema"
    >
      {OPCIONES.map((o) => {
        const activo = tema === o.valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => aplicar(o.valor)}
            className="px-4 py-1.5 rounded-full cursor-pointer transition-colors"
            style={
              activo
                ? { background: "var(--accent)", color: "var(--accent-ink)" }
                : { color: "var(--muted)" }
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
