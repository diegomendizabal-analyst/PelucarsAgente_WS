import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {z} from 'zod';
import {messagePage,mergeMessages} from '../src/lib/crm/message-page.ts';

const id=n=>`ee000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const rows=Array.from({length:53},(_,i)=>({id:id(i+1),history_position:(i+1)*3,body:'Local test'}));
test('cursor pages retain chronological order with gaps and new arrivals, no duplicate or skipped IDs',()=>{
  let database=[...rows].reverse();
  let page=messagePage(database.slice(0,21),'ready');
  let loaded=page.messages;
  assert.equal(loaded.length,20);assert.equal(page.cutoff,159);
  database.unshift({id:id(99),history_position:300});
  while(page.hasMore){
    const before=page.before,cutoff=page.cutoff;
    page=messagePage(database.filter(m=>m.history_position<before&&m.history_position<=cutoff).slice(0,21),'ready',cutoff);
    loaded=mergeMessages(loaded,page.messages);
  }
  assert.deepEqual(loaded,rows);
  assert.deepEqual(mergeMessages(loaded,rows.slice(0,20)),rows,'repeated response is idempotent');
  assert.equal(page.cutoff,159);
});
test('unconfirmed records keep their own cursor, without fabricating history positions',()=>{
  const pending=rows.map(m=>({...m,history_position:null})).reverse();
  const first=messagePage(pending,'ready',undefined,true);
  const second=messagePage(pending.filter(m=>m.id<first.beforeId),'ready',undefined,true);
  const third=messagePage(pending.filter(m=>m.id<second.beforeId),'ready',undefined,true);
  const merged=mergeMessages(mergeMessages(first.messages,second.messages,true),third.messages,true);
  assert.equal(first.before,null);assert.equal(first.cutoff,null);
  assert.deepEqual(merged,pending);assert.equal(third.hasMore,false);
});
test('empty, unavailable and read errors are distinct states',()=>{
  assert.equal(messagePage([],'ready').state,'ready');
  assert.equal(messagePage([],'error').state,'error');
  assert.equal(messagePage([],'unavailable').state,'unavailable');
  assert.equal(messagePage([],'ready').cutoff,null);
});

function route(leadResult){
  const compiled=ts.transpileModule(readFileSync(new URL('../src/app/api/oportunidades/[id]/mensajes/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}}; const calls=[];
  new Function('require','module','exports',compiled)(name=>name==='zod'?{z}:{getLead:async()=>leadResult,leadMessagePage:async(...args)=>{calls.push(args);return messagePage([],'ready');}},mod,mod.exports);
  return {get:query=>mod.exports.GET(new Request('http://localhost/api?'+query),{params:Promise.resolve({id:id(1)})}),calls};
}
test('message endpoint validates cursor bounds and kind before querying',async()=>{
  const api=route({lead:{id:id(1)},error:false});
  for(const query of ['','before=0&cutoff=20','before=30&cutoff=20','before=1.5&cutoff=20','before=1&cutoff=9007199254740992','kind=unconfirmed&before=2','beforeId=bad','before=1&cutoff=2&extra=true']) assert.equal((await api.get(query)).status,400,query);
  assert.equal(api.calls.length,0);
  const response=await api.get('before=20&cutoff=60');
  assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');
  assert.deepEqual(api.calls[0],[id(1),{before:20,cutoff:60,kind:'conversation',unconfirmed:false}]);
  assert.equal((await api.get('kind=unconfirmed&beforeId='+id(20))).status,200);
});
test('message endpoint rechecks access/source and does not query messages when unavailable',async()=>{
  for(const [result,status] of [[{lead:null,error:false},404],[{lead:null,error:true},503]]){
    const api=route(result);assert.equal((await api.get('before=20&cutoff=60')).status,status);assert.equal(api.calls.length,0);
  }
});
