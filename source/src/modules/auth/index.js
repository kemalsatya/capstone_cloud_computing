import { Router } from 'express';
import { authController } from './controllers/auth.controller.js';
import { authenticate, requireTenantClaim } from '../../common/middlewares/auth.js';

const router = Router();

router.get('/me', authenticate, requireTenantClaim, authController.me);

export default router;
