import express from 'express';
import { getAllPurchases, getUserPurchases, updatePurchaseStatus } from '../controllers/orderController.js';

export function createOrderRouter({ requireAuth, requireModerator }) {
  const router = express.Router();
  router.get('/api/user/purchases', requireAuth, getUserPurchases);
  router.get('/api/admin/orders', requireModerator, getAllPurchases);
  router.put('/api/admin/orders/:id/status', requireModerator, updatePurchaseStatus);
  return router;
}
