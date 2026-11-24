import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authCookieOptions, supabaseConfig } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  let authenticated = false;
  let adminAllowed = true;
  const adminPath = request.nextUrl.pathname === "/reportes" || request.nextUrl.pathname.startsWith("/reportes/") || request.nextUrl.pathname === "/usuarios" || request.nextUrl.pathname.startsWith("/usuarios/") || request.nextUrl.pathname === "/vehiculos/nuevo" || /^\/vehiculos\/[^/]+\/editar$/.test(request.nextUrl.pathname);
  const publicPath = request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/acceso-denegado";
  const config = supabaseConfig();
  if (config) {
    const supabase = createServerClient(config.url, config.key, {
      cookieOptions: authCookieOptions,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values, headers) => {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        },
      },
    });
    // Renueva tokens. La autorización se realiza además en páginas, acciones y RLS.
    const { data, error } = await supabase.auth.getClaims();
    authenticated = !error && !!data?.claims.sub;
    // Estas rutas se rechazan antes del streaming; el resto evita duplicar la consulta del perfil.
    if (authenticated && adminPath) {
      const profile=await supabase.from("profiles").select("is_enabled,role").eq("id",data!.claims.sub).maybeSingle();
      adminAllowed=!profile.error && profile.data?.is_enabled === true && profile.data.role === "admin";
    }
  }
  // El perfil vigente se consulta una vez en requireAccount (páginas, rutas y acciones).
  // La comprobación anticipada se conserva sólo en rutas exclusivas de admin.
  if (!publicPath && (!authenticated || !adminAllowed)) {
    const destination = NextResponse.redirect(new URL(authenticated ? "/acceso-denegado" : "/login", request.url));
    response.cookies.getAll().forEach((cookie) => destination.cookies.set(cookie));
    response = destination;
  }
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
