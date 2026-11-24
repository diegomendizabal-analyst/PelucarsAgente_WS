// Regresión visual y de navegación contra un servidor local ya iniciado.
// Uso: npm run check:ui -- http://127.0.0.1:3100 [--crm | --inventory | --public-only]
// Requiere Chrome/Chromium local; CHROME_BIN permite indicar su ejecutable.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const base = process.argv.find((arg) => /^https?:/.test(arg)) ?? 'http://127.0.0.1:3100';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Usar un servidor local.');
const publicOnly = process.argv.includes('--public-only');
const inventoryOnly = process.argv.includes('--inventory');
const timingOnly = process.argv.includes('--timing');
const guardsOnly = process.argv.includes('--guards');
const crmOnly = !publicOnly && !inventoryOnly;
const smoke = process.argv.includes('--smoke');
const root = fileURLToPath(new URL('../', import.meta.url));
const credentialsPath = join(root, '.env.demo.local');
const credentials = existsSync(credentialsPath) ? parseEnv(await readFile(credentialsPath, 'utf8')) : {};
if (!publicOnly) assert(credentials.DEMO_ADMIN_PASSWORD, 'Faltan cuentas reales de demo. Usar --public-only para revisar login y rutas cerradas.');
const output = join(root, '.next', 'ui-qa', 'build');
const executable = [process.env.CHROME_BIN, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find((path) => path && existsSync(path));
assert(executable, 'No se encontró Chrome/Chromium. Definir CHROME_BIN.');
await mkdir(output, { recursive: true });
const profile = join(tmpdir(), `pelucars-ui-${process.pid}`);
const browser = spawn(executable, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket;
const pending = new Map();
const errors = [];
let id = 0;
let assertions = 0;
let location = 'inicio';
try {
  let port;
  for (let i = 0; i < 80; i++) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch { /* Chrome aún está iniciando. */ }
    if (port) break;
    await delay(150);
  }
  assert(port, 'Chrome no inició.');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const call = pending.get(message.id);
      if (!call) return;
      clearTimeout(call.timer);
      pending.delete(message.id);
      if (message.error) call.reject(new Error(JSON.stringify(message.error))); else call.resolve(message.result);
    }
    if (message.method === 'Page.frameNavigated' && !message.params.frame.parentId) location = message.params.frame.url;
    if (message.method === 'Runtime.exceptionThrown') {
      const detail = `${location}: ${message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text}`;
      errors.push(detail);
      console.error(detail);
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' '));
  };
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const key = ++id;
      const timer = setTimeout(() => { pending.delete(key); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
      pending.set(key, { resolve, reject, timer });
      socket.send(JSON.stringify({ id: key, method, params }));
    });
  }
  async function evaluate(expression) {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    assert(!response.exceptionDetails, JSON.stringify(response.exceptionDetails));
    return response.result.value;
  }
  async function until(expression) {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(150); }
    throw new Error(`No se cumplió: ${expression}`);
  }
  async function go(route) {
    await send('Page.navigate', { url: base + route });
    const target = new URL(base + route);
    await until(`location.pathname === ${JSON.stringify(target.pathname)} && location.search === ${JSON.stringify(target.search)} && document.readyState === 'complete' && !!document.querySelector('h1')`);
    await delay(200);
  }
  async function change(selector, value) {
    await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); const proto = el.tagName === 'INPUT' ? HTMLInputElement.prototype : HTMLSelectElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event(el.tagName === 'INPUT' ? 'input' : 'change', { bubbles: true })); })()`);
    await delay(100);
  }
  async function click(label) {
    await evaluate(`[...document.querySelectorAll('button')].find(el => el.textContent.trim().startsWith(${JSON.stringify(label)})).click()`);
    await delay(100);
  }
  async function signIn(role) {
    if (await evaluate(`!!document.querySelector('.logout-button')`)) {
      await click('Salir');
      await until(`location.pathname === '/login'`);
    } else if (await evaluate(`location.pathname === '/acceso-denegado'`)) {
      await click('Volver al inicio de sesión');
      await until(`location.pathname === '/login'`);
    }
    await go('/login');
    const prefix = role === 'admin' ? 'DEMO_ADMIN' : 'DEMO_SELLER';
    await change('#login-email', credentials[`${prefix}_EMAIL`]);
    await change('#login-password', credentials[`${prefix}_PASSWORD`]);
    await click('Ingresar');
    await until(`location.pathname === '/' && !!document.querySelector('.account-menu')`);
    assert.equal(await evaluate(`!!document.querySelector('#preview-role')`), false);
    assert.equal(await evaluate(`!!document.querySelector('nav a[href="/usuarios"]')`), role === 'admin');
    const cookies = await send('Network.getCookies', { urls: [base] });
    const sessionCookies = cookies.cookies.filter(cookie => cookie.name.startsWith('sb-'));
    assert(sessionCookies.length > 0 && sessionCookies.every(cookie => cookie.httpOnly), 'Cookies de sesión HttpOnly');
  }
  async function check(context) {
    const state = await evaluate(`(() => {
      const css = el => getComputedStyle(el);
      const rows = [...document.querySelectorAll('.demo-row')];
      const cards = [...document.querySelectorAll('.event-card')];
      const header = document.querySelector('.record-list .list-columns');
      const row = document.querySelector('.record-list .demo-row');
      const aligned = !header || !row || css(header).display === 'none' || [...header.children].every((cell, index) => Math.abs(cell.getBoundingClientRect().left - row.children[index].getBoundingClientRect().left) < 2);
      return {
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        rowsStyled: rows.every(el => css(el).display === 'grid' && parseFloat(css(el).paddingLeft) >= 16),
        identitiesStyled: [...document.querySelectorAll('.demo-person')].every(el => css(el).display === 'flex' && parseFloat(css(el).gap) >= 8),
        eventsStyled: cards.every(el => parseFloat(css(el).borderTopWidth) > 0 && Number(css(el.querySelector('h3')).fontWeight) >= 600),
        datesStructured: [...document.querySelectorAll('.timeline-event')].every(el => css(el).display === 'grid' && !!el.querySelector('time[datetime]')),
        aligned,
        pendingDisabled: [...document.querySelectorAll('button')].filter(el => el.textContent.includes('Pendiente')).every(el => el.disabled)
      };
    })()`);
    if (state.overflow) {
      const overflowing = await evaluate(`[...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(el => el.className)`);
      assert.fail(`${context}: desbordamiento horizontal en ${JSON.stringify(overflowing)}`);
    }
    for (const [name, valid] of Object.entries(state)) if (name !== 'overflow') assert(valid, `${context}: ${name}`);
    assertions++;
  }
  async function capture(name) {
    const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await writeFile(join(output, `${name}.png`), Buffer.from(image.data, 'base64'));
  }
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.bringToFront');
  await send('Emulation.setFocusEmulationEnabled',{enabled:true});
  for (const route of ['/', '/usuarios', '/clientes/demo-ana', '/vehiculos/demo-corolla/editar']) {
    await send('Page.navigate', { url: base + route });
    await until(`location.pathname === '/login' && !!document.querySelector('#login-email')`);
    assert.equal(await evaluate(`!!document.querySelector('.account-menu')`), false, 'Ruta privada sin sesión');
  }
  for (const width of (timingOnly ? [1440] : smoke ? [1440, 390] : [1440, 768, 390, 320])) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width <= 390 });
    await go('/login');
    await check(`${width} login`);
    if (width === 1440 || width === 390) await capture(`login-${width}`);
  }
  if (publicOnly) {
    assert.deepEqual(errors, [], 'Errores de consola en acceso público');
    console.log('OK: login responsive y cuatro rutas protegidas sin sesión. No se probaron cuentas reales.');
    await send('Browser.close');
  } else if (guardsOnly) {
    const env=parseEnv(await readFile(join(root,'.env.local'),'utf8'));
    const {createServerClient}=await import('@supabase/ssr');
    const cookieJar=new Map();
    const client=createServerClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{
      cookies:{getAll:()=>[...cookieJar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>cookieJar.set(name,value))},
    });
    // Verifica una sesión válida aunque el login del panel rechace el perfil deshabilitado.
    // No modifica la cuenta ni cambia sus permisos.
    const result=await client.auth.signInWithPassword({email:credentials.DEMO_SELLER_EMAIL,password:credentials.DEMO_SELLER_PASSWORD});
    assert(!result.error,'No se pudo autenticar la cuenta de revisión');
    try {
      const own=await client.from('profiles').select('id,role,is_enabled').eq('id',result.data.user.id).maybeSingle();
      assert(!own.error);
      assert(!own.data || own.data.role==='seller','Esta prueba requiere vendedor');
      const enabled=own.data?.is_enabled===true;
      await send('Network.setCookies',{cookies:[...cookieJar].map(([name,value])=>({name,value,url:base,path:'/',httpOnly:true,sameSite:'Lax'}))});
      for(const route of enabled ? ['/usuarios','/vehiculos/nuevo','/vehiculos/e2000001-0000-4000-8000-000000000001/editar'] : ['/','/clientes','/usuarios','/vehiculos']) {
        await send('Page.navigate',{url:base+route});
        await until(`location.pathname === '/acceso-denegado' && !!document.querySelector('h1')`);
        assert.equal(await evaluate(`!!document.querySelector('.crm-lead-row,.crm-customer-row,.users-table')`),false);
      }
      assert.deepEqual(errors,[],'Errores en rechazo de acceso');
      console.log(`OK: JWT válido, ${enabled ? 'restricción de vendedor' : 'perfil deshabilitado rechazado'} antes de mostrar datos.`);
    } finally { await client.auth.signOut({scope:'local'}); }
    await send('Browser.close');
  } else if (timingOnly) {
    await signIn('admin');
    const timings = [];
    for (let round=0; round<3; round++) {
      for (const route of ['/', '/clientes', '/oportunidades/e2000003-0000-4000-8000-000000000003']) {
        const started = performance.now();
        await go(route);
        timings.push({round,route,ms:Math.round(performance.now()-started-200)});
      }
    }
    console.log(JSON.stringify({timings,errors}));
    await writeFile(join(output,'timings.json'),JSON.stringify({timings,errors},null,2));
    assert.deepEqual(errors,[]);
    await click('Salir'); await until(`location.pathname === '/login'`); await send('Browser.close');
  } else if (crmOnly) {
    await signIn('admin');
    if(process.argv.includes('--notifications')) {
      const feed=await evaluate(`fetch('/api/notificaciones',{cache:'no-store'}).then(r=>r.json())`);
      const notification=feed.rows.find(row=>row.lead_id==='e2000001-0000-4000-8000-000000000001');
      assert(notification,'Reiniciar el seed antes de probar el aviso recurrente');
      await evaluate(`document.querySelector('.assignment-notifications').open=true`);
      await until(`!!document.querySelector('.notification-panel li button')`);
      const reference=`OP-${String(notification.leads.reference_number).padStart(6,'0')}`;
      await click(reference);
      await until(`location.pathname === '/oportunidades/${notification.lead_id}' && !!document.querySelector('.crm-management')`);
      const updated=await evaluate(`fetch('/api/notificaciones',{cache:'no-store'}).then(r=>r.json())`);
      assert(!updated.rows.some(row=>row.id===notification.id),'El aviso debe quedar leído');
      console.log('OK: aviso recurrente abre la ficha y persiste como leído. Restablecer seed al finalizar.');
    }
    for (const width of (smoke ? [1440,390] : [1440,768,390,320])) {
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<=390});
      for (const route of ['/', '/?tab=mine', '/?tab=all', '/clientes']) {
        await go(route); await check(`${width} CRM ${route}`);
        assert.equal(await evaluate(`!!document.querySelector('.preview-banner')`),false);
        assert.equal(await evaluate(`!!document.querySelector('main [role="alert"]')`),false,'Consulta real sin errores');
      }
      await capture(`crm-clientes-${width}`);
      await evaluate(`document.querySelector('.assignment-notifications').open=true`);
      await until(`!document.querySelector('.notification-panel footer button').disabled`);
      await check(`${width} notificaciones`); await capture(`crm-notificaciones-${width}`);
      await evaluate(`document.querySelector('.assignment-notifications').open=false`);
      const customers = await evaluate(`[...document.querySelectorAll('.crm-customer-row')].slice(0,5).map(el => new URL(el.href).pathname)`);
      for (const route of customers) {
        await go(route); await check(`${width} ficha cliente`);
        assert.equal(await evaluate(`!!document.querySelector('main [role="alert"]')`), false);
      }
      if (customers.length) await capture(`crm-historial-cliente-${width}`);
      await go('/?tab=all');
      const leads = await evaluate(`[...document.querySelectorAll('.crm-lead-link')].slice(0,7).map(el => new URL(el.href).pathname)`);
      for (const route of leads) {
        await go(route); await check(`${width} ficha oportunidad`);
        assert.equal(await evaluate(`!!document.querySelector('main [role="alert"]')`), false, 'Detalle sin errores');
        assert.match(await evaluate(`document.querySelector('.page-heading p:last-child')?.textContent ?? document.querySelector('main').textContent`),/OP-\d{6,}/);
        assert.equal(await evaluate(`[...document.querySelectorAll('.crm-timeline li')].every(el => getComputedStyle(el).display === 'grid' && !!el.querySelector('time[datetime]'))`), true);
      }
      if (leads.length) {
        await capture(`crm-ficha-${width}`);
        // Validar Perdido sin motivo no escribe ni altera la muestra.
        await go(leads[0]);
        if (await evaluate(`!!document.querySelector('select[name="status"]')`)) {
          await change('select[name="status"]','lost'); await click('Actualizar estado');
          await until(`!!document.querySelector('#lead-reason-error')`);
          assert.equal(await evaluate(`document.activeElement.name`),'reason');
          await check(`${width} motivo obligatorio`);
        }
      }
      await go('/'); await capture(`crm-espera-${width}`);
      console.log(`OK: CRM conectado a ${width}px; ${customers.length} fichas de cliente y ${leads.length} oportunidades, sin guardar cambios.`);
    }
    await go('/?tab=mine');
    await change('select[name="status"]','lost'); await click('Filtrar');
    await until(`new URLSearchParams(location.search).get('status') === 'lost'`);
    await go('/clientes'); await change('input[name="q"]','Sin coincidencia CRM'); await click('Buscar');
    await until(`new URLSearchParams(location.search).get('q') === 'Sin coincidencia CRM'`);
    for (const route of ['/clientes/demo-ana','/oportunidades/demo-consulta-ana','/oportunidades/c1000000-0000-4000-8000-000000000001']) {
      await send('Page.navigate',{url:base+route});
      await until(`document.querySelector('main')?.textContent.includes('no disponible')`);
      assert.equal(await evaluate(`document.querySelector('main').textContent.includes('Ana Martínez')`),false);
    }
    await writeFile(join(output,'report-crm.json'),JSON.stringify({assertions,errors},null,2));
    assert.deepEqual(errors,[],'Errores CRM');
    await click('Salir'); await until(`location.pathname === '/login'`); await send('Browser.close');
  } else if (inventoryOnly) {
    await signIn('admin');
    await go('/vehiculos');
    await until(`!!document.querySelector('.inventory-filters') && Object.keys(document.querySelector('.inventory-filters')).some(key => key.startsWith('__reactProps'))`);
    const firstVehicle = await evaluate(`(() => { const row = document.querySelector('.inventory-catalog-row'); return row ? { route: new URL(row.href).pathname, name: row.querySelector('h2').textContent } : null; })()`);
    const timeOrigin = await evaluate('performance.timeOrigin');
    await change('input[name="q"]', 'NO-EXISTE-QA-987654');
    await until(`!document.querySelector('[data-pending]') && location.search.includes('NO-EXISTE-QA-987654') && !document.querySelector('.inventory-catalog-row')`);
    await click('Limpiar');
    await until(`!document.querySelector('[data-pending]') && location.search === ''`);
    if (firstVehicle) {
      // Escribir mientras hay una navegación pendiente y combinar filtros no pierde caracteres.
      for (const value of [firstVehicle.name.slice(0, 1), firstVehicle.name.slice(0, 3), firstVehicle.name]) await change('input[name="q"]', value);
      await change('select[name="stock"]', 'available');
      await change('select[name="stock"]', '');
      await until(`!document.querySelector('[data-pending]') && new URLSearchParams(location.search).get('q') === ${JSON.stringify(firstVehicle.name)} && !!document.querySelector('.inventory-catalog-row')`);
      assert.equal(await evaluate(`document.querySelector('input[name="q"]').value`), firstVehicle.name);
      const withSpace = firstVehicle.name + ' ';
      await change('input[name="q"]', withSpace);
      await until(`!document.querySelector('[data-pending]')`);
      assert.equal(await evaluate(`document.querySelector('input[name="q"]').value`), withSpace, 'Una pausa no borra el espacio que se acaba de escribir');
    }
    await evaluate(`document.querySelector('input[name="q"]').focus()`);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await until(`!document.querySelector('[data-pending]')`);
    assert.equal(await evaluate('performance.timeOrigin'), timeOrigin, 'Búsqueda y Enter no recargan el documento');
    assert.equal(await evaluate(`document.activeElement.name`), 'q', 'Búsqueda mantiene el foco');
    await change('select[name="archived"]', 'true');
    await until(`!document.querySelector('[data-pending]') && new URLSearchParams(location.search).get('archived') === 'true'`);
    await click('Limpiar');
    await until(`!document.querySelector('[data-pending]') && location.search === ''`);
    const availableYear = await evaluate(`document.querySelector('select[name="year"] option[value]:not([value=""])')?.value ?? null`);
    if (availableYear) {
      await change('select[name="year"]', availableYear);
      await change('select[name="transmission"]', 'automatic');
      await until(`!document.querySelector('[data-pending]') && new URLSearchParams(location.search).get('year') === ${JSON.stringify(availableYear)} && new URLSearchParams(location.search).get('transmission') === 'automatic'`);
      const match = await evaluate(`document.querySelector('.inventory-catalog-row')?.getAttribute('href') ?? null`);
      if (match) {
        await evaluate(`document.querySelector('.inventory-catalog-row').click()`);
        await until(`!!document.querySelector('.inventory-filter-summary') && !!document.querySelector('.inventory-unit')`);
        await check('Ficha con año y transmisión de la búsqueda');
        assert.match(await evaluate(`document.querySelector('.inventory-unit h3').textContent`), new RegExp(availableYear));
      }
    }
    if (firstVehicle) {
      await go(firstVehicle.route);
      const pricedUnit = await evaluate(`(() => {
        const text = [...document.querySelectorAll('.inventory-price')].map(el => el.textContent).find(value => /^(USD|ARS) /.test(value));
        return text ? { currency: text.slice(0, 3), price: text.slice(4).replaceAll('.', '').replace(',', '.') } : null;
      })()`);
      if (pricedUnit) {
        await go('/vehiculos');
        await until(`Object.keys(document.querySelector('.inventory-filters')).some(key => key.startsWith('__reactProps'))`);
        const priceOrigin = await evaluate('performance.timeOrigin');
        await change('input[name="q"]', firstVehicle.name);
        await change('input[name="min_price"]', pricedUnit.price);
        await until(`!!document.querySelector('#price-filter-error') && !document.querySelector('[data-pending]')`);
        await change('select[name="currency"]', pricedUnit.currency);
        await change('input[name="max_price"]', '0');
        await until(`!document.querySelector('[data-pending]') && document.querySelector('#price-filter-error')?.textContent.includes('mínimo')`);
        await change('input[name="max_price"]', pricedUnit.price);
        await until(`!document.querySelector('[data-pending]') && !document.querySelector('#price-filter-error') && !!document.querySelector('.inventory-catalog-row')`);
        assert.equal(await evaluate(`new URLSearchParams(location.search).get('min_price')`), pricedUnit.price);
        assert.equal(await evaluate('performance.timeOrigin'), priceOrigin, 'Precios no recargan el documento');
        await capture('inventario-precios');
        await evaluate(`document.querySelector('.inventory-catalog-row').click()`);
        await until(`!!document.querySelector('.inventory-filter-summary') && !!document.querySelector('.inventory-unit')`);
        assert.match(await evaluate(`document.querySelector('.inventory-filter-summary').textContent`), new RegExp(pricedUnit.currency));
        await go('/vehiculos');
        await until(`Object.keys(document.querySelector('.inventory-filters')).some(key => key.startsWith('__reactProps'))`);
        await change('select[name="currency"]', pricedUnit.currency);
        await change('input[name="max_price"]', '0');
        await until(`!document.querySelector('[data-pending]') && new URLSearchParams(location.search).get('max_price') === '0' && !document.querySelector('.inventory-catalog-row')`);
        await click('Limpiar');
        await until(`!document.querySelector('[data-pending]') && location.search === ''`);
        assert.equal(await evaluate(`document.querySelector('input[name="max_price"]').value`), '');
      }
    }
    console.log('OK: búsqueda dinámica, año/transmisión, rango de precios y moneda, limpieza, foco y Enter sin recarga.');
    for (const width of [1440, 768, 390, 320]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width <= 390 });
      await go('/vehiculos');
      await check(`${width} catálogo real`);
      assert.equal(await evaluate(`!!document.querySelector('.preview-banner')`), false);
      assert.equal(await evaluate(`!!document.querySelector('.inventory-filters')`), true);
      await capture(`inventario-${width}`);
      if (firstVehicle) {
        await go(firstVehicle.route);
        await until(`!!document.querySelector('.inventory-units, .empty-state')`);
        await check(`${width} ficha real`);
        await capture(`ficha-inventario-${width}`);
        const unitCode = await evaluate(`document.querySelector('.inventory-unit-top p strong')?.textContent ?? null`);
        if (unitCode && await evaluate(`!!document.querySelector('button[aria-label^="Editar unidad"]')`)) {
        await click('Editar unidad');
        await until(`!!document.querySelector('dialog[open]')`);
        assert.equal(await evaluate(`!!document.querySelector('input[name="internal_code"]')`), false);
        assert.equal(await evaluate(`document.querySelector('dialog').textContent.includes('Código interno')`), false);
        assert.equal(await evaluate(`document.activeElement.name`), 'version');
        await check(`${width} edición sin guardar`);
        await capture(`unidad-inventario-${width}`);
        await click('Cancelar');
        await until(`!document.querySelector('dialog[open]')`);
        assert.match(await evaluate(`document.activeElement.textContent`), /Editar unidad/);
        }
        await click('Agregar unidad');
        await until(`!!document.querySelector('dialog[open]')`);
        assert.equal(await evaluate(`document.querySelector('dialog').textContent.includes('Código interno')`), false);
        await capture(`agregar-unidad-${width}`);
        await click('Cancelar');
      }
      await go('/vehiculos/nuevo');
      await until(`!!document.querySelector('.inventory-form') && Object.keys(document.querySelector('.inventory-form')).some(key => key.startsWith('__reactProps'))`);
      await check(`${width} alta real`);
      await click('Crear vehículo');
      await until(`document.querySelectorAll('.field-error').length === 2`);
      assert.equal(await evaluate(`document.activeElement.name`), 'brand');
      assert.equal(await evaluate(`document.querySelectorAll('label .required-mark').length`), 2);
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('.required-mark')).color`), 'rgb(197, 38, 49)');
      await capture(`alta-inventario-${width}`);
      console.log(`OK: catálogo conectado, alta vacía bloqueada, foco y asteriscos a ${width}px.`);
    }
    await writeFile(join(output, 'report-inventory.json'), JSON.stringify({ assertions, errors }, null, 2));
    assert.deepEqual(errors, [], 'Errores en inventario');
    await click('Salir');
    await until(`location.pathname === '/login'`);
    await send('Browser.close');
  }
} finally {
  for (const call of pending.values()) clearTimeout(call.timer);
  socket?.close();
  browser.kill();
}
