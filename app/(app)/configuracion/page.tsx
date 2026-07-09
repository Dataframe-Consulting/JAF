import { requirePerfil } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { fmtFecha } from "@/lib/format";
import { Panel, PageTitle } from "@/components/ui";
import { SelectorTema } from "@/components/tema";
import { CambiarPassword } from "@/components/cambiar-password";
import { UsuariosAdmin } from "@/components/usuarios-admin";

export const revalidate = 300;

const ROL_LABEL = { dueno: "Dueño", encargado: "Encargado" } as const;

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div
        className="text-[10.5px] uppercase tracking-wider font-semibold"
        style={{ color: "var(--muted)" }}
      >
        {label}
      </div>
      <div className="text-[13.5px] mt-0.5">{valor}</div>
    </div>
  );
}

export default async function Configuracion() {
  const perfil = await requirePerfil();
  const supabase = await supabaseServer();

  const [{ data: claims }, { data: ultimaVenta }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase
      .from("v_ventas_diaria")
      .select("dia")
      .order("dia", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const email = (claims?.claims?.email as string | undefined) ?? "—";
  const corteDatos = (ultimaVenta as { dia: string } | null)?.dia ?? null;

  return (
    <>
      <PageTitle title="Configuración" />

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <Panel title="Mi cuenta" subtitle="Datos de tu acceso a la plataforma">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-5">
            <Dato label="Nombre" valor={perfil.nombre} />
            <Dato label="Correo" valor={email} />
            <Dato label="Rol" valor={ROL_LABEL[perfil.rol]} />
            <Dato
              label="Alcance"
              valor={perfil.rol === "dueno" ? "Ambas sucursales" : `Sucursal ${perfil.sucursal}`}
            />
          </div>
          <CambiarPassword />
        </Panel>

        <div className="grid gap-5 content-start">
          <Panel title="Apariencia" subtitle="El tema se guarda en este navegador">
            <SelectorTema />
          </Panel>
          <Panel title="Datos" subtitle="Origen y corte de la información">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Dato
                label="Última venta registrada"
                valor={corteDatos ? fmtFecha(corteDatos) : "—"}
              />
              <Dato label="Fuente" valor="Respaldos SICAR · Supabase" />
            </div>
            <p className="text-[12.5px] mt-3" style={{ color: "var(--muted)" }}>
              Los datos se cargan desde respaldos del POS. Cuando SICAR habilite su API, la
              actualización será automática y diaria.
            </p>
          </Panel>
        </div>
      </div>

      {perfil.rol === "dueno" && (
        <Panel
          title="Usuarios"
          subtitle="Alta, roles, sucursal y contraseñas · el encargado solo ve su sucursal"
        >
          <UsuariosAdmin miId={perfil.id} />
        </Panel>
      )}
    </>
  );
}
