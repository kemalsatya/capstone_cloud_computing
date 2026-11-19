import { Router } from 'express';
import multer from 'multer';
import { manuscriptController } from './controllers/manuscript.controller.js';
import { authenticate, requireTenantClaim, requireRoles } from '../../common/middlewares/auth.js';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024, // 20 MB max file size
    },
});

router.use(authenticate, requireTenantClaim);

// POST /api/manuscripts/upload
router.post('/upload', requireRoles('author'), upload.single('file'), manuscriptController.upload);

// GET /api/manuscripts/:id/report
router.get(
    '/:id/report',
    requireRoles('author', 'editor', 'tenant_admin'),
    manuscriptController.getReport
);

export default router;
