import { requirePerfil, scopeDe } from "@/lib/auth";
import {
  getVentasMensual,
  getMermaMensual,
  getCortesias,
  getCortesiasDiaria,
  getUnidades,
  rollup,
  type MesRow,
  type MermaMesRow,
  type CortesiaRow,
} from "@/lib/data";
import { pivot, seriesFor, sumBy, resolverMes, prevMonth, prevYear } from "@/lib/shape";
import { fmtCompact, fmtMoney, fmtPct, fmtInt, fmtMes, fmtMesLargo } from "@/lib/format";
import { Bars } from "@/components/charts";
import { Kpi, Panel, PageTitle, LegendSucursales, SegmentToggle } from "@/components/ui";

export const revalidate = 300;

const dayLabel = (d: string) => String(Number(d.slice(8, 10)));

/** Estado de resultados de un subconjunto de meses (a costo de mercancía). */
type PL = {
  ventas: number;
  costo: number;
  utilidad: number;
  merma: number;
  cortesias: number;
  publicidad: number;
  consumo: number;
  resultado: number;
};

function plDe(
  mensual: MesRow[],
  merma: MermaMesRow[],
  cortesias: CortesiaRow[],
  incluye: (mes: string) => boolean,
  sucursal?: string
): PL {
  const de = <T extends { mes: string; sucursal: string }>(rows: T[]) =>
    rows.filter((r) => incluye(r.mes) && (!sucursal || r.sucursal === sucursal));
  const v = de(mensual);
  const m = de(merma);
  const c = de(cortesias);
  const ventas = sumBy(v, "monto");
  const utilidad = sumBy(v, "utilidad");
  const costoDe = (concepto: string) =>
    sumBy(c.filter((r) => r.concepto === concepto), "costo");
  const mermaCosto = sumBy(m, "costo");
  const cort = costoDe("Cortesías");
  const pub = costoDe("Publicidad");
  const cons = costoDe("Consumo interno");
  return {
    ventas,
    costo: ventas - utilidad,
    utilidad,
    merma: mermaCosto,
    cortesias: cort,
    publicidad: pub,
    consumo: cons,
    resultado: utilidad - mermaCosto - cort - pub - cons,
  };
}

const LINEAS: { nombre: string; get: (p: PL) => number; fuerte?: boolean }[] = [
  { nombre: "Ventas", get: (p) => p.ventas, fuerte: true },
  { nombre: "Costo de lo vendido", get: (p) => p.costo },
  { nombre: "Utilidad bruta", get: (p) => p.utilidad, fuerte: true },
  { nombre: "Merma", get: (p) => p.merma },
  { nombre: "Cortesías", get: (p) => p.cortesias },
  { nombre: "Publicidad", get: (p) => p.publicidad },
  { nombre: "Consumo interno", get: (p) => p.consumo },
  { nombre: "Resultado", get: (p) => p.resultado, fuerte: true },
];

