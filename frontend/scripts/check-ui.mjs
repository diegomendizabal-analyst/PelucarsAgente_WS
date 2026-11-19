// Regresión visual y de navegación contra un servidor local ya iniciado.
// Uso: npm run check:ui -- http://127.0.0.1:3100 [--hmr]
// Requiere Chrome/Chromium local; CHROME_BIN permite indicar su ejecutable.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const base = process.argv.find((arg) => /^https?:/.test(arg)) ?? 'http://127.0.0.1:3100';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Usar un servidor local.');
const hmr = process.argv.includes('--hmr');
const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, '.next', 'ui-qa', hmr ? 'dev' : 'build');
const executable = [process.env.CHROME_BIN, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find((path) => path && existsSync(path));
assert(executable, 'No se encontró Chrome/Chromium. Definir CHROME_BIN.');
await mkdir(output, { recursive: true });
const profile = join(tmpdir(), `pelucars-ui-${process.pid}`);
const browser = spawn(executable, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket;
let originalCss;
const cssPath = join(root, 'src', 'app', 'globals.css');
const pending = new Map();
const errors = [];
let id = 0;
let assertions = 0;
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
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
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
    await until(`location.pathname === ${JSON.stringify(route)} && document.readyState === 'complete' && !!document.querySelector('h1')`);
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
  const routes = ['/', '/clientes', '/vehiculos', '/clientes/demo-ana', '/clientes/demo-bruno', '/oportunidades/demo-consulta-ana', '/oportunidades/demo-consulta-bruno', '/vehiculos/demo-corolla', '/vehiculos/demo-cronos', '/vehiculos/demo-corolla/editar', '/vehiculos/nuevo', '/clientes/vista-previa', '/oportunidades/vista-previa', '/vehiculos/vista-previa', '/vehiculos/vista-previa/editar'];
  for (const width of [1440, 768, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width <= 390 });
    for (const route of routes) {
      await go(route);
      for (const role of ['vendedor', 'admin']) {
        if (role === 'admin') await change('#preview-role', role);
        await check(`${width} ${route} ${role}`);
        if (route.endsWith('/editar') || route.endsWith('/nuevo')) assert.equal(await evaluate(`!!document.querySelector('form')`), role === 'admin', 'Formulario Admin');
        const tabs = route.startsWith('/oportunidades/demo-') ? ['Historial', 'Seguimiento', 'Conversación'] : route.startsWith('/clientes/demo-') ? ['Recontactos', 'Compras', 'Consultas'] : [];
        for (const tab of tabs) { await click(tab); await check(`${width} ${route} ${role} ${tab}`); }
      }
    }
    await go('/');
    await click('Mis oportunidades');
    await check(`${width} Mis oportunidades`);
    console.log(`OK: ${width}px, ambos roles, listados y secciones de fichas.`);
    if (width === 1440 || width === 390) {
      await go('/'); await capture(`bandeja-${width}`);
      await go('/oportunidades/demo-consulta-bruno');
      await click('Historial'); await capture(`historial-${width}`);
      await click('Seguimiento'); await capture(`actividades-${width}`);
      await click('Conversación'); await capture(`conversacion-${width}`);
    }
  }
  await go('/');
  assert.match(await evaluate(`document.querySelector('.panel-footer').textContent`), /1 oportunidad de ejemplo/);
  await click('Mis oportunidades');
  assert.match(await evaluate(`document.querySelector('.demo-list').textContent`), /Bruno López/);
  await change('input[type=search]', 'inexistente');
  assert.match(await evaluate('document.body.textContent'), /0 oportunidades de ejemplo/);
  await go('/clientes');
  await change('input[type=search]', 'martinez');
  assert.match(await evaluate(`document.querySelector('.panel-footer').textContent`), /1 cliente de ejemplo/);
  await go('/vehiculos');
  await change('select[aria-label="Filtrar por stock"]', 'sin-stock');
  assert.match(await evaluate(`document.querySelector('.panel-footer').textContent`), /1 vehículo de ejemplo/);
  assert.match(await evaluate(`document.querySelector('.demo-list').textContent`), /Cronos/);
  await go('/oportunidades/demo-consulta-ana');
  await click('Historial'); await click('Ver mensaje original');
  await until(`document.activeElement.id === 'demo-mensaje-ana-1'`);
  await go('/clientes/demo-bruno');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.metric > strong')].map(el => el.textContent)`), ['1', '4', '1', '1']);
  await go('/vehiculos/demo-corolla');
  await change('#preview-role', 'admin');
  await evaluate(`document.querySelector('a[href="/vehiculos/demo-corolla/editar"]').click()`);
  await until(`location.pathname.endsWith('/editar') && !!document.querySelector('form')`);
  assert.equal(await evaluate(`document.querySelector('input[name=marca]').value`), 'Toyota');
  if (hmr) {
    await go('/');
    originalCss = await readFile(cssPath, 'utf8');
    await writeFile(cssPath, originalCss + '\n.demo-row { --ui-regression-marker: applied; }\n');
    await until(`getComputedStyle(document.querySelector('.demo-row')).getPropertyValue('--ui-regression-marker').trim() === 'applied'`);
    await writeFile(cssPath, originalCss);
    originalCss = undefined;
    await until(`getComputedStyle(document.querySelector('.demo-row')).getPropertyValue('--ui-regression-marker').trim() === ''`);
    await check('CSS HMR sin recarga');
    console.log('OK: cambios de CSS aplicados y revertidos sin recarga ni reinicio.');
  }
  await writeFile(join(output, 'report.json'), JSON.stringify({ assertions, errors }, null, 2));
  assert.deepEqual([...new Set(errors.map((error) => error.split('\n')[0]))], [], 'Errores de consola/hidratación (detalle en report.json)');
  console.log(JSON.stringify({ assertions, mode: hmr ? 'dev + HMR' : 'build', errors, screenshots: output }));
  await send('Browser.close');
} finally {
  if (originalCss !== undefined) await writeFile(cssPath, originalCss);
  for (const call of pending.values()) clearTimeout(call.timer);
  socket?.close();
  browser.kill();
}
