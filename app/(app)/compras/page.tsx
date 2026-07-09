import {
  getComprasMensual,
  getComprasProveedor,
  getPreciosCompra,
  type PrecioCompraRow,
} from "@/lib/data";
import { requirePerfil } from "@/lib/auth";
import { pivot, sumBy, resolverMes, prevMonth, deltaPct, fmtDelta } from "@/lib/shape";
import { fmtCompact, fmtMoney, fmtInt, fmtMesLargo, fmtFecha } from "@/lib/format";
import { Bars, HBars } from "@/components/charts";
import { Kpi, Panel, PageTitle } from "@/components/ui";

export const revalidate = 300;

const SERIE_COMPRAS = [{ key: "Compras", color: "var(--accent)", label: "Compras" }];

/** Agrupa renglones de precios por artículo+proveedor (para "todo el periodo"). */
function agruparPrecios(rows: PrecioCompraRow[]): PrecioCompraRow[] {
  const map = new Map<string, PrecioCompraRow>();
  for (const r of rows) {
    const k = `${r.articulo}|${r.proveedor}`;
    const acc = map.get(k);
    if (!acc) {
      map.set(k, { ...r });
    } else {
      acc.cantidad += r.cantidad;
      acc.importe += r.importe;
      acc.compras += r.compras;
      acc.precio_min = Math.min(acc.precio_min, r.precio_min);
      acc.precio_max = Math.max(acc.precio_max, r.precio_max);
      if (r.ultima_compra > acc.ultima_compra) acc.ultima_compra = r.ultima_compra;
      acc.precio_prom = acc.cantidad > 0 ? acc.importe / acc.cantidad : null;
    }
  }
  return [...map.values()];
}

export default async function Compras({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; m?: string }>;
}) {
  const sp = await searchParams;
  await requirePerfil();
  const mes = resolverMes(sp.m);

  const [mensual, proveedores, precios] = await Promise.all([
    getComprasMensual(),
    getComprasProveedor(mes),
    getPreciosCompra(mes),
  ]);

  const filas = mes ? mensual.filter((r) => r.mes === mes) : mensual;
  const compraTotal = sumBy(filas, "monto");
  const numCompras = sumBy(filas, "compras");
  const compraAnt = mes ? sumBy(mensual.filter((r) => r.mes === prevMonth(mes)), "monto") : 0;
  const delta = mes ? deltaPct(compraTotal, compraAnt) : null;

  const provData = [...proveedores]
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 12)
    .map((p) => ({
      name: p.proveedor,
      value: p.monto,
      extra: `${fmtInt(p.compras)} compras · ${compraTotal > 0 ? ((p.monto / compraTotal) * 100).toFixed(1) : "0"}%`,
    }));

  const preciosTabla = (mes ? precios : agruparPrecios(precios))
    .sort((a, b) => b.importe - a.importe)
    .slice(0, 25);

  const periodoLabel = mes ? fmtMesLargo(mes) : "periodo completo";

  return (
    <>
      <PageTitle
        title="Compras y proveedores"
        note={`consolidado ambas sucursales · ${periodoLabel}`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Kpi
          label={mes ? `Compra · ${periodoLabel}` : "Compra del periodo"}
          value={fmtCompact(compraTotal)}
          delta={delta !== null ? fmtDelta(delta) : undefined}
          deltaGood={(delta ?? 0) <= 0}
          context={mes ? `vs ${fmtMesLargo(prevMonth(mes))}` : "sep 2024 – jul 2026"}
        />
        <Kpi label="Compras registradas" value={fmtInt(numCompras)} context={mes ? "en el mes" : "en el periodo"} />
        <Kpi
          label="Proveedores con compra"
          value={fmtInt(proveedores.length)}
          context={mes ? "en el mes" : "en el periodo"}
        />
        <Kpi
          label="Compra promedio"
          value={numCompras > 0 ? fmtMoney(compraTotal / numCompras) : "—"}
          context="por operación"
        />
      </div>

      <Panel
        title="Compra mensual"
        subtitle="El respaldo de SICAR trae un solo libro de compras para el negocio; el selector de sucursal no aplica en este módulo"
        className="mb-5"
      >
        <Bars
          data={pivot(
            mensual.map((r) => ({ ...r, sucursal: "Compras" })),
            "mes",
            "monto"
          )}
          xKey="x"
          series={SERIE_COMPRAS}
          tickEvery={2}
          height={280}
        />
      </Panel>

      <Panel
        title="Compras por proveedor"
        subtitle={`Top 12 por monto · ${periodoLabel} · con % de participación`}
        className="mb-5"
      >
        <HBars data={provData} />
      </Panel>

      <Panel
        title="Precios de compra por artículo y proveedor"
        subtitle={`Top 25 por importe · ${periodoLabel} · precio promedio ponderado por cantidad`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] tnum">
            <thead>
              <tr
                className="text-left text-[11.5px] uppercase tracking-wider"
                style={{ color: "var(--muted)" }}
              >
                <th className="py-2 pr-3 font-semibold">Artículo</th>
                <th className="py-2 px-3 font-semibold">Proveedor</th>
                <th className="py-2 px-3 font-semibold text-right">Cantidad</th>
                <th className="py-2 px-3 font-semibold text-right">Importe</th>
                <th className="py-2 px-3 font-semibold text-right">Precio prom.</th>
                <th className="py-2 px-3 font-semibold text-right">Mín – Máx</th>
                <th className="py-2 pl-3 font-semibold text-right">Última compra</th>
              </tr>
            </thead>
            <tbody>
              {preciosTabla.map((r) => (
                <tr
                  key={`${r.articulo}|${r.proveedor}|${r.mes}`}
                  style={{ borderTop: "1px solid var(--line)" }}
                >
                  <td className="py-2 pr-3">{r.articulo}</td>
                  <td className="py-2 px-3" style={{ color: "var(--ink-2)" }}>
                    {r.proveedor}
                  </td>
                  <td className="py-2 px-3 text-right" style={{ color: "var(--ink-2)" }}>
                    {fmtInt(r.cantidad)}
                    {r.unidad ? ` ${r.unidad.toLowerCase().slice(0, 2)}` : ""}
                  </td>
                  <td className="py-2 px-3 text-right font-semibold">{fmtMoney(r.importe)}</td>
                  <td className="py-2 px-3 text-right">
                    {r.precio_prom !== null ? fmtMoney(r.precio_prom) : "—"}
                  </td>
                  <td className="py-2 px-3 text-right" style={{ color: "var(--ink-2)" }}>
                    {fmtMoney(r.precio_min)} – {fmtMoney(r.precio_max)}
                  </td>
                  <td className="py-2 pl-3 text-right">{fmtFecha(r.ultima_compra)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[12.5px] mt-3" style={{ color: "var(--muted)" }}>
          Un mismo artículo con varios proveedores aparece una vez por proveedor: así se comparan
          los precios pagados. Solo las compras capturadas en SICAR con renglón de artículo entran
          al comparativo.
        </p>
      </Panel>
    </>
  );
}
