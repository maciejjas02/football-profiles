import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { getAllPurchases, getUserPurchases } from './orderController.js';
import sequelize from '../config/database.js';

after(async () => sequelize.close());

function createResponse() {
  return { json(value) { this.value = value; } };
}

test('user purchases returns the legacy flattened player fields', async () => {
  const response = createResponse();
  await getUserPurchases({ user: { id: 1 } }, response, error => { throw error; });

  assert.ok(Array.isArray(response.value));
  for (const purchase of response.value) {
    assert.ok(Object.hasOwn(purchase, 'player_name'));
    assert.ok(Object.hasOwn(purchase, 'jersey_image_url'));
  }
});

test('admin purchases returns flattened user and player fields', async () => {
  const response = createResponse();
  await getAllPurchases({}, response, error => { throw error; });

  assert.ok(Array.isArray(response.value));
  for (const purchase of response.value) {
    assert.ok(Object.hasOwn(purchase, 'username'));
    assert.ok(Object.hasOwn(purchase, 'player_name'));
    assert.ok(Object.hasOwn(purchase, 'postal_code'));
  }
});