export default async function Resultados({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; m?: string; v?: string }>;
}) {
  const sp = await searchParams;
  const perfil = await requirePerfil();
  const scope = scopeDe(perfil, sp.s);
  const mes = resolverMes(sp.m);
  // Toggle del P&L: columnas por periodo (default) o una sucursal por columna
  // (solo tiene sentido en alcance global).
  const vistaSuc = sp.v === "suc" && scope === "global";

  const [mensual, merma, cortesias, unidades, cortesiasDia] = await Promise.all([
    getVentasMensual(scope),
    getMermaMensual(scope),
    getCortesias(scope),
    getUnidades(scope),
    mes ? getCortesiasDiaria(scope, mes) : Promise.resolve([]),
  ]);

  const pl = plDe(mensual, merma, cortesias, (m) => (mes ? m === mes : true));

  // Columnas del estado de resultados: mes actual + comparativos, un año por
  // columna, o (toggle) una sucursal por columna sobre el periodo elegido.
  const anios = [...new Set(mensual.map((r) => r.mes.slice(0, 4)))].sort();
  const enPeriodo = (m: string) => (mes ? m === mes : true);
  const plCols = vistaSuc
    ? [
        { label: "Andenes", pl: plDe(mensual, merma, cortesias, enPeriodo, "Andenes") },
        { label: "Boulevard", pl: plDe(mensual, merma, cortesias, enPeriodo, "Boulevard") },
        { label: "Ambas", pl: plDe(mensual, merma, cortesias, enPeriodo) },
      ]
    : (mes
        ? [
            { label: fmtMesLargo(mes), incluye: (m: string) => m === mes },
            { label: fmtMesLargo(prevMonth(mes)), incluye: (m: string) => m === prevMonth(mes) },
            { label: fmtMesLargo(prevYear(mes)), incluye: (m: string) => m === prevYear(mes) },
          ]
        : anios.map((a) => ({ label: a, incluye: (m: string) => m.slice(0, 4) === a }))
      ).map((c) => ({ label: c.label, pl: plDe(mensual, merma, cortesias, c.incluye) }));

  // Andenes solo tiene datos desde sep 2024: en global hay que decirlo, porque
  // los periodos anteriores reflejan únicamente Boulevard.
  const andenesDesde = mensual.filter((r) => r.sucursal === "Andenes").map((r) => r.mes).sort()[0];
  const boulevardDesde = mensual.filter((r) => r.sucursal === "Boulevard").map((r) => r.mes).sort()[0];
  const notaAsimetria =
    scope === "global" && !mes && andenesDesde && boulevardDesde && andenesDesde > boulevardDesde
      ? `Andenes aporta datos desde ${fmtMesLargo(andenesDesde)}; los periodos anteriores reflejan solo Boulevard.`
      : null;

  const hrefPl = (suc: boolean) => {
    const p = new URLSearchParams();
    if (scope !== "global") p.set("s", scope);
    if (sp.m) p.set("m", sp.m);
    if (suc) p.set("v", "suc");
    const q = p.toString();
    return q ? `/resultados?${q}` : "/resultados";
  };

  // Cortesías + publicidad + consumo interno agregados por mes o por día (a costo).
  const cortesiasSerie = Object.values(
    (mes
      ? cortesiasDia.map((r) => ({ sucursal: r.sucursal, x: r.dia, costo: r.costo }))
      : cortesias.map((r) => ({ sucursal: r.sucursal, x: r.mes, costo: r.costo }))
    ).reduce<Record<string, { sucursal: string; x: string; costo: number }>>((acc, r) => {
      const k = `${r.sucursal}|${r.x}`;
      acc[k] ??= { sucursal: r.sucursal, x: r.x, costo: 0 };
      acc[k].costo += Number(r.costo);
      return acc;
    }, {})
  );
  const cortesiasPeriodo = mes ? cortesias.filter((r) => r.mes === mes) : cortesias;
  const desglose = rollup(cortesiasPeriodo, "concepto", ["costo", "eventos"]).sort(
    (a, b) => b.costo - a.costo
  );

  // Participación de cada mes en la venta de su año.
  const porMes = rollup(mensual, "mes", ["monto", "utilidad"]).sort((a, b) =>
    a.mes < b.mes ? -1 : 1
  );
  const totalAnio = new Map<string, number>();
  for (const r of porMes) {
    const y = r.mes.slice(0, 4);
    totalAnio.set(y, (totalAnio.get(y) ?? 0) + r.monto);
  }

  // Unidades de negocio (departamento del catálogo) en el periodo.
  const unidadesPeriodo = mes ? unidades.filter((r) => r.mes === mes) : unidades;
  const porUnidad = rollup(unidadesPeriodo, "unidad", ["monto", "utilidad", "tickets"])
    .filter((u) => u.monto !== 0)
    .sort((a, b) => b.monto - a.monto);
  const ventaUnidades = sumBy(porUnidad, "monto");

  const series = seriesFor(scope);
  const periodoLabel = mes ? fmtMesLargo(mes) : "periodo completo";
  const sucLabel = scope === "global" ? "ambas sucursales" : `sucursal ${scope}`;
  const pct = (n: number) => (pl.ventas > 0 ? fmtPct((n / pl.ventas) * 100) : "—");

  return (
    <>
      <PageTitle title="Estado de resultados" note={`${sucLabel} · ${periodoLabel}`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Kpi label={mes ? `Ventas · ${periodoLabel}` : "Ventas del periodo"} value={fmtCompact(pl.ventas)} context="todas las cajas de venta" />
        <Kpi
          label="Utilidad bruta"
          value={fmtCompact(pl.utilidad)}
          context={pl.ventas > 0 ? `margen ${fmtPct((pl.utilidad / pl.ventas) * 100)}` : "—"}
        />
        <Kpi label="Merma a costo" value={fmtCompact(pl.merma)} context={`${pct(pl.merma)} de la venta`} />
        <Kpi
          label="Resultado"
          value={fmtCompact(pl.resultado)}
          context={`${pct(pl.resultado)} de la venta · antes de gastos operativos`}
        />
      </div>

      <Panel
        title="Estado de resultados con % vertical"
        subtitle={
          vistaSuc
            ? `Una sucursal por columna · ${periodoLabel} · % sobre la venta de cada una`
            : mes
              ? "Mes seleccionado vs mes anterior y mismo mes del año anterior · % sobre la venta de cada periodo"
              : "Un año por columna · % sobre la venta de cada año"
        }
        actions={
          scope === "global" ? (
            <SegmentToggle
              options={[
                { label: mes ? "Comparativo" : "Por año", href: hrefPl(false), active: !vistaSuc },
                { label: "Por sucursal", href: hrefPl(true), active: vistaSuc },
              ]}
            />
          ) : undefined
        }
        className="mb-5"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] tnum">
            <thead>
              <tr
                className="text-left text-[11.5px] uppercase tracking-wider"
                style={{ color: "var(--muted)" }}
              >
                <th className="py-2 pr-3 font-semibold">Concepto</th>
                {plCols.map((c) => (
                  <th key={c.label} className="py-2 px-3 font-semibold text-right">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LINEAS.map((l) => (
                <tr key={l.nombre} style={{ borderTop: "1px solid var(--line)" }}>
                  <td className={`py-2 pr-3 ${l.fuerte ? "font-semibold" : ""}`}>{l.nombre}</td>
                  {plCols.map((c) => {
                    const v = l.get(c.pl);
                    return (
                      <td key={c.label} className="py-2 px-3 text-right whitespace-nowrap">
                        <span className={l.fuerte ? "font-semibold" : ""}>{fmtMoney(v)}</span>{" "}
                        <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                          {c.pl.ventas > 0 ? fmtPct((v / c.pl.ventas) * 100) : "—"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[12.5px] mt-3" style={{ color: "var(--muted)" }}>
          Merma, cortesías, publicidad y consumo interno valuados a costo de la mercancía. El
          resultado es operativo de mercancía: SICAR no registra gastos de operación (nómina,
          renta, energía), así que no se incluyen.
          {notaAsimetria && (
            <>
              {" "}
              <span style={{ color: "var(--ink-2)" }}>{notaAsimetria}</span>
            </>
          )}
        </p>
      </Panel>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <Panel
          title={mes ? `Cortesías y publicidad · diario` : "Cortesías y publicidad · mensual"}
          subtitle="Costo de la mercancía salida por cajas CORTESIAS, PUBLICIDAD y CONSUMO INTERNO"
        >
          <LegendSucursales scope={scope} />
          <Bars
            data={pivot(cortesiasSerie, "x", "costo", mes ? dayLabel : fmtMes)}
            xKey="x"
            series={series}
            tickEvery={mes ? 2 : 3}
            height={240}
          />
          <div className="flex flex-wrap gap-3 mt-3">
            {desglose.map((d) => (
              <div
                key={d.concepto}
                className="rounded-lg px-3 py-2 text-[12.5px]"
                style={{ background: "var(--accent-soft)" }}
              >
                <b>{d.concepto}</b>: {fmtMoney(d.costo)} · {fmtInt(d.eventos)} eventos
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Participación de cada mes en su año"
          subtitle="Venta mensual y % del total del año · histórico completo"
        >
          <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
            <table className="w-full text-[13px] tnum">
              <thead>
                <tr
                  className="text-left text-[11.5px] uppercase tracking-wider"
                  style={{ color: "var(--muted)" }}
                >
                  <th className="py-2 pr-3 font-semibold">Mes</th>
                  <th className="py-2 px-3 font-semibold text-right">Venta</th>
                  <th className="py-2 px-3 font-semibold text-right">Utilidad</th>
                  <th className="py-2 px-3 font-semibold text-right">Margen</th>
                  <th className="py-2 pl-3 font-semibold text-right">% del año</th>
                </tr>
              </thead>
              <tbody>
                {porMes.map((r) => {
                  const anio = totalAnio.get(r.mes.slice(0, 4)) ?? 0;
                  return (
                    <tr key={r.mes} style={{ borderTop: "1px solid var(--line)" }}>
                      <td className="py-2 pr-3">{fmtMes(r.mes)}</td>
                      <td className="py-2 px-3 text-right font-semibold">{fmtMoney(r.monto)}</td>
                      <td className="py-2 px-3 text-right">{fmtMoney(r.utilidad)}</td>
                      <td className="py-2 px-3 text-right" style={{ color: "var(--ink-2)" }}>
                        {r.monto > 0 ? fmtPct((r.utilidad / r.monto) * 100, 0) : "—"}
                      </td>
                      <td className="py-2 pl-3 text-right">
                        {anio > 0 ? fmtPct((r.monto / anio) * 100) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel
        title="Unidades de negocio"
        subtitle={`Venta, costo y utilidad por departamento del catálogo · ${periodoLabel}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] tnum">
            <thead>
              <tr
                className="text-left text-[11.5px] uppercase tracking-wider"
                style={{ color: "var(--muted)" }}
              >
                <th className="py-2 pr-3 font-semibold">Unidad</th>
                <th className="py-2 px-3 font-semibold text-right">Venta</th>
                <th className="py-2 px-3 font-semibold text-right">Costo</th>
                <th className="py-2 px-3 font-semibold text-right">Utilidad</th>
                <th className="py-2 px-3 font-semibold text-right">Margen</th>
                <th className="py-2 px-3 font-semibold text-right">Tickets</th>
                <th className="py-2 pl-3 font-semibold text-right">% de la venta</th>
              </tr>
            </thead>
            <tbody>
              {porUnidad.map((u) => (
                <tr key={u.unidad} style={{ borderTop: "1px solid var(--line)" }}>
                  <td className="py-2 pr-3">{u.unidad}</td>
                  <td className="py-2 px-3 text-right font-semibold">{fmtMoney(u.monto)}</td>
                  <td className="py-2 px-3 text-right">{fmtMoney(u.monto - u.utilidad)}</td>
                  <td className="py-2 px-3 text-right">{fmtMoney(u.utilidad)}</td>
                  <td className="py-2 px-3 text-right" style={{ color: "var(--ink-2)" }}>
                    {u.monto > 0 ? fmtPct((u.utilidad / u.monto) * 100, 0) : "—"}
                  </td>
                  <td className="py-2 px-3 text-right" style={{ color: "var(--ink-2)" }}>
                    {fmtInt(u.tickets)}
                  </td>
                  <td className="py-2 pl-3 text-right">
                    {ventaUnidades > 0 ? fmtPct((u.monto / ventaUnidades) * 100) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[12.5px] mt-3" style={{ color: "var(--muted)" }}>
          Las unidades salen del departamento de cada artículo en SICAR. El POS no tiene ventas
          registradas de food service ni de envíos: cuando se capturen con su departamento, este
          reporte las separa automáticamente.
        </p>
      </Panel>
    </>
  );
}
