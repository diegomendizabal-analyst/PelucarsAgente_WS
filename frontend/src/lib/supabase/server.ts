import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { authCookieOptions, supabaseConfig } from "./config";

export async function createSessionClient() {
  // La validación del token consulta la hora actual: nunca se prerenderiza ni cachea.
  await connection();
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase no está configurado.");
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: authCookieOptions,
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        try { values.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* Server Components: el proxy ya renovó y escribió las cookies. */ }
      },
    },
  });
}
