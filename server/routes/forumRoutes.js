import express from 'express';
import { createPost, deletePost, getPost, listPosts, moderatePost, updatePost } from '../controllers/forumController.js';

export function createForumRouter({ requireModerator, db }) {
  const router = express.Router();
  router.use('/api/forum', (req, res, next) => {
    req.db = db;
    next();
  });

  router.get('/api/forum/posts', listPosts);
  router.get('/api/forum/posts/:id', getPost);
  router.post('/api/forum/posts', requireModerator, createPost);
  router.put('/api/forum/posts/:id', requireModerator, updatePost);
  router.delete('/api/forum/posts/:id', requireModerator, deletePost);
  router.post('/api/forum/posts/:id/approve', requireModerator, (req, res, next) => moderatePost('approved', req, res, next));
  router.post('/api/forum/posts/:id/reject', requireModerator, (req, res, next) => moderatePost('rejected', req, res, next));
  return router;
}
