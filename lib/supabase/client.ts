import { createBrowserClient } from "@supabase/ssr";

/** Cliente para componentes de cliente (los modales que consultan al abrirse). */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
