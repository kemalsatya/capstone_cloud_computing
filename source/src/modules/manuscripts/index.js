import { Router } from 'express';
import { authenticate, requireTenantClaim, requireRoles } from '../../common/middlewares/auth.js';
import { createUploadSingle } from '../../common/middlewares/upload.js';
import { manuscriptController } from './controllers/manuscript.controller.js';

const router = Router();
const uploadSingle = createUploadSingle('file');

router.use(authenticate, requireTenantClaim);

router.post('/', requireRoles('author'), uploadSingle, manuscriptController.create);
router.post('/upload', requireRoles('author'), uploadSingle, manuscriptController.uploadLegacy);

const READ_ROLES = ['author', 'editor', 'tenant_admin'];

router.get('/', requireRoles(...READ_ROLES), manuscriptController.list);
router.get('/:id/history', requireRoles(...READ_ROLES), manuscriptController.getHistory);
router.get('/:id', requireRoles(...READ_ROLES), manuscriptController.getDetail);
router.get('/:id/report', requireRoles(...READ_ROLES), manuscriptController.getReport);

export default router;
