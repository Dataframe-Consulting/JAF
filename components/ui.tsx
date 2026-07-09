import type { ReactNode } from "react";
import Link from "next/link";

export function Kpi({
  label,
  value,
  context,
  delta,
  deltaGood,
}: {
  label: string;
  value: string;
  context?: ReactNode;
  delta?: string;
  deltaGood?: boolean;
}) {
  // El delta llega con signo ("+29.0%" / "−4.1%"); aquí se vuelve flecha + chip
  // de color: verde = mejora, rojo = empeora, independiente de la dirección.
  const baja = delta !== undefined && /^[−-]/.test(delta);
  const deltaNum = delta?.replace(/^[+−-]\s*/, "");
  return (
    <div className="card px-5 py-4">
      <div className="text-[12.5px]" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-0.5">
        <span className="text-[27px] font-semibold leading-tight tracking-tight">{value}</span>
        {delta && (
          <span
            className="inline-flex items-center gap-1 text-[12px] font-bold px-2 py-[3px] rounded-full tnum"
            style={{
              color: deltaGood ? "var(--good)" : "var(--bad)",
              background: deltaGood ? "rgba(79,174,99,0.14)" : "rgba(224,101,92,0.14)",
            }}
          >
            {baja ? "↓" : "↑"} {deltaNum}
          </span>
        )}
      </div>
      {context && (
        <div className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>
          {context}
        </div>
      )}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  /** Controles del panel (p. ej. toggle de vista), alineados arriba a la derecha. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {subtitle && (
            <p className="text-[12.5px] mt-0.5 mb-3" style={{ color: "var(--muted)" }}>
              {subtitle}
            </p>
          )}
        </div>
        {actions}
      </div>
      {!subtitle && <div className="mb-3" />}
      {children}
    </section>
  );
}

/** Toggle de vistas (links con query param: 1 click, compartible, sin estado cliente). */
export function SegmentToggle({
  options,
}: {
  options: { label: string; href: string; active: boolean }[];
}) {
  return (
    <div
      className="inline-flex shrink-0 rounded-full p-[3px] gap-[2px] text-[12px] font-semibold"
      style={{ border: "1px solid var(--line)" }}
    >
      {options.map((o) => (
        <Link
          key={o.label}
          href={o.href}
          className="px-3 py-1 rounded-full whitespace-nowrap transition-colors"
          style={
            o.active
              ? { background: "var(--accent)", color: "var(--accent-ink)" }
              : { color: "var(--muted)" }
          }
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

export function PageTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-5">
      <h1 className="font-display text-[34px] leading-none">{title}</h1>
      {note && (
        <span className="text-[13px]" style={{ color: "var(--muted)" }}>
          {note}
        </span>
      )}
    </div>
  );
}

export function LegendSeries({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex gap-4 text-[12.5px] mb-2" style={{ color: "var(--ink-2)" }}>
      {items.map((s) => (
        <span key={s.label} className="inline-flex items-center gap-1.5">
          <i
            className="w-2.5 h-2.5 rounded-full inline-block"
            style={{ background: s.color }}
          />
          {s.label}
        </span>
      ))}
    </div>
  );
}

export function LegendSucursales({ scope }: { scope: string }) {
  if (scope !== "global") return null;
  return (
    <div className="flex gap-4 text-[12.5px] mb-2" style={{ color: "var(--ink-2)" }}>
      <span className="inline-flex items-center gap-1.5">
        <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--s-boulevard)" }} />
        Boulevard
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--s-andenes)" }} />
        Andenes
      </span>
    </div>
  );
}
