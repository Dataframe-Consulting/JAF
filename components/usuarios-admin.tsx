"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fmtFecha } from "@/lib/format";

type UsuarioAdmin = {
  id: string;
  nombre: string;
  rol: "dueno" | "encargado";
  sucursal: string | null;
  email: string;
  creado: string;
  ultimo_acceso: string | null;
};

const ROL_LABEL: Record<UsuarioAdmin["rol"], string> = {
  dueno: "Dueño",
  encargado: "Encargado",
};

const inputStyle = {
  background: "var(--paper)",
  color: "var(--ink)",
  border: "1px solid var(--line)",
} as const;

const NUEVO_INICIAL = { nombre: "", email: "", password: "", rol: "encargado", sucursal: "Boulevard" };

/** Alta, edición, reseteo de contraseña y baja de usuarios (solo dueño; las
 *  funciones RPC verifican el rol del lado del servidor). */
export function UsuariosAdmin({ miId }: { miId: string }) {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [mostrarAlta, setMostrarAlta] = useState(false);
  const [nuevo, setNuevo] = useState(NUEVO_INICIAL);
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPass, setResetPass] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(
    () =>
      supabaseBrowser()
        .rpc("listar_usuarios")
        .then(({ data, error }) => {
          setCargando(false);
          if (error) {
            setError(error.message);
          } else {
            setError(null);
            setUsuarios((data ?? []) as UsuarioAdmin[]);
          }
        }),
    []
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function accion(fn: () => PromiseLike<{ error: { message: string } | null }>, exito: string) {
    setOcupado(true);
    setError(null);
    setAviso(null);
    const { error } = await fn();
    setOcupado(false);
    if (error) {
      setError(error.message);
      return false;
    }
    setAviso(exito);
    await cargar();
    return true;
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    const ok = await accion(
      () =>
        supabaseBrowser().rpc("crear_usuario", {
          p_email: nuevo.email.trim(),
          p_password: nuevo.password,
          p_nombre: nuevo.nombre.trim(),
          p_rol: nuevo.rol,
          p_sucursal: nuevo.rol === "encargado" ? nuevo.sucursal : null,
        }),
      `Usuario ${nuevo.email.trim()} creado.`
    );
    if (ok) {
      setNuevo(NUEVO_INICIAL);
      setMostrarAlta(false);
    }
  }

  function actualizar(u: UsuarioAdmin, rol: string, sucursal: string | null) {
    void accion(
      () =>
        supabaseBrowser().rpc("actualizar_usuario", {
          p_id: u.id,
          p_nombre: u.nombre,
          p_rol: rol,
          p_sucursal: sucursal,
        }),
      `${u.nombre}: acceso actualizado.`
    );
  }

  async function restablecer(u: UsuarioAdmin) {
    const ok = await accion(
      () => supabaseBrowser().rpc("restablecer_password", { p_id: u.id, p_password: resetPass }),
      `Contraseña de ${u.nombre} restablecida.`
    );
    if (ok) {
      setResetId(null);
      setResetPass("");
    }
  }

  function eliminar(u: UsuarioAdmin) {
    if (!window.confirm(`¿Eliminar el acceso de ${u.nombre} (${u.email})? Esta acción no se puede deshacer.`)) return;
    void accion(
      () => supabaseBrowser().rpc("eliminar_usuario", { p_id: u.id }),
      `${u.nombre} eliminado.`
    );
  }

  const botonChico =
    "text-[12px] font-semibold px-3 py-1 rounded-full cursor-pointer whitespace-nowrap disabled:opacity-50";

  return (
    <div className="grid gap-3">
      {error && (
        <p className="text-[12.5px]" style={{ color: "var(--bad)" }}>
          {error}
        </p>
      )}
      {aviso && !error && (
        <p className="text-[12.5px]" style={{ color: "var(--good)" }}>
          {aviso}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-[13px] tnum">
          <thead>
            <tr
              className="text-left text-[11.5px] uppercase tracking-wider"
              style={{ color: "var(--muted)" }}
            >
              <th className="py-2 pr-3 font-semibold">Nombre</th>
              <th className="py-2 px-3 font-semibold">Correo</th>
              <th className="py-2 px-3 font-semibold">Rol</th>
              <th className="py-2 px-3 font-semibold">Sucursal</th>
              <th className="py-2 px-3 font-semibold text-right">Último acceso</th>
              <th className="py-2 pl-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} style={{ borderTop: "1px solid var(--line)" }}>
                <td className="py-2 pr-3 font-medium">
                  {u.nombre}
                  {u.id === miId && (
                    <span className="ml-1.5 text-[11px]" style={{ color: "var(--muted)" }}>
                      (tú)
                    </span>
                  )}
                </td>
                <td className="py-2 px-3" style={{ color: "var(--ink-2)" }}>
                  {u.email}
                </td>
                <td className="py-2 px-3">
                  <select
                    aria-label={`Rol de ${u.nombre}`}
                    value={u.rol}
                    disabled={ocupado || u.id === miId}
                    onChange={(e) =>
                      actualizar(u, e.target.value, e.target.value === "encargado" ? (u.sucursal ?? "Boulevard") : null)
                    }
                    className="text-[12.5px] rounded-full px-2.5 py-1 cursor-pointer disabled:opacity-60"
                    style={inputStyle}
                  >
                    <option value="dueno">{ROL_LABEL.dueno}</option>
                    <option value="encargado">{ROL_LABEL.encargado}</option>
                  </select>
                </td>
                <td className="py-2 px-3">
                  {u.rol === "encargado" ? (
                    <select
                      aria-label={`Sucursal de ${u.nombre}`}
                      value={u.sucursal ?? "Boulevard"}
                      disabled={ocupado}
                      onChange={(e) => actualizar(u, u.rol, e.target.value)}
                      className="text-[12.5px] rounded-full px-2.5 py-1 cursor-pointer disabled:opacity-60"
                      style={inputStyle}
                    >
                      <option value="Boulevard">Boulevard</option>
                      <option value="Andenes">Andenes</option>
                    </select>
                  ) : (
                    <span style={{ color: "var(--muted)" }}>Todas</span>
                  )}
                </td>
                <td className="py-2 px-3 text-right" style={{ color: "var(--ink-2)" }}>
                  {u.ultimo_acceso ? fmtFecha(u.ultimo_acceso) : "Nunca"}
                </td>
                <td className="py-2 pl-3">
                  <div className="flex gap-1.5 justify-end items-center flex-wrap">
                    {resetId === u.id ? (
                      <>
                        <input
                          type="password"
                          placeholder="Nueva contraseña"
                          value={resetPass}
                          onChange={(e) => setResetPass(e.target.value)}
                          autoFocus
                          className="text-[12.5px] rounded-full px-3 py-1 w-[150px]"
                          style={inputStyle}
                        />
                        <button
                          type="button"
                          disabled={ocupado || resetPass.length < 8}
                          onClick={() => void restablecer(u)}
                          className={botonChico}
                          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResetId(null);
                            setResetPass("");
                          }}
                          className={botonChico}
                          style={{ border: "1px solid var(--line)", color: "var(--muted)" }}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => {
                            setResetId(u.id);
                            setResetPass("");
                          }}
                          className={botonChico}
                          style={{ border: "1px solid var(--line)", color: "var(--ink-2)" }}
                        >
                          Restablecer contraseña
                        </button>
                        {u.id !== miId && (
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => eliminar(u)}
                            className={botonChico}
                            style={{ background: "rgba(224,101,92,0.12)", color: "var(--bad)" }}
                          >
                            Eliminar
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && !cargando && !error && (
              <tr>
                <td colSpan={6} className="py-6 text-center" style={{ color: "var(--muted)" }}>
                  Sin usuarios registrados.
                </td>
              </tr>
            )}
            {cargando && (
              <tr>
                <td colSpan={6} className="py-6 text-center" style={{ color: "var(--muted)" }}>
                  Cargando usuarios…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {mostrarAlta ? (
        <form
          onSubmit={crear}
          className="grid gap-2.5 rounded-lg p-4"
          style={{ background: "var(--accent-soft)" }}
        >
          <div className="text-[13px] font-semibold">Nuevo usuario</div>
          <div className="grid sm:grid-cols-2 gap-2.5">
            <input
              placeholder="Nombre"
              required
              value={nuevo.nombre}
              onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
              className="text-[13px] rounded-lg px-3 py-2"
              style={inputStyle}
            />
            <input
              type="email"
              placeholder="Correo"
              required
              value={nuevo.email}
              onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })}
              className="text-[13px] rounded-lg px-3 py-2"
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Contraseña (mínimo 8)"
              required
              minLength={8}
              value={nuevo.password}
              onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })}
              className="text-[13px] rounded-lg px-3 py-2"
              style={inputStyle}
            />
            <div className="flex gap-2">
              <select
                aria-label="Rol"
                value={nuevo.rol}
                onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })}
                className="text-[13px] rounded-lg px-3 py-2 flex-1 cursor-pointer"
                style={inputStyle}
              >
                <option value="encargado">{ROL_LABEL.encargado}</option>
                <option value="dueno">{ROL_LABEL.dueno}</option>
              </select>
              {nuevo.rol === "encargado" && (
                <select
                  aria-label="Sucursal"
                  value={nuevo.sucursal}
                  onChange={(e) => setNuevo({ ...nuevo, sucursal: e.target.value })}
                  className="text-[13px] rounded-lg px-3 py-2 flex-1 cursor-pointer"
                  style={inputStyle}
                >
                  <option value="Boulevard">Boulevard</option>
                  <option value="Andenes">Andenes</option>
                </select>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={ocupado}
              className="text-[13px] font-semibold px-4 py-2 rounded-full cursor-pointer disabled:opacity-60"
              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            >
              {ocupado ? "Creando…" : "Crear usuario"}
            </button>
            <button
              type="button"
              onClick={() => setMostrarAlta(false)}
              className="text-[13px] font-semibold px-4 py-2 rounded-full cursor-pointer"
              style={{ border: "1px solid var(--line)", color: "var(--muted)" }}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setMostrarAlta(true)}
          className="text-[13px] font-semibold px-4 py-2 rounded-full cursor-pointer justify-self-start"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          Nuevo usuario
        </button>
      )}
    </div>
  );
}
