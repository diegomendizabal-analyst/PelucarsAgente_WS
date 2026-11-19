// Ajuste explícito de aplicación interna. No imprime el contenido del token/config.
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
const app = parseEnv(await readFile(new URL('../frontend/.env.local', import.meta.url), 'utf8'));
const ops = parseEnv(await readFile(new URL('../.env.supabase.local', import.meta.url), 'utf8'));
const host = new URL(app.NEXT_PUBLIC_SUPABASE_URL).hostname;
if (!/^[a-z]{20}\.supabase\.co$/.test(host)) throw new Error('Proyecto no válido.');
const ref = host.split('.')[0];
async function settings() {
  const response = await fetch(`https://${host}/auth/v1/settings`, {
    headers: { apikey: app.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`No se pudo verificar Auth (HTTP ${response.status}).`);
  return response.json();
}
const before = await settings();
console.log(JSON.stringify({ project: ref, public_signup_disabled: before.disable_signup, email_provider: before.external?.email }));
if (process.argv.includes('--apply') && !before.disable_signup) {
  if (!ops.SUPABASE_ACCESS_TOKEN) throw new Error('Falta token administrativo local.');
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${ops.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ disable_signup: true }), signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`No se pudo desactivar el registro público (HTTP ${response.status}). Revisar permiso Auth Configuration/Project Settings o desactivarlo desde el panel.`);
  const after = await settings();
  if (!after.disable_signup) throw new Error('Cambio enviado; pendiente de confirmación en el servicio Auth.');
  console.log('Registro público deshabilitado; se conserva el acceso por correo/contraseña.');
}
