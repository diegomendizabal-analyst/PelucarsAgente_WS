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
const reportsOnly = process.argv.includes('--reports');
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
    await capture('failure');
    const state = await evaluate(`({path:location.pathname,title:document.querySelector('h1')?.textContent,feedback:document.querySelector('[role="alert"]')?.textContent})`);
    throw new Error(`No se cumplió: ${expression}; ${JSON.stringify(state)}`);
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
    await until(`location.pathname === '${role === 'admin' ? '/reportes' : '/oportunidades'}' && !!document.querySelector('.account-menu')`);
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
      await capture('overflow');
      const overflowing = await evaluate(`[...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1).slice(0, 8).map(el => ({className:el.className,right:el.getBoundingClientRect().right}))`);
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
  for (const route of ['/', '/reportes', '/reportes/detalle', '/usuarios', '/clientes/demo-ana', '/vehiculos/demo-corolla/editar']) {
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
    console.log('OK: login responsive y rutas protegidas sin sesión, incluyendo Reportes y detalle. No se probaron cuentas reales.');
    await send('Browser.close');
  } else if (process.argv.includes('--review')) {
    const { reviewResponsive } = await import('./review-responsive.mjs');
    await reviewResponsive({ send, evaluate, until, go, change, click, signIn, root, credentials, errors });
    await send('Browser.close');
  } else if (process.argv.includes('--budget')) {
    await signIn('admin');
    const catalog='/vehiculos?q=DEMO+Ford&currency=ARS&max_price=1000000000';
    await go(catalog);
    assert.equal(await evaluate(`!!document.querySelector('main [role="alert"]')`),false);
    const ford=await evaluate(`document.querySelector('.inventory-catalog-row')?.getAttribute('href')`);
    assert(ford,'Ford demo encontrado');
    assert((await evaluate(`document.querySelector('.inventory-catalog-name p').textContent`)).includes('3 unidades coinciden'));
    await go(ford);
    const originals=await evaluate(`[...document.querySelectorAll('.inventory-price')].map(el=>el.textContent)`);
    assert(originals.some(x=>x.startsWith('ARS ')) && originals.some(x=>x.startsWith('USD ')),'Una búsqueda ARS incluye ambas monedas');
    assert.equal(await evaluate(`document.querySelectorAll('.inventory-equivalent').length`),2);
    assert((await evaluate(`document.querySelector('.inventory-quote').textContent`)).includes('Oficial venta'));
    const usdUrl=new URL(ford,base); usdUrl.searchParams.set('currency','USD'); usdUrl.searchParams.set('max_price','1000000');
    await go(usdUrl.pathname+usdUrl.search);
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('.inventory-price')].map(el=>el.textContent)`),originals,'No cambia los precios originales');
    assert.equal(await evaluate(`document.querySelectorAll('.inventory-equivalent').length`),1,'Sólo el precio ARS necesita equivalencia USD');
    assert.match(await evaluate(`document.querySelector('.inventory-equivalent').textContent`),/USD/);
    for(const width of [1440,390,320]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<=390});
      await check(width+' equivalencias en ficha'); await capture('presupuesto-ficha-'+width);
    }
    await go('/vehiculos');
    const origin=await evaluate('performance.timeOrigin');
    await change('select[name="currency"]','ARS');
    await change('input[name="price_max"]','1000000000');
    await until(`new URLSearchParams(location.search).get('max_price') === '1000000000' && !document.querySelector('[data-pending]') && !!document.querySelector('.inventory-quote')`);
    assert.equal(await evaluate('performance.timeOrigin'),origin);
    assert.equal(await evaluate(`document.querySelectorAll('.inventory-catalog-row').length`),3);
    await capture('presupuesto-filtros');
    assert.deepEqual(errors,[]);
    await writeFile(join(output,'report-budget.json'),JSON.stringify({assertions,errors},null,2));
    console.log('OK: presupuesto ARS y USD incluye ambas monedas, equivalencias, precios originales, filtros sin recarga y tres anchos.');
    await click('Salir'); await until(`location.pathname === '/login'`); await send('Browser.close');
  } else if (process.argv.includes('--exchange')) {
    await signIn('admin');
    await until(`!!document.querySelector('.dollar-values dd')`);
    const rates=await evaluate(`[...document.querySelectorAll('.dollar-values dd')].map(el=>Number(el.textContent.replace('ARS ','').replaceAll('.','').replace(',','.')))`);
    assert.equal(rates.length,2);
    const format=value=>new Intl.NumberFormat('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
    const origin=await evaluate('performance.timeOrigin');
    await evaluate(`document.querySelector('.dollar-details').open=true`);
    await change('input[name="conversion_amount"]','1000');
    assert.equal(await evaluate(`document.querySelector('.dollar-conversion-result output').textContent`),'—','Sin tasa elegida no inventa resultado');
    for (const [side,rate] of [['compra',rates[0]],['venta',rates[1]]]) {
      await change('select[name="conversion_side"]',side);
      await change('select[name="conversion_from"]','ARS');
      assert.equal(await evaluate(`document.querySelector('.dollar-conversion-result output').textContent`),`USD ${format(1000/rate)}`);
      await change('select[name="conversion_from"]','USD');
      await change('input[name="conversion_amount"]','2,50');
      assert.equal(await evaluate(`document.querySelector('.dollar-conversion-result output').textContent`),`ARS ${format(2.5*rate)}`);
      assert((await evaluate(`document.querySelector('.dollar-conversion-rate').textContent`)).includes(side==='compra'?'Compra':'Venta'));
      await change('input[name="conversion_amount"]','1000');
    }
    for(const invalid of ['-10','1.234,56','1e3']) {
      await change('input[name="conversion_amount"]',invalid);
      assert.equal(await evaluate(`document.querySelector('.dollar-conversion-result output').textContent`),'—');
      assert.equal(await evaluate(`!!document.querySelector('#conversion-error')`),true);
    }
    await change('input[name="conversion_amount"]','0');
    assert.equal(await evaluate(`document.querySelector('.dollar-conversion-result output').textContent`),'ARS 0,00');
    await change('input[name="conversion_amount"]','');
    assert.equal(await evaluate(`document.querySelector('.dollar-conversion-result output').textContent`),'—');
    await change('input[name="conversion_amount"]','100');
    assert.equal(await evaluate('performance.timeOrigin'),origin,'Calcular no recarga ni navega');
    for(const width of [1440,390,320]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height:600,deviceScaleFactor:1,mobile:width<=390});
      await check(width+' conversor');
      assert.equal(await evaluate(`document.querySelector('.dollar-popover').getBoundingClientRect().bottom<=innerHeight`),true,'Panel accesible en pantalla corta');
      await capture('conversor-'+width);
    }
    await evaluate(`document.querySelector('button[aria-label="Cerrar cotización"]').click()`);
    assert.equal(await evaluate(`document.querySelector('.dollar-details').open`),false);
    assert.equal(await evaluate(`document.activeElement.tagName`),'SUMMARY');
    assert.deepEqual(errors,[]);
    await writeFile(join(output,'report-exchange.json'),JSON.stringify({assertions,errors},null,2));
    console.log('OK: conversor ARS/USD, Compra/Venta explícitas, validación, cero/vacío, foco y tres anchos. Sin persistencia comercial.');
    await click('Salir'); await until(`location.pathname === '/login'`); await send('Browser.close');
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
      if (enabled) {
        await go('/');
        assert.equal(await evaluate('location.pathname'),'/oportunidades');
        assert.equal(await evaluate(`!!document.querySelector('nav a[href="/reportes"]')`),false);
        await check('Inicio vendedor habilitado');
      }
      for(const route of enabled ? ['/reportes','/reportes/detalle','/usuarios','/vehiculos/nuevo','/vehiculos/e2000001-0000-4000-8000-000000000001/editar'] : ['/reportes','/reportes/detalle','/','/clientes','/usuarios','/vehiculos']) {
        await send('Page.navigate',{url:base+route});
        await until(`location.pathname === '/acceso-denegado' && !!document.querySelector('h1')`);
        assert.equal(await evaluate(`!!document.querySelector('.crm-lead-row,.crm-customer-row,.users-table')`),false);
      }
      assert.deepEqual(errors,[],'Errores en rechazo de acceso');
      console.log(`OK: JWT válido, ${enabled ? 'restricción de vendedor' : 'perfil deshabilitado rechazado'} antes de mostrar datos.`);
    } finally { await client.auth.signOut({scope:'local'}); }
    await send('Browser.close');
  } else if (process.argv.includes('--real')) {
    await signIn('admin');
    for (const route of ['/reportes?source=demo','/vehiculos','/clientes','/oportunidades?tab=all']) {
      await go(route);
      assert.equal(await evaluate(`!!document.querySelector('[role="switch"],.demo-tool-banner')`),false);
      assert.equal(await evaluate(`!!document.querySelector('main [role="alert"]')`),false);
      if(route.startsWith('/reportes')) {
        assert.equal(await evaluate(`Number(document.querySelector('.report-card strong')?.textContent)`),0);
      } else if(route.startsWith('/vehiculos')) {
        assert.equal(await evaluate(`[...document.querySelectorAll('.inventory-catalog-row h2')].some(el=>el.textContent.includes('DEMO'))`),false);
      } else assert.equal(await evaluate(`document.querySelectorAll('.crm-customer-row,.crm-lead-row').length`),0);
    }
    console.log('OK: flag desactivado oculta herramienta y excluye muestras, incluso con source=demo en URL.');
    assert.deepEqual(errors,[]);
    await click('Salir'); await until(`location.pathname === '/login'`); await send('Browser.close');
  } else if (reportsOnly) {
    await signIn('admin');
    assert.equal(await evaluate('location.pathname'),'/reportes','Inicio de admin');
    assert.equal(await evaluate(`!!document.querySelector('nav a[href="/reportes"][aria-current="page"]')`),true);
    for(const width of (smoke ? [390,320] : [1440,768,390,320])) {
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<=390});
      await go('/reportes'); await check(width+' reportes');
      assert.equal(await evaluate(`!!document.querySelector('select[name="source"]')`),false);
      assert.equal(await evaluate(`document.querySelector('[role="switch"]').getAttribute('aria-checked')`),'true');
      assert((await evaluate(`Number(document.querySelector('.report-card strong')?.textContent)`))>0,'Hay cifras de demo');
      assert.equal(await evaluate(`document.querySelector('select[name="seller"]').value`),'');
      assert.equal(await evaluate(`!!document.querySelector('main [role="alert"]')`),false,'Sin error inesperado de consulta');
      assert((await evaluate('document.querySelector("main").textContent')).includes('No disponible — pendiente de integración'));
      await capture('reportes-'+width);
      await go('/oportunidades?tab=all');
      const route=await evaluate('document.querySelector(".crm-lead-link")?.getAttribute("href")');
      if(route) {
        await go(route); await check(width+' oportunidad');
        assert.equal(await evaluate('getComputedStyle(document.querySelector(".back-link")).borderTopWidth'),'1px');
        assert((await evaluate('document.querySelector("main").textContent')).includes('Resumen de la consulta'));
        const vehicle=await evaluate('[...document.querySelectorAll(".crm-interest a")][0]?.getAttribute("href")');
        await capture('reportes-oportunidad-'+width);
        if(vehicle) { await go(vehicle); await check(width+' vehículo'); assert((await evaluate('document.querySelector("main").textContent')).includes('Oportunidades interesadas')); assert.equal(await evaluate(`!!document.querySelector('main [role="alert"]')`),false); await capture('reportes-vehiculo-'+width); }
      }
      // La primera oportunidad puede tener búsqueda genérica, sin vínculo al catálogo.
      await go('/vehiculos');
      const catalogVehicle = await evaluate('document.querySelector(".inventory-catalog-row")?.getAttribute("href")');
      assert(catalogVehicle,'Se requiere un vehículo existente para revisar el listado inverso');
      await go(catalogVehicle); await check(width+' oportunidades por vehículo');
      assert((await evaluate('document.querySelector("main").textContent')).includes('Oportunidades interesadas'));
      assert.equal(await evaluate(`!!document.querySelector('main [role="alert"]')`),false);
      await capture('reportes-vehiculo-'+width);
    }
    await go('/reportes');
    const reportOrigin=await evaluate('performance.timeOrigin');
    assert.equal(await evaluate(`!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Aplicar filtros'))`),false);
    assert.equal(await evaluate(`!!document.querySelector('.demo-tool-banner')`),false);
    assert.equal(await evaluate(`document.querySelector('main').textContent.includes('Los filtros se aplican automáticamente')`),false);
    const seller = await evaluate(`document.querySelector('select[name="seller"] option[value]:not([value=""])')?.value`);
    assert(seller,'El selector debe cargar perfiles aunque la RPC esté pendiente');
    await change('select[name="seller"]',seller);
    await until(`new URLSearchParams(location.search).get('seller') === ${JSON.stringify(seller)}`);
    assert.equal(await evaluate(`document.querySelector('select[name="seller"]').value`),seller);
    assert.equal(await evaluate('performance.timeOrigin'),reportOrigin,'Filtrar reportes no recarga el documento');
    await change('input[name="from"]','2026-01-01');
    await until(`new URLSearchParams(location.search).get('from') === '2026-01-01' && !document.querySelector('[data-pending]')`);
    assert.equal(await evaluate('performance.timeOrigin'),reportOrigin);
    await go('/reportes/detalle?from=2026-11-01&to=2026-11-24&source=demo&seller=&metric=inquiries');
    assert((await evaluate('document.querySelectorAll(".report-detail-list li").length'))>0,'Detalle conectado');
    await go('/vehiculos');
    const inventoryOrigin=await evaluate('performance.timeOrigin');
    await change('input[name="year_min"]','2016'); await change('input[name="year_max"]','2020');
    await until(`new URLSearchParams(location.search).get('year_max') === '2020' && !document.querySelector('[data-pending]')`);
    assert.equal(await evaluate(`document.querySelector('input[aria-label="Año del vehículo: máximo"]').value`),'2020');
    await evaluate(`document.querySelector('input[aria-label="Año del vehículo: máximo"]').focus()`);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});
    await until(`new URLSearchParams(location.search).get('year_max') === '2019' && !document.querySelector('[data-pending]')`);
    assert.equal(await evaluate(`document.querySelector('input[name="year_max"]').value`),'2019');
    await change('select[name="currency"]','USD');
    await change('input[name="price_min"]','17500.50');
    await until(`new URLSearchParams(location.search).get('min_price') === '17500.50' && !document.querySelector('[data-pending]')`);
    assert.equal(await evaluate(`document.querySelector('input[aria-label="Presupuesto: mínimo"]').value`),'17500.5');
    await change('input[aria-label="Presupuesto: máximo"]','25000');
    await until(`new URLSearchParams(location.search).get('max_price') === '25000' && !document.querySelector('[data-pending]')`);
    assert.equal(await evaluate(`document.querySelector('input[name="price_max"]').value`),'25000');
    assert.equal(await evaluate('performance.timeOrigin'),inventoryOrigin,'Rangos sin recarga');
    const demoOrigin=await evaluate('performance.timeOrigin');
    await click('Datos demo');
    await until(`performance.timeOrigin !== ${demoOrigin} && document.readyState === 'complete' && document.querySelector('[role="switch"]')?.getAttribute('aria-checked') === 'false'`);
    for(const route of ['/vehiculos','/clientes','/oportunidades?tab=all','/reportes']) {
      await go(route); assert.equal(await evaluate(`document.querySelectorAll('.inventory-catalog-row,.crm-customer-row,.crm-lead-row,.report-card strong:not(.report-text-value)').length`),0,'Vista vacía sin datos reales');
    }
    const emptyOrigin=await evaluate('performance.timeOrigin');
    await click('Datos demo');
    await until(`performance.timeOrigin !== ${emptyOrigin} && document.readyState === 'complete' && document.querySelector('[role="switch"]')?.getAttribute('aria-checked') === 'true' && Number(document.querySelector('.report-card strong')?.textContent)>0`);
    await until(`!!document.querySelector('button[aria-label="Actualizar cotización"]:not(:disabled)')`);
    await evaluate(`window.__quoteRefresh=0; const original=window.fetch; window.fetch=function(...args){ if(String(args[0]).includes('/api/cotizacion?refresh=1')) window.__quoteRefresh++; return original.apply(this,args); };`);
    await evaluate(`document.querySelector('button[aria-label="Actualizar cotización"]').click()`);
    await until(`window.__quoteRefresh===1 && !!document.querySelector('button[aria-label="Actualizar cotización"]:not(:disabled)')`);
    assert.equal(await evaluate(`!!document.querySelector('.topbar .dollar-widget')`),true);
    await evaluate(`document.querySelector('.dollar-details').open=true`);
    await check('Widget desplegado en móvil');
    await capture('dolar-desplegado');
    await evaluate(`document.querySelector('.dollar-details').open=false`);
    const quote=await evaluate(`fetch('/api/cotizacion').then(async r=>({status:r.status,data:await r.json()}))`);
    assert.equal(quote.status,200,'DolarAPI disponible'); assert.equal(quote.data.casa,'oficial');
    assert(quote.data.compra>0 && quote.data.venta>0);
    await go('/reportes?from=2026-11-24&to=2026-11-01');
    assert((await evaluate('document.querySelector("main").textContent')).includes('Filtros inválidos'));
    assert.equal(await evaluate('document.querySelectorAll(".report-card strong:not(.report-text-value)").length'),0);
    assert.deepEqual(errors,[],'Errores de consola Reportes');
    await writeFile(join(output,'report-reports.json'),JSON.stringify({assertions,errors},null,2));
    console.log(`OK: Reportes poblados/detalle, filtros automáticos, deslizadores/valor exacto, demo/vacío, DolarAPI y ${smoke ? 2 : 4} anchos. Sin mutaciones comerciales.`);
    await click('Salir'); await until(`location.pathname === '/login'`); await send('Browser.close');
  } else if (timingOnly) {
    await signIn('admin');
    const timings = [];
    for (let round=0; round<3; round++) {
      for (const route of ['/oportunidades', '/clientes', '/oportunidades/e2000003-0000-4000-8000-000000000003']) {
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
      for (const route of ['/oportunidades', '/oportunidades?tab=mine', '/oportunidades?tab=all', '/clientes']) {
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
      await go('/oportunidades?tab=all');
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
      await go('/oportunidades'); await capture(`crm-espera-${width}`);
      console.log(`OK: CRM conectado a ${width}px; ${customers.length} fichas de cliente y ${leads.length} oportunidades, sin guardar cambios.`);
    }
    await go('/oportunidades?tab=mine');
    await change('select[name="status"]','lost');
    await until(`new URLSearchParams(location.search).get('status') === 'lost'`);
    await go('/clientes'); await change('input[name="q"]','Sin coincidencia CRM');
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
    const availableYear = await evaluate(`document.querySelector('input[type="range"][aria-label="Año del vehículo: mínimo"]')?.min ?? null`);
    if (availableYear) {
      await change('input[name="year_min"]', availableYear);
      await change('input[name="year_max"]', availableYear);
      await change('select[name="transmission"]', 'automatic');
      await until(`!document.querySelector('[data-pending]') && new URLSearchParams(location.search).get('year_min') === ${JSON.stringify(availableYear)} && new URLSearchParams(location.search).get('transmission') === 'automatic'`);
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
        await change('select[name="currency"]', pricedUnit.currency);
        await change('input[name="price_min"]', pricedUnit.price);
        await change('input[name="price_max"]', '0');
        await until(`!document.querySelector('[data-pending]') && document.querySelector('.inventory-filter-area .field-error')?.textContent.includes('mínimo')`);
        await change('input[name="price_max"]', pricedUnit.price);
        await until(`!document.querySelector('[data-pending]') && !document.querySelector('.inventory-filter-area .field-error') && !!document.querySelector('.inventory-catalog-row')`);
        assert.equal(await evaluate(`new URLSearchParams(location.search).get('min_price')`), pricedUnit.price);
        assert.equal(await evaluate('performance.timeOrigin'), priceOrigin, 'Precios no recargan el documento');
        await capture('inventario-precios');
        await evaluate(`document.querySelector('.inventory-catalog-row').click()`);
        await until(`!!document.querySelector('.inventory-filter-summary') && !!document.querySelector('.inventory-unit')`);
        assert.match(await evaluate(`document.querySelector('.inventory-filter-summary').textContent`), new RegExp(pricedUnit.currency));
        await go('/vehiculos');
        await until(`Object.keys(document.querySelector('.inventory-filters')).some(key => key.startsWith('__reactProps'))`);
        await change('select[name="currency"]', pricedUnit.currency);
        await change('input[name="price_max"]', '0');
        await until(`!document.querySelector('[data-pending]') && new URLSearchParams(location.search).get('max_price') === '0' && !document.querySelector('.inventory-catalog-row')`);
        await click('Limpiar');
        await until(`!document.querySelector('[data-pending]') && location.search === ''`);
        assert.equal(await evaluate(`document.querySelector('input[name="price_max"]').value`), '');
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
