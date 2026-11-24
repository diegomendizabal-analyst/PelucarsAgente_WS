// Recorridos reales de sólo lectura. No enviar formularios de alta/edición.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export async function reviewResponsive({ send, evaluate, until, go, change, click, signIn, root, credentials, errors }) {
  const phase = process.argv.includes('--before') ? 'before' : 'after';
  const output = join(root, '..', '.pr-work', 'visual-review', phase);
  await mkdir(output, { recursive: true });
  const observations = [];
  async function key(key, code = key, modifiers = 0) {
    const windowsVirtualKeyCode = key === 'Escape' ? 27 : key === 'Tab' ? 9 : 0;
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers, windowsVirtualKeyCode });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers, windowsVirtualKeyCode });
  }
  async function shot(name, viewport = false) {
    await evaluate('document.fonts.ready');
    await delay(150);
    const size = await evaluate('({width:innerWidth,height:innerHeight,full:document.documentElement.scrollHeight})');
    const image = await send('Page.captureScreenshot', { format:'png', captureBeyondViewport:!viewport,
      clip:{x:0,y:0,width:size.width,height:viewport ? size.height : Math.min(size.full,6000),scale:1} });
    await writeFile(join(output, `${name}.png`), Buffer.from(image.data,'base64'));
    const layout = await evaluate(`(() => {
      const w=document.documentElement.clientWidth;
      const visible=el=>el.getClientRects().length && getComputedStyle(el).visibility!=='hidden' && !el.closest('.sr-only');
      const outside=[...document.querySelectorAll('main *, .topbar *, dialog[open] *')].filter(visible).filter(el=>{
        const r=el.getBoundingClientRect(); return r.right>w+1 || r.left< -1;
      }).slice(0,12).map(el=>({tag:el.tagName,css:typeof el.className==='string'?el.className:'svg',right:Math.round(el.getBoundingClientRect().right)}));
      const top=[...document.querySelector('.topbar')?.children??[]].map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,css:el.className};});
      const overlaps=top.flatMap((a,i)=>top.slice(i+1).filter(b=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1).map(b=>[a.css,b.css]));
      const d=document.querySelector('dialog[open]'); const r=d?.getBoundingClientRect();
      return {pageOverflow:document.documentElement.scrollWidth>w,outside,overlaps,dialog:r?{top:r.top,bottom:r.bottom,height:innerHeight,focusInside:d.contains(document.activeElement)}:null};
    })()`);
    observations.push({name,route:await evaluate('location.pathname+location.search'),...layout});
    console.log(`${name}: overflow=${layout.pageOverflow}, overlaps=${layout.overlaps.length}`);
  }
  async function dialog(name, trigger) {
    await evaluate(`${trigger}.click()`);
    await until(`!!document.querySelector('dialog[open]')`);
    await shot(name,true);
    await evaluate(`document.querySelector('dialog[open]').scrollTop=10000`);
    await shot(`${name}-final`,true);
    assert(await evaluate(`(() => {const d=document.querySelector('dialog[open]'); const b=[...d.querySelectorAll('button')].at(-1).getBoundingClientRect();return b.top>=0 && b.bottom<=innerHeight;})()`),'Acciones alcanzables al final del modal');
    // Shift+Tab y Tab deben quedar dentro del modal nativo.
    for(let i=0;i<3;i++) await key('Tab','Tab',1);
    assert(await evaluate(`document.querySelector('dialog[open]').contains(document.activeElement)`));
    await evaluate(`document.querySelector('dialog[open] button:last-of-type')?.focus()`);
    await key('Tab');
    assert(await evaluate(`document.querySelector('dialog[open]').contains(document.activeElement)`));
    await key('Escape');
    await until(`!document.querySelector('dialog[open]')`);
    assert(await evaluate(`document.activeElement === ${trigger}`),'Se devuelve el foco al disparador');
  }
  await signIn('admin');
  await go('/oportunidades?tab=all');
  const lead=await evaluate(`document.querySelector('.crm-lead-link')?.getAttribute('href')`);
  await go('/clientes');
  const customer=await evaluate(`document.querySelector('.crm-customer-row')?.getAttribute('href')`);
  await go('/vehiculos');
  const vehicle=await evaluate(`(() => {const a=document.querySelector('.inventory-catalog-row');return a ? new URL(a.href).pathname : null;})()`);
  assert(lead && customer && vehicle,'Se requieren las muestras existentes, no se cargan otras');
  const routes=[['reportes','/reportes'],['detalle','/reportes/detalle?from=2026-11-01&to=2026-11-24&metric=inquiries'],
    ['oportunidades','/oportunidades?tab=all'],['oportunidad',lead],['clientes','/clientes'],['cliente',customer],
    ['catalogo','/vehiculos'],['vehiculo',vehicle],['editar-vehiculo',`${vehicle}/editar`],['nuevo-vehiculo','/vehiculos/nuevo'],['usuarios','/usuarios']];
  if(process.argv.includes('--forms-only')) {
    for(const width of [1440,1024,768,390,320]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<=390});
      await send('Emulation.setTouchEmulationEnabled',{enabled:width<=390});
      for(const [name,route] of routes.filter(([n])=>['editar-vehiculo','nuevo-vehiculo'].includes(n))) {
        await go(route); await until(`!!document.querySelector('input[name="brand"]')`); await shot(`admin-${width}-${name}`);
      }
    }
    await writeFile(join(output,'review-forms.json'),JSON.stringify({phase,observations,errors},null,2));
    assert.deepEqual(observations.filter(o=>o.pageOverflow || o.overlaps.length),[]);
    assert.deepEqual(errors,[]);
    return;
  }
  for(const width of (process.argv.includes('--states-only') ? [] : [1440,1024,768,390,320])) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<=390});
    await send('Emulation.setTouchEmulationEnabled',{enabled:width<=390});
    for(const [name,route] of routes) {
      await go(route);
      if(name==='editar-vehiculo' || name==='nuevo-vehiculo') await until(`!!document.querySelector('input[name="brand"]')`);
      await shot(`admin-${width}-${name}`);
    }
    await dialog(`admin-${width}-crear-usuario`,`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Crear vendedor'))`);
    const edit=`document.querySelector('.user-row-action button')`;
    if(await evaluate(`!!${edit}`)) await dialog(`admin-${width}-editar-usuario`,edit);
    await go(vehicle);
    await dialog(`admin-${width}-unidad`,`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Agregar unidad'))`);
    await go('/reportes');
    await evaluate(`document.querySelector('.assignment-notifications').open=true`);
    await shot(`admin-${width}-notificaciones`,true);
    await evaluate(`document.querySelector('.assignment-notifications').open=false; document.querySelector('.dollar-details').open=true`);
    await until(`!!document.querySelector('button[aria-label="Actualizar cotización"]:not(:disabled)')`);
    await shot(`admin-${width}-dolar`,true);
    await evaluate(`document.querySelector('.dollar-details summary').focus()`); await key('Escape');
    assert(await evaluate(`!document.querySelector('.dollar-details').open`));
  }
  await send('Emulation.setDeviceMetricsOverride',{width:320,height:700,deviceScaleFactor:1,mobile:true});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true});
  // Carga/error de proveedor simulados sólo en este navegador, sin tocar datos.
  await go('/reportes');
  await until(`!!document.querySelector('button[aria-label="Actualizar cotización"]:not(:disabled)')`);
  await evaluate(`window.__originalFetch=window.fetch; window.fetch=async function(...args){if(String(args[0]).includes('/api/cotizacion')){await new Promise(r=>setTimeout(r,1500));return new Response('{}',{status:503});}return window.__originalFetch.apply(this,args);}; document.querySelector('button[aria-label="Actualizar cotización"]').click()`);
  await shot('admin-320-cotizacion-cargando',true);
  await until(`!!document.querySelector('.dollar-error')`);
  await evaluate(`document.querySelector('.dollar-details').open=true`);
  await shot('admin-320-cotizacion-error-simulado',true);
  await evaluate(`window.fetch=window.__originalFetch`);
  await go('/vehiculos');
  await send('Network.enable');
  await send('Network.emulateNetworkConditions',{offline:false,latency:900,downloadThroughput:-1,uploadThroughput:-1});
  await change('input[name="q"]','Ford'); await shot('admin-320-filtro-cargando');
  await until(`!document.querySelector('[data-pending]') && new URLSearchParams(location.search).get('q')==='Ford'`);
  await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  const slider=await evaluate(`(() => {const s=document.querySelector('.range-slider');s.scrollIntoView({block:'center'});const r=s.getBoundingClientRect();return {x:r.x+r.width*.3,y:r.y+r.height/2};})()`);
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...slider,radiusX:5,radiusY:5}]});
  await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await until(`!!document.querySelector('input[name="year_min"]').value && !document.querySelector('[data-pending]')`);
  assert.equal(await evaluate(`document.querySelector('input[name="year_min"]').value`),await evaluate(`document.querySelector('input[aria-label="Año del vehículo: mínimo"]').value`));
  await shot('admin-320-rango-tactil');
  // Stress de maquetación con texto máximo; sólo DOM de QA, no son registros.
  for(const width of [768,320]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:700,deviceScaleFactor:1,mobile:width<=390});
    await send('Emulation.setTouchEmulationEnabled',{enabled:width<=390});
    await go('/vehiculos?currency=ARS&min_price=10000000&max_price=30000000');
    await shot(`admin-${width}-presupuesto-activo`);
    await go(vehicle);
    await evaluate(`document.querySelector('h1').textContent='M'.repeat(80)+' '+'V'.repeat(120)`);
    await shot(`stress-${width}-titulo-largo`);
    await go('/reportes');
    await evaluate(`document.querySelector('.report-table tbody th a').textContent='M'.repeat(80)+' '+'V'.repeat(120)`);
    await shot(`stress-${width}-tabla-larga`);
  }
  // Borradores inválidos: no navegar ni aparentar que las cifras previas coinciden.
  await go('/vehiculos');
  await change('input[name="year_min"]','2024'); await change('input[name="year_max"]','2016');
  await until(`!!document.querySelector('.field-error')`); await shot('admin-320-rango-invalido');
  await go('/reportes'); await change('input[name="from"]','2026-11-25');
  await until(`!!document.querySelector('.field-error')`); await shot('admin-320-fecha-invalida');
  await go('/vehiculos?q=NO-COINCIDE-REVISION'); await shot('admin-320-sin-coincidencias');
  await go('/reportes'); await click('Datos demo');
  await until(`document.querySelector('[role="switch"]')?.getAttribute('aria-checked')==='false'`);
  for(const [name,route] of [['reportes','/reportes'],['catalogo','/vehiculos'],['clientes','/clientes'],['oportunidades','/oportunidades']]) {
    await go(route); await shot(`admin-320-vacio-${name}`);
  }
  await click('Datos demo');
  await until(`document.querySelector('[role="switch"]')?.getAttribute('aria-checked')==='true'`);
  let seller='Sin credenciales disponibles';
  if(credentials.DEMO_SELLER_EMAIL && credentials.DEMO_SELLER_PASSWORD) {
    await click('Salir'); await until(`location.pathname==='/login'`);
    await change('#login-email',credentials.DEMO_SELLER_EMAIL); await change('#login-password',credentials.DEMO_SELLER_PASSWORD); await click('Ingresar');
    await until(`location.pathname==='/oportunidades' || location.pathname==='/acceso-denegado' || !!document.querySelector('[role="alert"]')`);
    seller=await evaluate(`location.pathname==='/oportunidades'?'habilitado':location.pathname==='/acceso-denegado' || document.querySelector('[role="alert"]')?.textContent.includes('no tiene acceso habilitado')?'deshabilitado':'no se pudo autenticar'`);
    if(seller==='habilitado') {
      for(const width of [1440,1024,768,390,320]) {
        await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<=390});
        for(const [name,route] of routes.filter(([n])=>!['reportes','detalle','usuarios','nuevo-vehiculo','editar-vehiculo'].includes(n))) {
          await go(route); await shot(`seller-${width}-${name}`);
        }
      }
    } else await shot('seller-acceso',true);
  }
  await writeFile(join(output,process.argv.includes('--states-only')?'review-states.json':'review.json'),JSON.stringify({phase,seller,observations,errors},null,2));
  if(phase==='after') {
    assert.deepEqual(observations.filter(o=>o.pageOverflow || o.overlaps.length).map(o=>o.name),[],'Sin desbordes ni superposición del encabezado');
    assert.deepEqual(errors,[],'Sin errores de JavaScript');
  }
  console.log(JSON.stringify({phase,seller,captures:observations.length,overflow:observations.filter(o=>o.pageOverflow).map(o=>o.name),overlaps:observations.filter(o=>o.overlaps.length).map(o=>o.name),errors}));
}
