// Usa las cuentas de demo aprobadas. Deshabilita/restituye temporalmente al vendedor.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';
const env = parseEnv(await readFile(new URL('../.env.local', import.meta.url), 'utf8'));
const demo = parseEnv(await readFile(new URL('../.env.demo.local', import.meta.url), 'utf8'));
const makeClient = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = makeClient();
const seller = makeClient();
let restore;
try {
  const adminLogin = await admin.auth.signInWithPassword({ email: demo.DEMO_ADMIN_EMAIL, password: demo.DEMO_ADMIN_PASSWORD });
  assert(!adminLogin.error, 'Falló el login admin');
  const sellerLogin = await seller.auth.signInWithPassword({ email: demo.DEMO_SELLER_EMAIL, password: demo.DEMO_SELLER_PASSWORD });
  assert(!sellerLogin.error, 'Falló el login vendedor');
  const own = await seller.from('profiles').select('*');
  assert(!own.error && own.data.length === 1, 'Vendedor sólo debe ver su perfil');
  assert.equal(own.data[0].role, 'seller');
  const user = own.data[0];
  const list = await admin.rpc('list_managed_users');
  assert(!list.error && list.data.some(row => row.id === user.id), 'Admin debe poder listar equipo');
  assert((await seller.rpc('list_managed_users')).error, 'Vendedor no puede listar equipo');
  assert((await seller.from('profiles').update({ role: 'admin' }).eq('id', user.id)).error, 'No debe poder cambiar rol');
  assert(user.contact_phone && user.contact_email, 'Completar contactos de la cuenta de demo antes de esta prueba; no se inventan ni sustituyen datos.');
  restore = { p_id: user.id, p_full_name: user.full_name, p_contact_phone: user.contact_phone, p_contact_email: user.contact_email, p_is_enabled: user.is_enabled };
  const disabled = await admin.rpc('update_seller', { ...restore, p_is_enabled: false });
  assert(!disabled.error, 'No se pudo deshabilitar vendedor');
  const blocked = await seller.from('profiles').select('id');
  assert(!blocked.error && blocked.data.length === 0, 'JWT previo debe perder acceso tras deshabilitación');
  console.log('OK: login admin/vendedor, RLS, bloqueo de elevación y deshabilitación con JWT previo.');
} finally {
  if (restore) {
    const restored = await admin.rpc('update_seller', restore);
    if (restored.error) throw new Error('Revisar manualmente: no se pudo restituir la habilitación del vendedor.');
    console.log('Habilitación original del vendedor restituida.');
  }
  await Promise.all([admin.auth.signOut({ scope: 'local' }), seller.auth.signOut({ scope: 'local' })]);
}
