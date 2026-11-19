import test from 'node:test';
import assert from 'node:assert/strict';
import { loginSchema, sellerSchema, updateSellerSchema } from '../src/lib/auth/validation.ts';

test('login valida correo y no altera espacios de la contraseña', () => {
  assert.equal(loginSchema.safeParse({ email: 'invalido', password: 'x' }).success, false);
  const result = loginSchema.parse({ email: 'demo@pelucars.example', password: ' pass con espacios ' });
  assert.equal(result.password, ' pass con espacios ');
});
test('alta rechaza contraseñas débiles y teléfonos locales ambiguos', () => {
  const valid = { full_name: 'Vendedor Demo', email: 'demo@pelucars.example', contact_email: 'contacto@pelucars.example', contact_phone: '+5491112345678', password: 'una contraseña larga' };
  assert.equal(sellerSchema.safeParse(valid).success, true);
  assert.equal(sellerSchema.safeParse({ ...valid, password: '123456' }).success, false);
  assert.equal(sellerSchema.safeParse({ ...valid, contact_phone: '1112345678' }).success, false);
  assert.equal(sellerSchema.safeParse({ ...valid, contact_phone: '' }).success, false);
  assert.equal(sellerSchema.safeParse({ ...valid, contact_email: '' }).success, false);
  assert.equal(sellerSchema.safeParse({ ...valid, contact_email: 'correo-invalido' }).success, false);
});
test('el contrato editable no admite elevar rol ni disponibilidad', () => {
  const result = updateSellerSchema.parse({ id: '11111111-1111-4111-8111-111111111111', full_name: 'Vendedor', contact_phone: '+5491112345678', contact_email: 'contacto@pelucars.example', is_enabled: true, role: 'admin', accepts_assignments: true });
  assert.equal('role' in result, false);
  assert.equal('accepts_assignments' in result, false);
});

test('editar no permite borrar obligatorios y normaliza espacios de contacto', () => {
  const valid = { id: '11111111-1111-4111-8111-111111111111', full_name: ' Vendedor ', contact_phone: ' +5491112345678 ', contact_email: ' contacto@pelucars.example ', is_enabled: false };
  const result = updateSellerSchema.parse(valid);
  assert.equal(result.contact_email, 'contacto@pelucars.example');
  assert.equal(result.contact_phone, '+5491112345678');
  for (const name of ['full_name', 'contact_phone', 'contact_email']) {
    assert.equal(updateSellerSchema.safeParse({ ...valid, [name]: '   ' }).success, false, name);
  }
});
