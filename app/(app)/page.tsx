import Link from "next/link";
import { requirePerfil, scopeDe } from "@/lib/auth";
import {
  getVentasMensual,
  getVentasDiaria,
  getCategorias,
  getMermaMensual,
  getMermaDiaria,
  getCortesMensual,
  getCortes,
  getSemana,
  getTraspasosRutas,
  getStockMinimo,
  rollup,
} from "@/lib/data";
import {
  pivot,
  seriesAnios,
  seriesFor,
  mesesClave,
  sumBy,
  resolverMes,
  prevMonth,
  deltaPct as calcDelta,
  fmtDelta,
  DIAS_SEMANA,
} from "@/lib/shape";
import { fmtCompact, fmtMoney, fmtPct, fmtMesLargo, fmtInt, MESES_CORTOS } from "@/lib/format";
import { Bars, HBars } from "@/components/charts";
import {
  Kpi,
  Panel,
  PageTitle,
  LegendSucursales,
  LegendSeries,
  SegmentToggle,
} from "@/components/ui";

export const revalidate = 300;

const dayLabel = (d: string) => String(Number(d.slice(8, 10)));

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; m?: string; v?: string; a?: string }>;
}) {
  const sp = await searchParams;
  const perfil = await requirePerfil();
  const scope = scopeDe(perfil, sp.s);
  const mes = resolverMes(sp.m);
  const vista = sp.v === "anio" ? "anio" : "mes";

  const [mensual, merma, cortes, categorias, semana, traspasos, stockMin, cortesRecientes] =
    await Promise.all([
      getVentasMensual(scope),
      getMermaMensual(scope),
      getCortesMensual(scope),
      getCategorias(scope, mes),
      getSemana(scope, mes),
      getTraspasosRutas(mes),
      getStockMinimo(),
      getCortes(scope, null, 60),
    ]);

  const { enCurso } = mesesClave(mensual.map((r) => r.mes));
  // El ancla default es el mes EN CURSO: quien entra a diario ve el presente;
  // los meses cerrados quedan a un click en el selector del encabezado.
  const mesAncla = mes ?? enCurso;
  const mesAnt = prevMonth(mesAncla);
  const esParcial = mesAncla === enCurso;

  const [diaria, mermaDiaria] = mes
    ? await Promise.all([getVentasDiaria(scope, mes), getMermaDiaria(scope, mes)])
    : [null, null];

  const rowsDe = (m: string) => mensual.filter((r) => r.mes === m);

  // Mes parcial: comparar contra los MISMOS días del mes anterior (ritmo),
  // nunca contra el mes completo — eso siempre se vería como caída.
  let ultimoDia = 0;
  let ventaMismosDias = 0;
  let mermaMismosDias = 0;
  if (esParcial) {
    const diariaEnCurso = diaria ?? (await getVentasDiaria(scope, enCurso));
    const [diariaAnt, mermaDiariaAnt] = await Promise.all([
      getVentasDiaria(scope, mesAnt),
      getMermaDiaria(scope, mesAnt),
    ]);
    ultimoDia = diariaEnCurso.length
      ? Math.max(...diariaEnCurso.map((r) => Number(r.dia.slice(8, 10))))
      : 0;
    ventaMismosDias = sumBy(
      diariaAnt.filter((r) => Number(r.dia.slice(8, 10)) <= ultimoDia),
      "monto"
    );
    mermaMismosDias = sumBy(
      mermaDiariaAnt.filter((r) => Number(r.dia.slice(8, 10)) <= ultimoDia),
      "costo"
    );
  }

  const nombreAncla = fmtMesLargo(mesAncla) + (esParcial ? ` (al día ${ultimoDia})` : "");

  const ventaAncla = sumBy(rowsDe(mesAncla), "monto");
  const utilAncla = sumBy(rowsDe(mesAncla), "utilidad");
  const numVentasAncla = sumBy(rowsDe(mesAncla), "ventas");
  const ventaBase = esParcial ? ventaMismosDias : sumBy(rowsDe(mesAnt), "monto");
  const deltaVenta = calcDelta(ventaAncla, ventaBase);

  const mermaAncla = sumBy(merma.filter((r) => r.mes === mesAncla), "costo");
  const mermaBase = esParcial
    ? mermaMismosDias
    : sumBy(merma.filter((r) => r.mes === mesAnt), "costo");
  const mermaDelta = calcDelta(mermaAncla, mermaBase);

  const cortesAncla = cortes.filter((r) => r.mes === mesAncla);
  const difAncla = sumBy(cortesAncla, "diferencia_total");
  const desviadosAncla =
    sumBy(cortesAncla, "sobrantes_100") + sumBy(cortesAncla, "faltantes_100");

  // Alertas accionables: stock bajo mínimo y cortes fuera de rango de la última semana.
  const bajoMin = stockMin.filter((r) => r.existencia <= r.inv_min);
  const agotados = bajoMin.filter((r) => r.existencia <= 0).length;
  const fechaTope = cortesRecientes.length
    ? [...cortesRecientes.map((c) => c.fecha)].sort()[cortesRecientes.length - 1]
    : null;
  const hace7 = fechaTope
    ? new Date(new Date(fechaTope).getTime() - 7 * 86400000).toISOString().slice(0, 10)
    : "";
  const cortesFuera = cortesRecientes.filter(
    (c) => c.fecha.slice(0, 10) >= hace7 && Math.abs(c.diferencia) > 100
  );

  const topCats = rollup(categorias, "categoria", ["vendido", "utilidad"])
    .sort((a, b) => b.vendido - a.vendido)
    .slice(0, 6)
    .map((c) => ({
      name: c.categoria,
      value: c.vendido,
      extra: fmtPct((c.utilidad / c.vendido) * 100, 0) + " margen",
    }));

  const semanaData = DIAS_SEMANA.map((d, i) => {
    const rows = semana.filter((r) => r.dow === i + 1);
    const out: Record<string, string | number> = { x: d };
    for (const r of rows) out[r.sucursal] = r.monto;
    return out;
  });

  const rutas = Object.values(
    traspasos.reduce<Record<string, { ruta: string; traspasos: number; monto: number }>>(
      (acc, t) => {
        const k = `${t.origen}→${t.destino}`;
        acc[k] ??= { ruta: k, traspasos: 0, monto: 0 };
        acc[k].traspasos += t.traspasos;
        acc[k].monto += t.monto;
        return acc;
      },
      {}
    )
  ).sort((a, b) => b.monto - a.monto);

  // Vistas de la gráfica principal: el mes ancla día a día (default) o el año
  // ancla mes a mes; ambas comparables contra años anteriores con las pills.
  const anioAncla = mesAncla.slice(0, 4);
  const mensualAnio = mensual.filter((r) => r.mes.slice(0, 4) === anioAncla);

  // Años anteriores con datos comparables (mismo mes en vista mensual; cualquier
  // mes en vista anual) para las pills "vs 2025", "vs 2024".
  const mm = mesAncla.slice(5, 7);
  const aniosPrevios = [
    ...new Set(
      mensual
        .filter((r) =>
          vista === "anio"
            ? r.mes.slice(0, 4) < anioAncla
            : r.mes.slice(5, 7) === mm && r.mes < mesAncla
        )
        .map((r) => r.mes.slice(0, 4))
    ),
  ]
    .sort()
    .reverse();
  const aSel = (sp.a ?? "").split(",").filter((y) => aniosPrevios.includes(y));

  // Comparación vs años anteriores: barras del mismo día del mes, un color por
  // año. Ojo (aceptado): los días de la semana no caen igual entre años.
  let comparacion: { data: Record<string, string | number>[]; series: ReturnType<typeof seriesAnios> } | null = null;
  if (mes && vista === "mes" && aSel.length > 0 && diaria) {
    const previas = new Map(
      await Promise.all(
        aSel.map(async (y) => [y, await getVentasDiaria(scope, `${y}${mes.slice(4)}`)] as const)
      )
    );
    const [y, mo] = mes.split("-").map(Number);
    const diasMes = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const aniosAsc = [...aSel].sort();
    const seriesCmp = seriesAnios([...aniosAsc, String(y)]);
    const sumaDia = (rows: { dia: string; monto: number }[], d: number) =>
      rows
        .filter((r) => Number(r.dia.slice(8, 10)) === d)
        .reduce((a, r) => a + Number(r.monto), 0);
    const data = Array.from({ length: diasMes }, (_, i) => {
      const d = i + 1;
      const fila: Record<string, string | number> = { x: String(d) };
      for (const anio of aniosAsc) fila[anio] = sumaDia(previas.get(anio) ?? [], d);
      if (!esParcial || d <= ultimoDia) fila[String(y)] = sumaDia(diaria, d);
      return fila;
    });
    comparacion = { data, series: seriesCmp };
  }

  // Vista anual comparada: mismo mes, un color por año (todo sale de `mensual`).
  let comparacionAnio: typeof comparacion = null;
  if (vista === "anio" && aSel.length > 0) {
    const aniosAsc = [...aSel].sort();
    const seriesCmp = seriesAnios([...aniosAsc, anioAncla]);
    const data = MESES_CORTOS.map((label, i) => {
      const fila: Record<string, string | number> = { x: label };
      const mm2 = String(i + 1).padStart(2, "0");
      for (const anio of [...aniosAsc, anioAncla]) {
        const rows = mensual.filter((r) => r.mes === `${anio}-${mm2}-01`);
        if (rows.length) fila[anio] = sumBy(rows, "monto");
      }
      return fila;
    });
    comparacionAnio = { data, series: seriesCmp };
  }

  const qsBase = new URLSearchParams();
  if (scope !== "global") qsBase.set("s", scope);
  if (sp.m) qsBase.set("m", sp.m);
  const qs = qsBase.toString() ? `?${qsBase.toString()}` : "";
  const hrefHero = (v: "mes" | "anio", anios: string[]) => {
    const p = new URLSearchParams(qsBase);
    if (v === "anio") p.set("v", "anio");
    if (anios.length) p.set("a", anios.join(","));
    const q = p.toString();
    return q ? `/?${q}` : "/";
  };

  const series = seriesFor(scope);

  return (
    <>
      <PageTitle title="Dashboard ejecutivo" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Kpi
          label={`Venta · ${nombreAncla}`}
          value={fmtCompact(ventaAncla)}
          delta={deltaVenta !== null ? fmtDelta(deltaVenta) : undefined}
          deltaGood={(deltaVenta ?? 0) >= 0}
          context="vs mes anterior"
        />
        <Kpi
          label={`Margen bruto · ${nombreAncla}`}
          value={ventaAncla > 0 ? fmtPct((utilAncla / ventaAncla) * 100) : "—"}
          context={`${fmtCompact(utilAncla)} de utilidad`}
        />
        <Kpi
          label={`Ticket promedio · ${nombreAncla}`}
          value={numVentasAncla > 0 ? fmtMoney(ventaAncla / numVentasAncla) : "—"}
          context={`${fmtInt(numVentasAncla)} ventas`}
        />
        <Kpi
          label={`Merma a costo · ${nombreAncla}`}
          value={fmtCompact(mermaAncla)}
          delta={mermaDelta !== null ? fmtDelta(mermaDelta) : undefined}
          deltaGood={(mermaDelta ?? 0) < 0}
          context={
            esParcial ? `vs mismos días de ${fmtMesLargo(mesAnt)}` : `vs ${fmtMesLargo(mesAnt)}`
          }
        />
      </div>

      <Panel
        title={
          comparacion
            ? `Venta diaria · ${fmtMesLargo(mesAncla)} vs ${aSel.join(", ")}`
            : mes && vista === "mes"
              ? `Venta diaria · ${nombreAncla}`
              : comparacionAnio
                ? `Venta mensual · ${anioAncla} vs ${aSel.join(", ")}`
                : mes
                  ? `Venta mensual · ${anioAncla}`
                  : "Venta mensual · todo el periodo"
        }
        subtitle={
          comparacion
            ? `Mismo día del mes, un color por año · los días de la semana no caen igual entre años${
                scope === "global" ? " · suma de ambas sucursales" : ""
              }`
            : mes && vista === "mes"
              ? scope === "global"
                ? "Comparativo por sucursal · todas las cajas de venta"
                : "Todas las cajas de venta"
              : comparacionAnio
                ? `Mismo mes, un color por año · ${fmtMesLargo(enCurso)} va parcial${
                    scope === "global" ? " · suma de ambas sucursales" : ""
                  }`
                : `${scope === "global" ? "Comparativo por sucursal · " : ""}${fmtMesLargo(enCurso)} va parcial`
        }
        actions={
          mes ? (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {aniosPrevios.map((y) => {
                const activo = aSel.includes(y);
                const nuevos = activo ? aSel.filter((x) => x !== y) : [...aSel, y];
                return (
                  <Link
                    key={y}
                    href={hrefHero(vista, nuevos)}
                    className="text-[12px] font-semibold px-3 py-1 rounded-full whitespace-nowrap transition-colors"
                    style={
                      activo
                        ? { background: "var(--accent)", color: "var(--accent-ink)" }
                        : { border: "1px solid var(--line)", color: "var(--muted)" }
                    }
                  >
                    vs {y}
                  </Link>
                );
              })}
              <SegmentToggle
                options={[
                  { label: "Este mes", href: hrefHero("mes", aSel), active: vista === "mes" },
                  { label: "Este año", href: hrefHero("anio", aSel), active: vista === "anio" },
                ]}
              />
            </div>
          ) : undefined
        }
        className="mb-5"
      >
        {comparacion ? (
          <>
            <LegendSeries items={comparacion.series} />
            <Bars
              data={comparacion.data}
              xKey="x"
              series={comparacion.series}
              tickEvery={1}
              height={280}
            />
          </>
        ) : mes && vista === "mes" && diaria ? (
          <>
            <LegendSucursales scope={scope} />
            <Bars
              data={pivot(diaria, "dia", "monto", dayLabel)}
              xKey="x"
              series={series}
              tickEvery={1}
              height={280}
            />
          </>
        ) : comparacionAnio ? (
          <>
            <LegendSeries items={comparacionAnio.series} />
            <Bars
              data={comparacionAnio.data}
              xKey="x"
              series={comparacionAnio.series}
              tickEvery={1}
              height={280}
            />
          </>
        ) : (
          <>
            <LegendSucursales scope={scope} />
            <Bars
              data={pivot(mes ? mensualAnio : mensual, "mes", "monto")}
              xKey="x"
              series={series}
              tickEvery={mes ? 1 : 3}
              height={280}
            />
          </>
        )}
      </Panel>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <Panel
          title="Top categorías"
          subtitle={`Venta ${mes ? `de ${fmtMesLargo(mesAncla)}` : "acumulada del periodo"} y su margen`}
        >
          <HBars data={topCats} />
        </Panel>
        <div className="grid gap-5 content-start">
          <Panel
            title="Ritmo de la semana"
            subtitle={`Venta por día de la semana · ${mes ? fmtMesLargo(mesAncla) : "periodo completo"}`}
          >
            <LegendSucursales scope={scope} />
            <Bars data={semanaData} xKey="x" series={series} height={222} />
          </Panel>
          <Panel
            title="Alertas de inventario"
            subtitle="Stock bajo mínimo y cortes fuera de rango de la última semana"
          >
            <div className="grid gap-2">
              {bajoMin.length > 0 ? (
                <Link
                  href={`/merma${qs}`}
                  className="text-[13.5px] font-semibold leading-snug hover:underline"
                  style={{ color: "var(--bad)" }}
                >
                  {bajoMin.length} artículo{bajoMin.length === 1 ? "" : "s"} en o bajo su mínimo
                  {agotados > 0 ? ` · ${agotados} agotado${agotados === 1 ? "" : "s"}` : ""} →
                </Link>
              ) : (
                <span className="text-[13.5px]" style={{ color: "var(--ink-2)" }}>
                  Stock sobre mínimos
                </span>
              )}
              {cortesFuera.length > 0 ? (
                <Link
                  href={`/cortes${qs}`}
                  className="text-[13.5px] font-semibold leading-snug hover:underline"
                  style={{ color: "var(--bad)" }}
                >
                  {cortesFuera.length} corte{cortesFuera.length === 1 ? "" : "s"} fuera de rango ·
                  últimos 7 días →
                </Link>
              ) : (
                <span className="text-[13.5px]" style={{ color: "var(--ink-2)" }}>
                  Cortes cuadrados · últimos 7 días
                </span>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <Panel
          title={mes ? `Merma diaria · ${nombreAncla}` : "Merma mensual a costo"}
          subtitle="Mercancía dada de baja en caja MERMA"
        >
          <LegendSucursales scope={scope} />
          {mes && mermaDiaria ? (
            <Bars
              data={pivot(mermaDiaria, "dia", "costo", dayLabel)}
              xKey="x"
              series={series}
              tickEvery={1}
              height={222}
            />
          ) : (
            <Bars
              data={pivot(merma, "mes", "costo")}
              xKey="x"
              series={series}
              tickEvery={3}
              height={222}
            />
          )}
        </Panel>
        <Panel title="Cortes de caja" subtitle={`Resumen de ${nombreAncla}`}>
          <div className="grid grid-cols-2 gap-3">
            <Kpi
              label="Diferencia acumulada"
              value={fmtCompact(difAncla)}
              context="contado vs calculado"
            />
            <Kpi
              label="Cortes fuera de rango"
              value={String(desviadosAncla)}
              context="diferencia mayor a ±$100"
            />
          </div>
          <p className="text-[12.5px] mt-3" style={{ color: "var(--muted)" }}>
            Detalle diario y histórico en el módulo Caja y cortes.
          </p>
        </Panel>
      </div>

      <Panel
        title="Traspasos entre sucursales"
        subtitle={`Mercancía aplicada por ruta · ${mes ? nombreAncla : "periodo completo"} · deduplicado: cada traspaso se cuenta una sola vez y se excluye de venta y compra en el consolidado`}
      >
        {rutas.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>
            Sin traspasos aplicados en este periodo.
          </p>
        ) : (
          <div className="grid sm:grid-cols-3 gap-3">
            {rutas.map((r) => (
              <div
                key={r.ruta}
                className="rounded-lg px-4 py-3"
                style={{ background: "var(--accent-soft)" }}
              >
                <div className="text-[12.5px] font-semibold" style={{ color: "var(--ink-2)" }}>
                  {r.ruta.replace("→", " → ")}
                </div>
                <div className="text-[22px] font-semibold tracking-tight">
                  {fmtCompact(r.monto)}
                </div>
                <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                  {fmtInt(r.traspasos)} traspasos aplicados
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
