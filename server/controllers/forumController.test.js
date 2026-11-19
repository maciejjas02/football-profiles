import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { getPost, listPosts } from './forumController.js';
import sequelize from '../config/database.js';

after(async () => sequelize.close());

function createResponse() {
  return {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.value = value;
    }
  };
}

test('forum list returns flattened author/category names and comment counts', async () => {
  const response = createResponse();
  await listPosts({ query: { limit: '20', offset: '0' } }, response, error => { throw error; });

  assert.ok(Array.isArray(response.value));
  for (const post of response.value) {
    assert.ok(Object.hasOwn(post, 'author_username'));
    assert.ok(Object.hasOwn(post, 'category_name'));
    assert.ok(Object.hasOwn(post, 'comment_count'));
  }
});

test('forum detail returns 404 for an unknown post', async () => {
  const response = createResponse();
  await getPost({ params: { id: 'missing-post-id' } }, response, error => { throw error; });
  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.value, { error: 'Not found' });
});
