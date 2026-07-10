import { requirePerfil, scopeDe } from "@/lib/auth";
import {
  getMermaMensual,
  getMermaDiaria,
  getMermaProductos,
  getVentasMensual,
  getInventarioDepto,
  getStockMinimo,
  getExistencias,
  rollup,
} from "@/lib/data";
import { pivot, seriesFor, sumBy, mesesClave, resolverMes, prevMonth } from "@/lib/shape";
import { fmtCompact, fmtMoney, fmtPct, fmtMesLargo, fmtInt } from "@/lib/format";
import { Bars } from "@/components/charts";
import { ExistenciasTabla } from "@/components/existencias-tabla";
import { Kpi, Panel, PageTitle, LegendSucursales } from "@/components/ui";

export const revalidate = 300;

const dayLabel = (d: string) => String(Number(d.slice(8, 10)));

export default async function Merma({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; m?: string }>;
}) {
  const sp = await searchParams;
  const perfil = await requirePerfil();
  const scope = scopeDe(perfil, sp.s);
  const mes = resolverMes(sp.m);

  const [merma, productos, mensual, diaria, inventario, stockMin, existencias] = await Promise.all([
    getMermaMensual(scope),
    getMermaProductos(scope, mes),
    getVentasMensual(scope),
    mes ? getMermaDiaria(scope, mes) : Promise.resolve([]),
    getInventarioDepto(),
    getStockMinimo(),
    getExistencias(scope),
  ]);

  const mermaRows = mes ? merma.filter((r) => r.mes === mes) : merma;
  const ventaRows = mes ? mensual.filter((r) => r.mes === mes) : mensual;
  const mermaTotal = sumBy(mermaRows, "costo");
  const eventos = sumBy(mermaRows, "eventos");
  const ventaTotal = sumBy(ventaRows, "monto");

  const mermaAnt = mes ? sumBy(merma.filter((r) => r.mes === prevMonth(mes)), "costo") : 0;
  const mermaDelta = mes && mermaAnt > 0 ? ((mermaTotal - mermaAnt) / mermaAnt) * 100 : null;

  const { ultimoCompleto } = mesesClave(merma.map((r) => r.mes));
  const mermaUlt = sumBy(merma.filter((r) => r.mes === ultimoCompleto), "costo");

  const prods = rollup(productos, "producto", ["costo", "cantidad"])
    .sort((a, b) => b.costo - a.costo)
    .slice(0, 12);

  // Inventario: foto al corte de cada respaldo, sumando ambas sucursales (catálogos independientes).
  const invRows = inventario
    .filter((d) => d.articulos > 0 || d.valor_costo !== 0)
    .sort((a, b) => b.valor_costo - a.valor_costo);
  const invCostoTotal = sumBy(invRows, "valor_costo");
  const invVentaTotal = sumBy(invRows, "valor_venta");
  const alertas = stockMin.filter((r) => r.existencia <= r.inv_min);
  const agotados = alertas.filter((r) => r.existencia <= 0).length;

  const series = seriesFor(scope);
  const periodoLabel = mes ? fmtMesLargo(mes) : "periodo completo";
  const sucLabel = scope === "global" ? "ambas sucursales" : `sucursal ${scope}`;

  return (
    <>
      <PageTitle title="Inventario y merma" note={`${sucLabel} · ${periodoLabel}`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Kpi
          label={mes ? `Merma · ${periodoLabel}` : "Merma del periodo"}
          value={fmtCompact(mermaTotal)}
          delta={
            mermaDelta !== null
              ? `${mermaDelta >= 0 ? "+" : "−"}${Math.abs(mermaDelta).toFixed(0)}%`
              : undefined
          }
          deltaGood={(mermaDelta ?? 0) < 0}
          context={mes ? `vs ${fmtMesLargo(prevMonth(mes))}` : "valuada a costo"}
        />
        <Kpi
          label="Merma vs venta"
          value={ventaTotal > 0 ? fmtPct((mermaTotal / ventaTotal) * 100) : "—"}
          context={mes ? "del monto vendido en el mes" : "del monto vendido en el periodo"}
        />
        {mes ? (
          <Kpi label="Eventos de merma" value={fmtInt(eventos)} context="registros en el mes" />
        ) : (
          <Kpi
            label="Último mes completo"
            value={fmtCompact(mermaUlt)}
            context={fmtMesLargo(ultimoCompleto)}
          />
        )}
        <Kpi
          label="Artículos bajo mínimo"
          value={fmtInt(alertas.length)}
          context={
            agotados > 0
              ? `${agotados} agotado${agotados === 1 ? "" : "s"} · detalle abajo`
              : `de ${stockMin.length} con mínimo capturado`
          }
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <Panel
          title="Alertas de stock mínimo"
          subtitle={`${alertas.length} de ${stockMin.length} artículos con mínimo capturado están en o bajo su mínimo`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] tnum">
              <thead>
                <tr
                  className="text-left text-[11.5px] uppercase tracking-wider"
                  style={{ color: "var(--muted)" }}
                >
                  <th className="py-2 pr-3 font-semibold">Artículo</th>
                  <th className="py-2 px-3 font-semibold">Sucursal</th>
                  <th className="py-2 px-3 font-semibold text-right">Existencia</th>
                  <th className="py-2 px-3 font-semibold text-right">Mínimo</th>
                  <th className="py-2 pl-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {stockMin.map((r) => {
                  const alerta = r.existencia <= r.inv_min;
                  const agotado = r.existencia <= 0;
                  return (
                    <tr key={`${r.sucursal}·${r.articulo}`} style={{ borderTop: "1px solid var(--line)" }}>
                      <td className="py-2 pr-3">{r.articulo}</td>
                      <td className="py-2 px-3" style={{ color: "var(--ink-2)" }}>{r.sucursal}</td>
                      <td
                        className="py-2 px-3 text-right font-semibold"
                        style={{ color: alerta ? "var(--bad)" : "var(--ink)" }}
                      >
                        {fmtInt(r.existencia)}
                        {r.unidad ? ` ${r.unidad.toLowerCase().slice(0, 2)}` : ""}
                      </td>
                      <td className="py-2 px-3 text-right" style={{ color: "var(--ink-2)" }}>
                        {fmtInt(r.inv_min)}
                      </td>
                      <td className="py-2 pl-3">
                        <span
                          className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                          style={
                            agotado
                              ? { background: "rgba(224,101,92,0.16)", color: "var(--bad)" }
                              : alerta
                                ? { background: "rgba(224,101,92,0.10)", color: "var(--bad)" }
                                : { background: "var(--accent-soft)", color: "var(--ink-2)" }
                          }
                        >
                          {agotado ? "Agotado" : alerta ? "Bajo mínimo" : "OK"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[12.5px] mt-3" style={{ color: "var(--muted)" }}>
            Solo los artículos con inventario mínimo capturado en SICAR generan alerta. Para cubrir
            todo carnes y mariscos hay que capturar el mínimo en el catálogo del POS.
          </p>
        </Panel>

        <Panel
          title="Inventario actual por departamento"
          subtitle="Foto al corte de los respaldos (jul 2026) · suma de ambas sucursales · los filtros de sucursal y mes no aplican"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] tnum">
              <thead>
                <tr
                  className="text-left text-[11.5px] uppercase tracking-wider"
                  style={{ color: "var(--muted)" }}
                >
                  <th className="py-2 pr-3 font-semibold">Departamento</th>
                  <th className="py-2 px-3 font-semibold text-right">Artículos</th>
                  <th className="py-2 px-3 font-semibold text-right">Valor a costo</th>
                  <th className="py-2 pl-3 font-semibold text-right">Valor a precio venta</th>
                </tr>
              </thead>
              <tbody>
                {invRows.map((d) => (
                  <tr key={d.departamento} style={{ borderTop: "1px solid var(--line)" }}>
                    <td className="py-2 pr-3">{d.departamento}</td>
                    <td className="py-2 px-3 text-right" style={{ color: "var(--ink-2)" }}>
                      {fmtInt(d.articulos)}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold">{fmtMoney(d.valor_costo)}</td>
                    <td className="py-2 pl-3 text-right">{fmtMoney(d.valor_venta)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: "1px solid var(--line)" }}>
                  <td className="py-2 pr-3 font-semibold">Total</td>
                  <td className="py-2 px-3" />
                  <td className="py-2 px-3 text-right font-semibold">{fmtMoney(invCostoTotal)}</td>
                  <td className="py-2 pl-3 text-right font-semibold">{fmtMoney(invVentaTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[12.5px] mt-3" style={{ color: "var(--muted)" }}>
            Existencias negativas (ventas sin entrada registrada) restan al valor: son parte de los
            hallazgos de calidad de datos del diagnóstico.
          </p>
        </Panel>
      </div>

      <Panel
        title="Existencias por artículo"
        subtitle={`Catálogo completo (con o sin mínimo capturado) · foto al corte del respaldo · ${sucLabel} · el filtro de mes no aplica`}
        className="mb-5"
      >
        <ExistenciasTabla rows={existencias} esGlobal={scope === "global"} />
        <p className="text-[12.5px] mt-3" style={{ color: "var(--muted)" }}>
          El mínimo es informativo: sale del campo &quot;Inventario mínimo&quot; del catálogo de
          SICAR ({"—"} = sin capturar). Las alertas viven en el panel de stock mínimo.
        </p>
      </Panel>

      <Panel
        title={mes ? `Merma diaria · ${periodoLabel}` : "Merma mensual a costo"}
        subtitle="Mercancía dada de baja en caja MERMA · sin alerta hoy: la plataforma la haría visible al día"
        className="mb-5"
      >
        <LegendSucursales scope={scope} />
        {mes ? (
          <Bars data={pivot(diaria, "dia", "costo", dayLabel)} xKey="x" series={series} tickEvery={1} height={280} />
        ) : (
          <Bars data={pivot(merma, "mes", "costo")} xKey="x" series={series} tickEvery={3} height={280} />
        )}
      </Panel>

      <Panel title="Productos más mermados" subtitle={`Top 12 por costo · ${periodoLabel}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] tnum">
            <thead>
              <tr
                className="text-left text-[11.5px] uppercase tracking-wider"
                style={{ color: "var(--muted)" }}
              >
                <th className="py-2 pr-3 font-semibold">Producto</th>
                <th className="py-2 px-3 font-semibold text-right">Costo mermado</th>
                <th className="py-2 px-3 font-semibold text-right">% de la merma</th>
                <th className="py-2 pl-3 font-semibold text-right">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {prods.map((p) => (
                <tr key={p.producto} style={{ borderTop: "1px solid var(--line)" }}>
                  <td className="py-2 pr-3">{p.producto}</td>
                  <td className="py-2 px-3 text-right font-semibold">{fmtMoney(p.costo)}</td>
                  <td className="py-2 px-3 text-right">{fmtPct((p.costo / mermaTotal) * 100)}</td>
                  <td className="py-2 pl-3 text-right" style={{ color: "var(--ink-2)" }}>
                    {fmtInt(p.cantidad)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[12.5px] mt-3" style={{ color: "var(--muted)" }}>
          {fmtInt(eventos)} eventos de merma registrados en {mes ? "el mes" : "el periodo"}.
        </p>
      </Panel>
    </>
  );
}
