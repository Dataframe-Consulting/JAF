"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

const inputStyle = {
  background: "var(--paper)",
  color: "var(--ink)",
  border: "1px solid var(--line)",
} as const;

/** Cambio de la contraseña propia (cualquier rol) vía Supabase Auth. */
export function CambiarPassword() {
  const [pass, setPass] = useState("");
  const [conf, setConf] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pass.length < 8) {
      setMsg({ ok: false, texto: "La contraseña debe tener al menos 8 caracteres." });
      return;
    }
    if (pass !== conf) {
      setMsg({ ok: false, texto: "Las contraseñas no coinciden." });
      return;
    }
    setEnviando(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password: pass });
    setEnviando(false);
    if (error) {
      setMsg({ ok: false, texto: error.message });
    } else {
      setMsg({ ok: true, texto: "Contraseña actualizada." });
      setPass("");
      setConf("");
    }
  }

  return (
    <form onSubmit={enviar} className="grid gap-2.5 max-w-xs">
      <label className="grid gap-1 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
        Nueva contraseña
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          autoComplete="new-password"
          className="text-[13.5px] rounded-lg px-3 py-2"
          style={inputStyle}
        />
      </label>
      <label className="grid gap-1 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
        Confirmar contraseña
        <input
          type="password"
          value={conf}
          onChange={(e) => setConf(e.target.value)}
          autoComplete="new-password"
          className="text-[13.5px] rounded-lg px-3 py-2"
          style={inputStyle}
        />
      </label>
      {msg && (
        <p className="text-[12.5px]" style={{ color: msg.ok ? "var(--good)" : "var(--bad)" }}>
          {msg.texto}
        </p>
      )}
      <button
        type="submit"
        disabled={enviando}
        className="text-[13px] font-semibold rounded-full px-4 py-2 cursor-pointer justify-self-start disabled:opacity-60"
        style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
      >
        {enviando ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
