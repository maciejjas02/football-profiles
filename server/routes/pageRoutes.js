import express from 'express';
import { renderPage } from '../controllers/pageController.js';

export function createPageRouter({ requireModerator }) {
  const router = express.Router();
  const pages = [
    ['/', 'index', 'index'],
    ['/dashboard', 'dashboard', 'dashboard'],
    ['/dashboard.html', 'dashboard', 'dashboard'],
    ['/player', 'player', 'player'],
    ['/player.html', 'player', 'player'],
    ['/my-collection', 'my-collection', 'my-collection'],
    ['/my-collection.html', 'my-collection', 'my-collection'],
    ['/forum', 'forum', 'forum'],
    ['/forum.html', 'forum', 'forum'],
    ['/post', 'post', 'post'],
    ['/post.html', 'post', 'post'],
    ['/moderator-posts', 'moderator-posts', 'moderator-posts'],
    ['/moderator-posts.html', 'moderator-posts', 'moderator-posts'],
    ['/moderator-comments', 'moderator-comments', 'moderator-comments'],
    ['/moderator-comments.html', 'moderator-comments', 'moderator-comments'],
    ['/admin-categories', 'admin-categories', 'admin-categories'],
    ['/admin-categories.html', 'admin-categories', 'admin-categories'],
    ['/gallery', 'gallery', 'gallery'],
    ['/gallery.html', 'gallery', 'gallery'],
    ['/admin-gallery-upload', 'admin-gallery-upload', 'admin-gallery-upload'],
    ['/admin-gallery-upload.html', 'admin-gallery-upload', 'admin-gallery-upload'],
    ['/admin-gallery-manage', 'admin-gallery-manage', 'admin-gallery-manage'],
    ['/admin-gallery-manage.html', 'admin-gallery-manage', 'admin-gallery-manage']
  ];

  for (const [route, view, activePage] of pages) {
    router.get(route, renderPage(view, activePage));
  }

  router.get(['/admin-orders', '/admin-orders.html'], requireModerator, renderPage('admin-orders', 'admin-orders'));
  return router;
}
