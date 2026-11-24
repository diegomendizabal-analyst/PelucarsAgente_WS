import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentSchema,statusSchema } from '../src/lib/crm/validation.ts';
const identity={id:'c1000000-0000-4000-8000-000000000001',updated_at:'2026-11-20T12:00:00.000Z'};
test('identidad admite UUID de PostgreSQL sin exigir version RFC',()=>{
  assert.equal(statusSchema.safeParse({...identity,id:'31b7cf37-b1e2-3a0f-7480-021f0518c09f',status:'follow_up',reason:''}).success,true);
  assert.equal(statusSchema.safeParse({...identity,id:'31b7cf37-b1e2-3a0f-7480-021f0518c09z',status:'follow_up',reason:''}).success,false);
});
test('cambio de estado requiere identidad/version y motivo de perdida',()=>{
  assert.equal(statusSchema.safeParse({...identity,status:'lost',reason:' '}).success,false);
  assert.equal(statusSchema.safeParse({...identity,status:'sold',reason:'Venta'}).success,false);
  assert.equal(statusSchema.safeParse({...identity,status:'follow_up',reason:''}).success,true);
  assert.equal(statusSchema.safeParse({...identity,updated_at:'ayer',status:'follow_up',reason:''}).success,false);
});
test('asignacion no acepta responsable arbitrario ni motivo excesivo',()=>{
  assert.equal(assignmentSchema.safeParse({...identity,assignee:'otro',reason:''}).success,false);
  assert.equal(assignmentSchema.safeParse({...identity,assignee:identity.id,reason:'x'.repeat(1001)}).success,false);
  assert.equal(assignmentSchema.safeParse({...identity,assignee:identity.id,reason:'Atencion de administracion'}).success,true);
});
