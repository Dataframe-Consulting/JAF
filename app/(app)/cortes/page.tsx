import { requirePerfil, scopeDe } from "@/lib/auth";
import { getCortesMensual, getCortes, type CorteRow } from "@/lib/data";
import { pivot, seriesFor, sumBy, resolverMes } from "@/lib/shape";
import { fmtCompact, fmtMoney, fmtFecha, fmtInt, fmtMesLargo } from "@/lib/format";
import { Bars } from "@/components/charts";
import { Kpi, Panel, PageTitle, LegendSucursales } from "@/components/ui";

export const revalidate = 300;

const dayLabel = (d: string) => String(Number(d.slice(8, 10)));

function EstadoChip({ diferencia }: { diferencia: number }) {
  const estado =
    diferencia > 100 ? "Sobrante" : diferencia < -100 ? "Faltante" : "Cuadrado";
  const style =
    estado === "Cuadrado"
      ? { background: "var(--accent-soft)", color: "var(--ink-2)" }
      : estado === "Sobrante"
        ? { background: "var(--accent-soft)", color: "var(--accent)" }
        : { background: "rgba(224,101,92,0.16)", color: "var(--bad)" };
  return (
    <span
      className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
      style={style}
    >
      {estado}
    </span>
  );
}

export default async function Cortes({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; m?: string }>;
}) {
  const sp = await searchParams;
  const perfil = await requirePerfil();
  const scope = scopeDe(perfil, sp.s);
  const mes = resolverMes(sp.m);

  const [mensualTodo, cortesRows] = await Promise.all([
    getCortesMensual(scope),
    getCortes(scope, mes, 30),
  ]);

  const mensual = mes ? mensualTodo.filter((r) => r.mes === mes) : mensualTodo;
  const totalCortes = sumBy(mensual, "cortes");
  const difTotal = sumBy(mensual, "diferencia_total");
  const sobrantes = sumBy(mensual, "sobrantes_100");
  const faltantes = sumBy(mensual, "faltantes_100");
  const peor = mensual.length ? Math.min(...mensual.map((r) => r.peor)) : 0;

  // En modo mensual la gráfica es diaria (suma de diferencias por día y sucursal).
  const diariaAgrupada = mes
    ? Object.values(
        cortesRows.reduce<Record<string, { sucursal: string; dia: string; diferencia: number }>>(
          (acc, c: CorteRow) => {
            const dia = c.fecha.slice(0, 10);
            const k = `${c.sucursal}|${dia}`;
            acc[k] ??= { sucursal: c.sucursal, dia, diferencia: 0 };
            acc[k].diferencia += c.diferencia;
            return acc;
          },
          {}
        )
      )
    : [];

  const tabla = [...cortesRows].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).slice(0, 31);
  const series = seriesFor(scope);
  const periodoLabel = mes ? fmtMesLargo(mes) : "periodo completo";
  const sucLabel = scope === "global" ? "ambas sucursales" : `sucursal ${scope}`;

  return (
    <>
      <PageTitle title="Caja y cortes" note={`${sucLabel} · ${periodoLabel}`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Kpi label="Cortes registrados" value={fmtInt(totalCortes)} context={mes ? "en el mes" : "en el periodo"} />
        <Kpi label="Diferencia acumulada" value={fmtCompact(difTotal)} context="contado vs calculado" />
        <Kpi
          label="Fuera de rango"
          value={`${sobrantes + faltantes}`}
          context={`${sobrantes} sobrantes · ${faltantes} faltantes (±$100)`}
        />
        <Kpi label="Peor faltante" value={fmtCompact(peor)} context="en un solo corte" />
      </div>

      <Panel
        title={mes ? `Diferencia diaria en cortes · ${periodoLabel}` : "Diferencia mensual en cortes"}
        subtitle="Suma de (contado − calculado) · lo sano es una línea plana en cero"
        className="mb-5"
      >
        <LegendSucursales scope={scope} />
        {mes ? (
          <Bars
            data={pivot(diariaAgrupada, "dia", "diferencia", dayLabel)}
            xKey="x"
            series={series}
            tickEvery={1}
            height={280}
            zeroLine
          />
        ) : (
          <Bars
            data={pivot(mensualTodo, "mes", "diferencia_total")}
            xKey="x"
            series={series}
            tickEvery={3}
            height={280}
            zeroLine
          />
        )}
      </Panel>

      <Panel
        title={mes ? `Cortes de ${periodoLabel}` : "Últimos cortes"}
        subtitle={mes ? "Todos los cortes del mes seleccionado" : "Los 30 más recientes del alcance seleccionado"}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] tnum">
            <thead>
              <tr
                className="text-left text-[11.5px] uppercase tracking-wider"
                style={{ color: "var(--muted)" }}
              >
                <th className="py-2 pr-3 font-semibold">Fecha</th>
                {scope === "global" && <th className="py-2 px-3 font-semibold">Sucursal</th>}
                <th className="py-2 px-3 font-semibold text-right">Calculado</th>
                <th className="py-2 px-3 font-semibold text-right">Contado</th>
                <th className="py-2 px-3 font-semibold text-right">Diferencia</th>
                <th className="py-2 pl-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {(mes ? [...cortesRows].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)) : tabla).map(
                (c, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                    <td className="py-2 pr-3">{fmtFecha(c.fecha)}</td>
                    {scope === "global" && (
                      <td className="py-2 px-3" style={{ color: "var(--ink-2)" }}>
                        {c.sucursal}
                      </td>
                    )}
                    <td className="py-2 px-3 text-right">{fmtMoney(c.calculado)}</td>
                    <td className="py-2 px-3 text-right">{fmtMoney(c.contado)}</td>
                    <td
                      className="py-2 px-3 text-right font-semibold"
                      style={{
                        color:
                          c.diferencia < -100
                            ? "var(--bad)"
                            : c.diferencia > 100
                              ? "var(--accent)"
                              : "var(--ink)",
                      }}
                    >
                      {fmtMoney(c.diferencia)}
                    </td>
                    <td className="py-2 pl-3">
                      <EstadoChip diferencia={c.diferencia} />
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
