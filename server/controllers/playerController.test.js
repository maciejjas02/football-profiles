import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { getPlayer, getPlayersByCategory } from './playerController.js';
import sequelize from '../config/database.js';

after(async () => sequelize.close());

function createResponse() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.value = value;
    },
    send() {
      this.sent = true;
    }
  };
}

test('player detail retains legacy JSON fields', async () => {
  const response = createResponse();
  await getPlayer({ params: { id: 'cristiano-ronaldo' } }, response, error => { throw error; });

  assert.equal(response.statusCode, 200);
  assert.equal(response.value.id, 'cristiano-ronaldo');
  assert.equal(response.value.imageUrl, response.value.image_url);
  assert.equal(response.value.goals, response.value.stats.goals);
  assert.equal(response.value.matches, response.value.stats.matches);
  assert.deepEqual(Object.keys(response.value.stats), ['goals', 'assists', 'matches', 'trophies']);
  assert.ok(Array.isArray(response.value.achievements));
});

test('player category retains imageUrl expected by the dashboard', async () => {
  const response = createResponse();
  await getPlayersByCategory({ params: { cat: 'top-players' } }, response, error => { throw error; });

  assert.ok(Array.isArray(response.value));
  assert.ok(response.value.length > 0);
  assert.ok(response.value.every(player => Object.hasOwn(player, 'imageUrl')));
});
