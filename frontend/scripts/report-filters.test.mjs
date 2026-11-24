import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultReportFilters, parseReportFilters, reportArgs } from '../src/lib/reports/filters.ts';
test('30 días inclusivos según fecha de Buenos Aires, no UTC', () => {
  assert.deepEqual(defaultReportFilters(new Date('2026-11-24T01:00:00Z')), { from: '2026-10-25', to: '2026-11-23', source: 'real', seller: '' });
});
test('fechas inválidas, invertidas, UUID, conjuntos y valores repetidos se rechazan', () => {
  for (const params of [{ from:'2026-02-30' }, { from:'2026-11-25',to:'2026-11-24' }, { seller:'cualquiera' }, { source:'all' }, { source:['real','demo'] }, { from:'1999-12-31' }]) assert.equal(parseReportFilters(params).success,false);
});
test('el origen se propaga explícitamente a la RPC y Todos usa NULL', () => {
  const f={from:'2026-11-01',to:'2026-11-24',source:'demo',seller:''};
  assert.deepEqual(reportArgs(f),{p_from:f.from,p_to:f.to,p_seller:null,p_source:'demo'});
  assert.equal(reportArgs({...f,source:'real'}).p_source,'whatsapp_bot');
});
