import type { Metadata } from "next";
import Image from "next/image";
import { iniciarSesion } from "./actions";

export const metadata: Metadata = {
  title: "Iniciar sesión · JAF Central",
};

const inputStyle = {
  background: "var(--paper)",
  color: "var(--ink)",
  border: "1px solid var(--line)",
} as const;

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="flex-1 flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="flex items-center justify-center gap-3">
            <Image
              src="/logo-jaf.avif"
              alt="Solo JAF"
              width={100}
              height={69}
              priority
            />
            <span className="font-display text-[38px] leading-none">Central</span>
          </div>
          <p
            className="text-[11px] tracking-[0.14em] uppercase mt-3"
            style={{ color: "var(--muted)" }}
          >
            La mejor carne de todo México
          </p>
        </div>

        <form action={iniciarSesion} className="card p-6 grid gap-4">
          <label className="grid gap-1.5 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
            Correo
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              autoFocus
              className="text-[14px] rounded-lg px-3.5 py-2.5"
              style={inputStyle}
            />
          </label>
          <label className="grid gap-1.5 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
            Contraseña
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="text-[14px] rounded-lg px-3.5 py-2.5"
              style={inputStyle}
            />
          </label>

          {sp.error && (
            <p className="text-[12.5px]" style={{ color: "var(--bad)" }}>
              Correo o contraseña incorrectos.
            </p>
          )}

          <button
            type="submit"
            className="text-[14px] font-semibold rounded-full px-4 py-2.5 cursor-pointer mt-1"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            Entrar
          </button>
        </form>

        <p className="text-center text-[12px] mt-5" style={{ color: "var(--muted)" }}>
          Acceso exclusivo para el equipo de JAF · Dataframe AI
        </p>
      </div>
    </div>
  );
}
