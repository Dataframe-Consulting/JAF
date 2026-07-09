import { requirePerfil, scopeDe } from "@/lib/auth";
import {
  getVentasMensual,
  getVentasDiaria,
  getCategorias,
  getTopProductos,
  getPagos,
  getHoras,
  getCredito,
  getVentasVendedor,
  rollup,
} from "@/lib/data";
import Link from "next/link";
import {
  pivot,
  seriesAnios,
  seriesFor,
  mesesClave,
  sumBy,
  resolverMes,
  prevMonth,
  prevYear,
  deltaPct,
  fmtDelta,
} from "@/lib/shape";
import { fmtCompact, fmtMoney, fmtPct, fmtInt, fmtMesLargo, MESES_CORTOS } from "@/lib/format";
import { Bars, HBars } from "@/components/charts";
import { VendedoresTabla } from "@/components/vendedores-tabla";
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

export default async function Ventas({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; m?: string; v?: string; a?: string }>;
}) {
  const sp = await searchParams;
  const perfil = await requirePerfil();
  const scope = scopeDe(perfil, sp.s);
  const mes = resolverMes(sp.m);
  const vista = sp.v === "anio" ? "anio" : "mes";

  const [mensual, categorias, productos, pagos, horas, diaria, credito, vendedores] =
    await Promise.all([
      getVentasMensual(scope),
      getCategorias(scope, mes),
      getTopProductos(scope, mes),
      getPagos(scope, mes),
      mes ? Promise.resolve([]) : getHoras(scope),
      mes ? getVentasDiaria(scope, mes) : Promise.resolve([]),
      getCredito(scope),
      getVentasVendedor(scope, mes),
    ]);

  const filas = mes ? mensual.filter((r) => r.mes === mes) : mensual;
  const ventaTotal = sumBy(filas, "monto");
  const utilTotal = sumBy(filas, "utilidad");
  const numVentas = sumBy(filas, "ventas");

  const cats = rollup(categorias, "categoria", ["vendido", "utilidad"])
    .sort((a, b) => b.vendido - a.vendido)
    .slice(0, 12)
    .map((c) => ({
      name: c.categoria,
      value: c.vendido,
      extra: fmtPct((c.utilidad / c.vendido) * 100, 0) + " margen",
    }));

  const prods = rollup(productos, "producto", ["vendido", "utilidad", "cantidad"])
    .sort((a, b) => b.vendido - a.vendido)
    .slice(0, 15);

  // Venta por vendedor: consolidado entre sucursales; la última venta es la
  // más reciente de cualquiera de las dos.
  const vendUltima = new Map<string, string>();
  for (const v of vendedores) {
    if (!v.ultima_venta) continue;
    const prev = vendUltima.get(v.vendedor);
    if (!prev || v.ultima_venta > prev) vendUltima.set(v.vendedor, v.ultima_venta);
  }
  const vendTabla = rollup(vendedores, "vendedor", ["ventas", "monto", "utilidad"])
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 15)
    .map((v) => ({
      vendedor: v.vendedor,
      ventas: v.ventas,
      monto: v.monto,
      ticket: v.ventas > 0 ? v.monto / v.ventas : 0,
      utilidad: v.utilidad,
      ultima: vendUltima.get(v.vendedor) ?? null,
    }));

  const pagosTotal = sumBy(pagos, "monto");
  const pagosData = rollup(pagos, "tipo", ["pagos", "monto"])
    .sort((a, b) => b.monto - a.monto)
    .map((p) => ({
      name: p.tipo,
      value: p.monto,
      extra: `${fmtPct((p.monto / pagosTotal) * 100)} · ${fmtInt(p.pagos)} pagos`,
    }));

  // Crédito vs contado: la venta es "Crédito" si alguno de sus pagos fue a crédito.
  const creditoFilas = mes ? credito.filter((r) => r.mes === mes) : credito;
  const creditoData = rollup(creditoFilas, "tipo", ["ventas", "monto", "utilidad"]).sort(
    (a, b) => b.monto - a.monto
  );
  const creditoTotal = sumBy(creditoData, "monto");

  const horasData = mes
    ? []
    : pivot(
        horas.filter((r) => r.hora >= 9 && r.hora <= 21),
        "hora",
        "monto",
        (h) => `${h}h`
      );

  const series = seriesFor(scope);
  const periodoLabel = mes ? fmtMesLargo(mes) : "periodo completo";
  const sucLabel = scope === "global" ? "ambas sucursales" : `sucursal ${scope}`;

  // Gráfica principal: el mes ancla día a día (default) o el año ancla mes a
  // mes, ambas comparables contra años anteriores con las pills (igual que el
  // dashboard).
  const { enCurso } = mesesClave(mensual.map((r) => r.mes));
  const mesAncla = mes ?? enCurso;
  const esParcial = mesAncla === enCurso;
  const anioAncla = mesAncla.slice(0, 4);
  const mensualAnio = mensual.filter((r) => r.mes.slice(0, 4) === anioAncla);
  const ultimoDia = diaria.length
    ? Math.max(...diaria.map((r) => Number(r.dia.slice(8, 10))))
    : 0;

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

  // Comparación diaria vs años anteriores: barras del mismo día, un color por año.
  let comparacion: { data: Record<string, string | number>[]; series: ReturnType<typeof seriesAnios> } | null = null;
  if (mes && vista === "mes" && aSel.length > 0 && diaria.length > 0) {
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

  const hrefHero = (v: "mes" | "anio", anios: string[]) => {
    const p = new URLSearchParams();
    if (scope !== "global") p.set("s", scope);
    if (sp.m) p.set("m", sp.m);
    if (v === "anio") p.set("v", "anio");
    if (anios.length) p.set("a", anios.join(","));
    const q = p.toString();
    return q ? `/ventas?${q}` : "/ventas";
  };

  // Delta del KPI de venta: si el mes va parcial, comparar contra los MISMOS
  // días del mes anterior (ritmo) — nunca parcial vs mes completo.
  let delta = mes ? deltaPct(ventaTotal, sumBy(mensual.filter((r) => r.mes === prevMonth(mes)), "monto")) : null;
  let deltaLabel = mes ? `vs ${fmtMesLargo(prevMonth(mes))}` : "";
  let deltaAnio = mes && !esParcial
    ? deltaPct(ventaTotal, sumBy(mensual.filter((r) => r.mes === prevYear(mes)), "monto"))
    : null;
  if (mes && esParcial) {
    const diariaAnt = await getVentasDiaria(scope, prevMonth(mes));
    const mismosDias = sumBy(
      diariaAnt.filter((r) => Number(r.dia.slice(8, 10)) <= ultimoDia),
      "monto"
    );
    delta = deltaPct(ventaTotal, mismosDias);
    deltaLabel = `ritmo vs mismos días de ${fmtMesLargo(prevMonth(mes))}`;
    deltaAnio = null;
  }

  return (
    <>
      <PageTitle title="Ventas y productos" note={`${sucLabel} · ${periodoLabel}`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Kpi
          label={
            mes
              ? `Venta · ${periodoLabel}${esParcial ? ` (al día ${ultimoDia})` : ""}`
              : "Venta del periodo"
          }
          value={fmtCompact(ventaTotal)}
          delta={delta !== null ? fmtDelta(delta) : undefined}
          deltaGood={(delta ?? 0) >= 0}
          context={
            mes ? (
              <>
                {deltaLabel}
                {deltaAnio !== null && (
                  <>
                    <br />
                    {fmtDelta(deltaAnio)} vs {fmtMesLargo(prevYear(mes))}
                  </>
                )}
              </>
            ) : (
              "sep 2024 – jul 2026"
            )
          }
        />
        <Kpi
          label="Utilidad bruta"
          value={fmtCompact(utilTotal)}
          context={
            ventaTotal > 0
              ? `margen ${fmtPct((utilTotal / ventaTotal) * 100)} · costo ${fmtCompact(ventaTotal - utilTotal)}`
              : "—"
          }
        />
        <Kpi label="Ventas" value={fmtInt(numVentas)} context="tickets de mostrador" />
        <Kpi
          label="Ticket promedio"
          value={numVentas > 0 ? fmtMoney(ventaTotal / numVentas) : "—"}
          context={mes ? "del mes" : "del periodo"}
        />
      </div>

      <Panel
        title={
          comparacion
            ? `Venta diaria · ${fmtMesLargo(mesAncla)} vs ${aSel.join(", ")}`
            : mes && vista === "mes"
              ? `Venta diaria · ${periodoLabel}${esParcial ? ` (al día ${ultimoDia})` : ""}`
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
                ? "Comparativo por sucursal"
                : undefined
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
            <Bars data={comparacion.data} xKey="x" series={comparacion.series} tickEvery={1} height={280} />
          </>
        ) : mes && vista === "mes" ? (
          <>
            <LegendSucursales scope={scope} />
            <Bars data={pivot(diaria, "dia", "monto", dayLabel)} xKey="x" series={series} tickEvery={1} height={280} />
          </>
        ) : comparacionAnio ? (
          <>
            <LegendSeries items={comparacionAnio.series} />
            <Bars data={comparacionAnio.data} xKey="x" series={comparacionAnio.series} tickEvery={1} height={280} />
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
        <Panel title="Venta por categoría" subtitle={`Top 12 · ${periodoLabel} · con margen bruto`}>
          <HBars data={cats} />
        </Panel>
        <div className="grid gap-5 content-start">
          <Panel title="Formas de pago" subtitle={`Monto cobrado y % de participación por tipo de pago · ${periodoLabel}`}>
            <HBars data={pagosData} />
          </Panel>
          <Panel
            title="Crédito vs contado"
            subtitle={`Venta, utilidad y % de participación · ${periodoLabel}`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] tnum">
                <thead>
                  <tr
                    className="text-left text-[11.5px] uppercase tracking-wider"
                    style={{ color: "var(--muted)" }}
                  >
                    <th className="py-2 pr-3 font-semibold">Tipo</th>
                    <th className="py-2 px-3 font-semibold text-right">Ventas</th>
                    <th className="py-2 px-3 font-semibold text-right">Monto</th>
                    <th className="py-2 px-3 font-semibold text-right">Utilidad</th>
                    <th className="py-2 pl-3 font-semibold text-right">% del total</th>
                  </tr>
                </thead>
                <tbody>
                  {creditoData.map((c) => (
                    <tr key={c.tipo} style={{ borderTop: "1px solid var(--line)" }}>
                      <td className="py-2 pr-3">{c.tipo}</td>
                      <td className="py-2 px-3 text-right">{fmtInt(c.ventas)}</td>
                      <td className="py-2 px-3 text-right font-semibold">{fmtMoney(c.monto)}</td>
                      <td className="py-2 px-3 text-right">{fmtMoney(c.utilidad)}</td>
                      <td className="py-2 pl-3 text-right">
                        {creditoTotal > 0 ? fmtPct((c.monto / creditoTotal) * 100) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          {!mes && (
            <Panel title="Venta por hora del día" subtitle="Acumulado del periodo, 9:00–21:00">
              <LegendSucursales scope={scope} />
              <Bars data={horasData} xKey="x" series={series} height={180} />
            </Panel>
          )}
        </div>
      </div>

      <Panel
        title="Top productos"
        subtitle={`${periodoLabel} · catálogo normalizado: las variantes del mismo SKU escritas distinto se unifican · cantidad y utilidad/u en la unidad de venta de cada artículo (kg o pieza)`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] tnum">
            <thead>
              <tr
                className="text-left text-[11.5px] uppercase tracking-wider"
                style={{ color: "var(--muted)" }}
              >
                <th className="py-2 pr-3 font-semibold">Producto</th>
                <th className="py-2 px-3 font-semibold text-right">Vendido</th>
                <th className="py-2 px-3 font-semibold text-right">Utilidad</th>
                <th className="py-2 px-3 font-semibold text-right">Margen</th>
                <th className="py-2 px-3 font-semibold text-right">Cantidad</th>
                <th className="py-2 pl-3 font-semibold text-right">Utilidad/u</th>
              </tr>
            </thead>
            <tbody>
              {prods.map((p) => (
                <tr key={p.producto} style={{ borderTop: "1px solid var(--line)" }}>
                  <td className="py-2 pr-3">{p.producto}</td>
                  <td className="py-2 px-3 text-right font-semibold">{fmtMoney(p.vendido)}</td>
                  <td className="py-2 px-3 text-right">{fmtMoney(p.utilidad)}</td>
                  <td className="py-2 px-3 text-right">{fmtPct((p.utilidad / p.vendido) * 100, 0)}</td>
                  <td className="py-2 px-3 text-right" style={{ color: "var(--ink-2)" }}>
                    {fmtInt(p.cantidad)}
                  </td>
                  <td className="py-2 pl-3 text-right" style={{ color: "var(--ink-2)" }}>
                    {p.cantidad > 0 ? fmtMoney(p.utilidad / p.cantidad) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Venta por vendedor"
        subtitle={`Top 15 · ${periodoLabel} · click en un renglón para abrir el detalle · las ventas sin vendedor asignado se agrupan como "Sin vendedor"`}
        className="mt-5"
      >
        <div className="overflow-x-auto">
          <VendedoresTabla rows={vendTabla} scope={scope} esMes={mes !== null} />
        </div>
      </Panel>
    </>
  );
}
