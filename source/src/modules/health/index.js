import { Router } from 'express';
import { healthController } from './controllers/health.controller.js';

const router = Router();

router.get('/live', healthController.getLive);
router.get('/ready', healthController.getReady);

export default router;
