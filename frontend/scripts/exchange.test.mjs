import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteSchema, convertCurrency, parseConversionAmount } from '../src/lib/exchange.ts';
const quote={moneda:'USD',casa:'oficial',nombre:'Oficial',compra:1000,venta:1100,fechaActualizacion:'2026-11-24T12:00:00.000Z'};
test('cotización no admite ausencia/cero/moneda equivocada como precio válido',()=>{
  assert.equal(quoteSchema.safeParse(quote).success,true);
  for(const change of [{compra:0},{venta:null},{compra:Infinity},{moneda:'ARS'},{fechaActualizacion:'ayer'}]) assert.equal(quoteSchema.safeParse({...quote,...change}).success,false);
});
test('conversión usa la tasa elegida y conserva precisión hasta presentar',()=>{
  assert.equal(convertCurrency('1100','ARS',quote.venta),1);
  assert.equal(convertCurrency('1100','ARS',quote.compra),1.1);
  assert.equal(convertCurrency('2,50','USD',quote.venta),2750);
  assert.equal(convertCurrency('2.50','USD',quote.compra),2500);
  assert.equal(convertCurrency('1','ARS',3),1/3);
  assert.equal(convertCurrency('0','USD',quote.venta),0);
});
test('no convierte importes ambiguos ni ausencia de cotización en cero',()=>{
  for(const amount of ['', ' ', '-1','1.234,56','1,234.56','1e3','1.234','1000000000000']) {
    assert.equal(parseConversionAmount(amount),null);
    assert.equal(convertCurrency(amount,'ARS',1000),null);
  }
  for(const rate of [undefined,0,-1,Infinity,NaN]) assert.equal(convertCurrency('100','USD',rate),null);
});
