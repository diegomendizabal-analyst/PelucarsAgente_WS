// Alta explícita de las dos cuentas aprobadas; no crea datos comerciales.
// Las contraseñas se generan localmente y se guardan fuera de Git, nunca en stdout.
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { profileSchema } from '../src/lib/auth/validation.ts';

const root = new URL('../', import.meta.url);
const envPath = fileURLToPath(new URL('.env.local', root));
const credentialsPath = fileURLToPath(new URL('.env.demo.local', root));
const env = { ...parseEnv(await readFile(envPath, 'utf8')), ...process.env };
const expected = process.argv[process.argv.indexOf('--project-ref') + 1];
if (!process.argv.includes('--project-ref') || new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname !== `${expected}.supabase.co`) {
  throw new Error('Indicar --project-ref con el proyecto de demo para confirmar el destino.');
}
if (!env.SUPABASE_SECRET_KEY) throw new Error('Completar SUPABASE_SECRET_KEY en .env.local.');
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const probe = await admin.from('profiles').select('id', { head: true, count: 'exact' });
if (probe.error) throw new Error('No se pudo verificar profiles. Aplicar primero la migración identity.');

if (!existsSync(credentialsPath)) {
  const password = () => randomBytes(24).toString('base64url');
  await writeFile(credentialsPath,
    `# Credenciales locales de demo. No compartir ni versionar.\nDEMO_ADMIN_EMAIL=admin@pelucars.example\nDEMO_ADMIN_PASSWORD=${password()}\nDEMO_SELLER_EMAIL=vendedor@pelucars.example\nDEMO_SELLER_PASSWORD=${password()}\n`,
    { flag: 'wx', mode: 0o600 });
}
const credentials = parseEnv(await readFile(credentialsPath, 'utf8'));
const accounts = [
  { full_name: 'Administrador Demo', role: 'admin', prefix: 'DEMO_ADMIN' },
  { full_name: 'Vendedor Demo', role: 'seller', prefix: 'DEMO_SELLER' },
];
let existing = [];
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw new Error('No se pudo leer Auth. Verificar la clave administrativa.');
  existing = existing.concat(data.users);
  if (data.users.length < 100) break;
}
for (const account of accounts) {
  const email = credentials[`${account.prefix}_EMAIL`];
  const password = credentials[`${account.prefix}_PASSWORD`];
  if (!email || !password || password.length < 12) throw new Error('Credenciales locales incompletas.');
  let user = existing.find((entry) => entry.email?.toLowerCase() === email.toLowerCase());
  const contact = { full_name: account.full_name, contact_phone: credentials[`${account.prefix}_CONTACT_PHONE`] ?? '', contact_email: credentials[`${account.prefix}_CONTACT_EMAIL`] ?? '' };
  // Comprobar antes de crear Auth: un vendedor nuevo requiere contacto explícito.
  if (!user && account.role === 'seller' && !profileSchema.safeParse(contact).success) {
    throw new Error('Completar DEMO_SELLER_CONTACT_PHONE y DEMO_SELLER_CONTACT_EMAIL válidos en .env.demo.local antes del alta.');
  }
  if (!user) {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error(`No se confirmó el alta de ${email}; revisar Auth antes de reintentar.`);
    user = created.data.user;
  }
  const profile = await admin.from('profiles').select('role,is_enabled').eq('id', user.id).maybeSingle();
  if (profile.error) throw new Error(`No se pudo consultar el perfil ${user.id}.`);
  if (profile.data) {
    if (profile.data.role !== account.role || !profile.data.is_enabled) throw new Error(`El perfil ${user.id} requiere revisión; no se cambia automáticamente.`);
    console.log(`Cuenta ya existente: ${email}. Se conserva su contraseña.`);
    continue;
  }
  if (account.role === 'seller' && !profileSchema.safeParse(contact).success) {
    throw new Error('Completar DEMO_SELLER_CONTACT_PHONE y DEMO_SELLER_CONTACT_EMAIL antes de incorporar el perfil vendedor.');
  }
  const result = await admin.rpc('bootstrap_account', {
    p_id: user.id, p_full_name: account.full_name, p_role: account.role, p_contact_phone: contact.contact_phone || null, p_contact_email: contact.contact_email || null,
  });
  if (result.error) throw new Error(`Auth creado; perfil ${user.id} pendiente de conciliación. La cuenta sin perfil no accede al CRM.`);
  console.log(`Cuenta habilitada: ${email} (${account.role}).`);
}
console.log('Contraseñas en frontend/.env.demo.local. No se imprimieron ni se enviaron correos.');
