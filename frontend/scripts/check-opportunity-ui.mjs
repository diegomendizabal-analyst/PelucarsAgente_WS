// Browser QA of the actual opportunity components with synthetic read adapters.
// No Auth, network data, mutations or production preview route. SQL tests cover RLS.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url);
const out=join(root,'..','.pr-work','opportunity-ui'); await mkdir(out,{recursive:true});
const time='2026-11-27T12:00:00Z',id='ee000000-0000-4000-8000-000000000010';
const name='Cliente de prueba con nombre extenso '+ 'Apellido'.repeat(14);
const lead={id,reference_number:123,customer_id:id,assigned_to:id,source:'demo',commercial_status:'follow_up',
  customer:{full_name:name,phone_e164:'+12025550123',provider_profile_name:name},responsible:{full_name:'Vendedor local'},
  summary:'Busca un automático para agregar dinero si entrega su usado; todavía no decidió. '.repeat(5),
  budget_min:null,budget_max:999999999999.99,budget_currency:'USD',budget_scope:'dinero_a_agregar',
  trade_in_decision:'indecisa',financing_needed:false,trade_in_details:'Ford Focus 2016, versión declarada por el cliente',purchase_timeframe:'El mes que viene',
  waiting_since:null,closed_at:null,loss_reason:null,created_at:time,updated_at:time};
const interest={id,vehicle_id:id,requested_text:'Toyota Corolla automático con características declaradas. '+ 'TextoLargo'.repeat(25),
  year_min:2020,year_max:null,requested_brand:'Toyota',requested_model:'Corolla',requested_version:null,transmission:'Automática',
  characteristics:['Automático','Baúl amplio'],status:'active',is_primary:true};
const score={id,score:50,rules_version:'pelucars_score_v1_prototipo',evaluated_at:time,cutoff_message_id:id,cutoff_position:8,cutoff_at:time,
  result:{banda:'media',informacion_limitada:true,motivos_limitacion:['El importe es dinero a agregar y el cliente no decidió si entrega su usado.'],
    desglose:{plazo:{puntos:20,motivo:'Compra de 8 a 30 días'},intencion:{puntos:0,motivo:'Sin intención clasificable'},
      busqueda:{puntos:15,motivo:'Búsqueda declarada'},presupuesto:{puntos:15,motivo:'Importe, moneda y alcance completos'}}},
  evidence:[{signal_code:'busqueda',message_id:id,quoted_text:'Busco un Corolla automático. '+ 'TextoSinEspacios'.repeat(20)}]};
const messages=['pending','unknown','failed','sent',null].map((state,index)=>({id:id+index,conversation_id:id,sender_kind:state ? 'bot' : 'customer',
  body:state ? 'Mensaje del bot con estado de entrega visible.' : 'Texto del cliente con condiciones y negaciones.\nTodavía no decidí si entrego mi auto.',
  send_state:state,created_at:time,sent_at:state==='sent' ? time : null,provider:'demo',bot_state:'collecting',history_position:state==='sent'||!state ? 8 : null}));

