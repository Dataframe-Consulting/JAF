import { Suspense } from "react";
import { Header } from "@/components/header";
import { getMeses } from "@/lib/data";
import { requirePerfil } from "@/lib/auth";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const perfil = await requirePerfil();
  const meses = await getMeses();
  return (
    <>
      <Suspense>
        <Header meses={meses} perfil={perfil} />
      </Suspense>
      <main className="w-full px-5 lg:px-8 2xl:px-12 py-7 flex-1">{children}</main>
      <footer
        className="text-center text-[12.5px] py-5"
        style={{ color: "var(--muted)" }}
      >
        JAF Central · datos reales de ambas sucursales al 7 jul 2026 · Dataframe AI
      </footer>
    </>
  );
}
