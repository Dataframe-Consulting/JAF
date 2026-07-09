import { requirePerfil, scopeDe } from "@/lib/auth";
import { getClientes, getIdentificada, getPagos, rollup } from "@/lib/data";
import { resolverMes, sumBy } from "@/lib/shape";
import { fmtCompact, fmtPct, fmtMesLargo, fmtInt, fmtMes } from "@/lib/format";
import { Bars } from "@/components/charts";
import { ClientesModal } from "@/components/clientes-modal";
import { ClientesTabla } from "@/components/clientes-tabla";
import { Kpi, Panel, PageTitle } from "@/components/ui";

export const revalidate = 300;

const ANONIMOS = new Set(["Público en General", "(Sin cliente)"]);

export default async function Clientes({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; m?: string }>;
}) {
  const sp = await searchParams;
  const perfil = await requirePerfil();
  const scope = scopeDe(perfil, sp.s);
  const mes = resolverMes(sp.m);

  const [clientes, identificada, pagos] = await Promise.all([
    getClientes(scope, mes),
    getIdentificada(scope),
    getPagos(scope, mes),
  ]);

  const idRows = mes ? identificada.filter((r) => r.mes === mes) : identificada;
  const totalIdentificada = sumBy(idRows, "identificada");
  const totalAnonima = sumBy(idRows, "anonima");
  const totalVenta = totalIdentificada + totalAnonima;

  const conNombre = rollup(
    clientes.filter((c) => !ANONIMOS.has(c.cliente)),
    "cliente",
    ["ventas", "monto"]
  );
  // rollup conserva la primera ultima_compra; para el global tomamos la más reciente
  const ultimaPor = new Map<string, string>();
  for (const c of clientes) {
    if (ANONIMOS.has(c.cliente)) continue;
    const prev = ultimaPor.get(c.cliente);
    if (!prev || c.ultima_compra > prev) ultimaPor.set(c.cliente, c.ultima_compra);
  }

  const top = [...conNombre]
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 20)
    .map((c) => ({
      cliente: c.cliente,
      ventas: c.ventas,
      monto: c.monto,
      ticket: c.monto / c.ventas,
      ultima: ultimaPor.get(c.cliente) ?? c.ultima_compra,
    }));
  const credito = pagos.filter((p) => p.tipo === "Crédito");
  const creditoMonto = sumBy(credito, "monto");

  const chartData = identificada.length
    ? [...new Set(identificada.map((r) => r.mes))].sort().map((m) => {
        const rows = identificada.filter((r) => r.mes === m);
        return {
          x: fmtMes(m),
          Identificada: sumBy(rows, "identificada"),
          "Anónima": sumBy(rows, "anonima"),
        };
      })
    : [];

  const periodoLabel = mes ? fmtMesLargo(mes) : "todo el periodo";
  const sucLabel = scope === "global" ? "ambas sucursales" : `sucursal ${scope}`;

  return (
    <>
      <PageTitle title="Clientes y mayoreo" note={`${sucLabel} · ${periodoLabel}`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Kpi
          label="Venta identificada"
          value={fmtCompact(totalIdentificada)}
          context={`${fmtPct((totalIdentificada / totalVenta) * 100)} de la venta`}
        />
        <Kpi
          label="Venta anónima"
          value={fmtCompact(totalAnonima)}
          context={`Público en General y sin cliente · ${fmtPct((totalAnonima / totalVenta) * 100)}`}
        />
        <Kpi
          label="Clientes con compra"
          value={fmtInt(conNombre.length)}
          context={mes ? "en el mes" : "en el periodo"}
        />
        <Kpi
          label="Vendido a crédito"
          value={fmtCompact(creditoMonto)}
          context={`${fmtInt(sumBy(credito, "pagos"))} operaciones`}
        />
      </div>

      {!mes && (
        <Panel
          title="Venta identificada vs anónima"
          subtitle="Por mes · la oportunidad de CRM está en voltear esta proporción"
          className="mb-5"
        >
          <div className="flex gap-4 text-[12.5px] mb-2" style={{ color: "var(--ink-2)" }}>
            <span className="inline-flex items-center gap-1.5">
              <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--accent)" }} />
              Identificada
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--muted)" }} />
              Anónima
            </span>
          </div>
          <Bars
            data={chartData}
            xKey="x"
            series={[
              { key: "Identificada", color: "var(--accent)", label: "Identificada" },
              { key: "Anónima", color: "var(--muted)", label: "Anónima" },
            ]}
            tickEvery={3}
            height={260}
          />
        </Panel>
      )}

      <Panel
        title="Top clientes identificados"
        subtitle={`Los 20 de mayor compra · ${periodoLabel} · excluye Público en General`}
      >
        <div className="overflow-x-auto">
          <ClientesTabla rows={top} scope={scope} />
        </div>
        <ClientesModal rows={clientes} scope={scope} esMes={mes !== null} />
      </Panel>
    </>
  );
}