function loadComponents(scenario) {
  const cache=new Map();
  const empty=scenario==='empty',zero=scenario==='zero';
  const fixtureLead=empty ? {...lead,summary:null,budget_max:null,budget_currency:null,budget_scope:null,trade_in_decision:null,
    financing_needed:null,trade_in_details:null,purchase_timeframe:null,customer:{...lead.customer,full_name:null,provider_profile_name:null}}
    : zero ? {...lead,budget_max:0,budget_currency:null,trade_in_decision:'descartada'} : lead;
  const data={crmPageSize:20,crmPage:value=>Number(value)||1,
    getLead:async()=>({lead:fixtureLead,error:false}),
    leadContext:async()=>({interests:empty?[]:[interest],events:[],count:41,interestCount:21,error:false,
      matches:[{interest_id:id,available_count:4,matching_count:0,unknown_count:3}],matchState:['error','unavailable'].includes(scenario)?scenario:'ready'}),
    listAssignees:async()=>({rows:[{id,full_name:'Vendedor local',role:'seller'}],error:false}),
    leadBotContext:async()=>({conversation:{messages:empty?[]:messages.filter(m=>m.history_position!==null).reverse(),hasMore:false,before:8,cutoff:8,beforeId:null,state:['error','unavailable'].includes(scenario)?scenario:'ready'},
      unconfirmed:{messages:empty?[]:messages.filter(m=>m.history_position===null),hasMore:false,before:null,cutoff:null,beforeId:null,state:'ready'},
      scoreState:['error','unavailable'].includes(scenario)?scenario:'ready',score:empty?null:zero?{...score,score:0,result:{...score.result,banda:'baja',desglose:{}}}:score})};
  function load(file) {
    if(cache.has(file))return cache.get(file).exports;
    const compiledModule={exports:{}};cache.set(file,compiledModule);
    const compiled=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
    const localRequire=specifier=>{
      if(specifier==='@/lib/crm/data')return data;
      if(specifier==='@/lib/auth/session')return {requireAccount:async()=>({id,role:'admin'})};
      if(specifier==='next/navigation')return {useRouter:()=>({refresh(){}})};
      if(specifier==='@/app/(crm)/oportunidades/actions')return {assignOpportunity:async()=>({}),changeOpportunityStatus:async()=>({}),claimOpportunity:async()=>({})};
      if(specifier.startsWith('@/')||specifier.startsWith('.')){
        const base=specifier.startsWith('@/')?join(root,'src',specifier.slice(2)):resolve(dirname(file),specifier);
        const found=['.tsx','.ts'].map(ext=>base+ext).find(existsSync);if(found)return load(found);
      }
      return require(specifier);
    };
    new Function('require','module','exports',compiled)(localRequire,compiledModule,compiledModule.exports);
    return compiledModule.exports;
  }
  return load(join(root,'src',scenario==='loading'?'app/loading.tsx':'components/crm-detail.tsx'));
}
const css=['globals','inventory','records','crm','auth'].map(name=>readFileSync(join(root,'src/app',name+'.css'),'utf8')).join('\n');
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/font.woff2'){res.setHeader('Content-Type','font/woff2');res.end(readFileSync(join(root,'src/app/fonts/manrope-latin-variable.woff2')));return;}
    const scenario=url.searchParams.get('scenario')||'complete',components=loadComponents(scenario);
    const tree=scenario==='loading'?React.createElement(components.default):await components.OpportunityDetail({params:Promise.resolve({id}),searchParams:Promise.resolve(Object.fromEntries(url.searchParams))});
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QA local de oportunidad</title><style>${css}\n@font-face{font-family:Manrope;src:url('/font.woff2')}body{--font-manrope:Manrope}main{max-width:1280px;margin:auto;padding:24px}@media(max-width:600px){main{padding:16px}}</style><body><main>${renderToStaticMarkup(tree)}</main></body></html>`);
  }catch(e){res.statusCode=500;res.end(String(e.stack));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const executable=[process.env.CHROME_BIN,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/chromium'].find(p=>p&&existsSync(p));
assert(executable,'Chrome/Chromium requerido');
const profile=join(tmpdir(),`pelucars-opportunity-${process.pid}`);
const browser=spawn(executable,['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let socket,serial=0;const pending=new Map(),results=[];
try {
  let port;
  for(let i=0;i<80;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];}catch{} if(port)break;await delay(100);}
  assert(port,'Chrome no inició');
  const targets=await(await fetch(`http://127.0.0.1:${port}/json`)).json();socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  socket.onmessage=({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(p){pending.delete(m.id);if(m.error)p.reject(m.error);else p.resolve(m.result);}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
  const capture=async name=>{const {data}=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(out,name+'.png'),Buffer.from(data,'base64'));};
  await send('Page.enable');
  for(const width of [1440,768,390,320]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
    for(const scenario of ['complete','empty','zero','error','unavailable','loading']){
      await send('Page.navigate',{url:`${base}/oportunidades/${id}?scenario=${scenario}&page=2&interests_page=2`});
      for(let i=0;i<100;i++){if(await evaluate(`document.readyState==='complete' && location.search.includes('scenario=${scenario}') && !!document.querySelector('main')`))break;await delay(50);}
      await evaluate('document.fonts.ready');
      assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),`Overflow ${width} ${scenario}`);
      const text=await evaluate('document.body.innerText');
      assert(!text.includes('Error:'),text.slice(0,300));
      if(scenario==='empty'){assert(text.includes('Pendiente'));assert(!text.includes('/100'));assert(text.includes('Sin informar'));}
      if(scenario==='zero'){assert(text.includes('0/100'));assert(text.includes('Moneda sin informar 0'));assert(text.includes('No entrega un usado'));}
      if(scenario==='error')assert.equal(await evaluate('document.querySelectorAll("[role=alert]").length'),3);
      if(scenario==='unavailable')assert(text.includes('integración pendiente de habilitar'));
      if(scenario==='loading')assert(await evaluate('!!document.querySelector("[aria-busy=true]")'));
      if(scenario==='complete'){
        assert(text.includes('50/100'));assert(text.includes('Medio'));assert(text.includes('999.999.999.999,99'));assert(text.includes('Todavía no decidió'));
        assert(text.includes('identidad no verificada'));assert(!text.includes('Procedencia comercial'));
        await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
        assert.equal(await evaluate('document.activeElement.className'),'back-link');
        assert.equal(await evaluate('getComputedStyle(document.activeElement).outlineStyle'),'solid');
        if(width===1440||width===390||width===320)await capture(`${width}-complete`);
        await evaluate(`document.querySelector('.op-score-detail summary').focus()`);
        await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13});
        await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
        await delay(100);
        assert(await evaluate("document.querySelector('.op-score-detail').open"),'Score opens by keyboard');
        assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Detail fits viewport');
        await evaluate(`document.querySelector('.op-score-content').scrollIntoView({block:'nearest'})`);
        if(width===1440||width===390||width===320)await capture(`${width}-score`);
        await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',text:' ',unmodifiedText:' ',windowsVirtualKeyCode:32});
        await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
        await delay(50);assert(!(await evaluate("document.querySelector('.op-score-detail').open")),'Score closes by keyboard');
        await evaluate(`document.querySelector('.op-unconfirmed').open=true`);
        assert((await evaluate('document.body.innerText')).includes('Envío incierto'));
        assert((await evaluate('document.body.innerText')).includes('Envío fallido'));
        if(width===1440||width===390||width===320){await evaluate(`document.querySelector('.op-chat-scroll').scrollIntoView()`);await capture(`${width}-messages`);await evaluate(`document.querySelector('.crm-interest').scrollIntoView()`);await capture(`${width}-interest`);}
        assert.equal(await evaluate('document.querySelectorAll(".op-chat-list .op-bubble").length'),2);
      }
      if(width===320&&scenario!=='complete')await capture(`${width}-${scenario}`);
      results.push({width,scenario,passed:true});
    }
  }
  await writeFile(join(out,'results.json'),JSON.stringify(results,null,2));
  console.log(`${results.length} browser cases passed. Screenshots: ${out}`);
}finally{socket?.close();browser.kill();await new Promise(resolve=>server.close(resolve));}
