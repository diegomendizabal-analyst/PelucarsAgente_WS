import test from 'node:test';
import assert from 'node:assert/strict';
import { vehicleSchema, unitSchema } from '../src/lib/inventory/validation.ts';
import { emptyInventoryFilters, parseInventoryFilters, inventorySearchParams, priceFilterError, yearFilterError } from '../src/lib/inventory/filters.ts';
const valid = { model_year: '', version: '', transmission: '', mileage_km: '', listed_price: '', currency: '', status: 'available', received_at: '' };
test('rangos de años, extremos abiertos y enlaces anteriores',()=>{
  const range=parseInventoryFilters({year_min:'2016',year_max:'2024'});
  assert.equal(yearFilterError(range),null);
  assert.deepEqual(parseInventoryFilters(Object.fromEntries(inventorySearchParams(range))),range);
  assert.equal(parseInventoryFilters({year:'2022'}).minYear,'2022');
  assert.equal(parseInventoryFilters({year:'2022'}).maxYear,'2022');
  assert.ok(yearFilterError({...range,minYear:'2025'}));
  assert.ok(yearFilterError({...range,minYear:'20'}));
  assert.equal(yearFilterError({...range,maxYear:''}),null);
});
test('catalogo exige marca y modelo identificados', () => {
  assert.equal(vehicleSchema.safeParse({ brand: '  ', model: 'Modelo' }).success, false);
  assert.deepEqual(vehicleSchema.parse({ brand: ' Marca ', model: ' Modelo ' }), { brand: 'Marca', model: 'Modelo' });
});
test('campos desconocidos quedan nulos y precio requiere moneda', () => {
  const result = unitSchema.parse(valid);
  assert.equal(result.model_year, null);
  assert.equal(result.mileage_km, null);
  assert.equal(result.listed_price, null);
  assert.equal(Object.hasOwn(unitSchema.parse({ ...valid, internal_code: 'MANUAL' }), 'internal_code'), false);
  assert.equal(unitSchema.safeParse({ ...valid, listed_price: '100' }).success, false);
  assert.equal(unitSchema.safeParse({ ...valid, currency: 'USD' }).success, false);
  assert.equal(unitSchema.parse({ ...valid, listed_price: '100,50', currency: 'USD' }).listed_price, '100.50');
});
test('filtros conservan enlaces y descartan parámetros inválidos', () => {
  const filters = parseInventoryFilters({ q: ' Gol ', stock: 'available', year: '2022', transmission: 'automatic', archived: 'true' });
  assert.deepEqual(parseInventoryFilters(Object.fromEntries(inventorySearchParams(filters, 3))), filters);
  assert.equal(inventorySearchParams(filters, 3).get('page'), '3');
  assert.equal(inventorySearchParams(filters).has('page'), false);
  assert.deepEqual(parseInventoryFilters({ q: ['x'], stock: 'unknown', year: '22', transmission: 'unknown' }), emptyInventoryFilters);
});
test('rango de precios exige moneda, admite límites abiertos y rechaza rangos inválidos', () => {
  const range = { ...emptyInventoryFilters, currency: 'USD', minPrice: '0', maxPrice: '25000,50' };
  assert.equal(priceFilterError(range), null);
  assert.deepEqual(parseInventoryFilters(Object.fromEntries(inventorySearchParams(range, 2))), range);
  assert.equal(priceFilterError({ ...range, minPrice: '' }), null);
  assert.equal(priceFilterError({ ...range, maxPrice: '' }), null);
  assert.ok(priceFilterError({ ...range, currency: '' }));
  assert.ok(priceFilterError({ ...range, minPrice: '30000' }));
  for (const price of ['-1', '25.000', '1e4', '1.000,00', 'NaN', '1000000000000']) assert.ok(priceFilterError({ ...range, minPrice: price }), price);
  assert.ok(priceFilterError(parseInventoryFilters({ currency: 'EUR', max_price: '30000' })));
});
test('rechaza importes ambiguos y valores fuera de contrato', () => {
  for (const price of ['-1', '0', '1.000,00', '1.234', '1e3', '1000000000000']) assert.equal(unitSchema.safeParse({ ...valid, listed_price: price, currency: 'USD' }).success, false, price);
  assert.equal(unitSchema.safeParse({ ...valid, model_year: '22' }).success, false);
  assert.equal(unitSchema.safeParse({ ...valid, mileage_km: '-1' }).success, false);
  assert.equal(unitSchema.safeParse({ ...valid, status: 'sold' }).success, false);
  assert.equal(unitSchema.safeParse({ ...valid, received_at: '2026-02-30' }).success, false);
});
