import express from 'express';
import { getPlayer, getPlayersByCategory } from '../controllers/playerController.js';

const router = express.Router();

router.get('/api/player/:id', getPlayer);
router.get('/api/players/category/:cat', getPlayersByCategory);

export default router;
