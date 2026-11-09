import { Router } from 'express';
import { authController } from './controllers/auth.controller.js';

const router = Router();

router.post('/token', authController.issueToken);

export default router;
