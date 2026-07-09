import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Cliente ligado a las cookies de la petición (Server Components y Server Actions). */
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // En un Server Component no se pueden escribir cookies; el refresco
          // de sesión lo hace el proxy, así que aquí se ignora sin romper.
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {}
        },
      },
    }
  );
}
