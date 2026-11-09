import { Router } from 'express';
import multer from 'multer';
import { manuscriptController } from './controllers/manuscript.controller.js';
import { requireTenant } from '../../common/middlewares/tenant.js';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024, // 20 MB max file size
    },
});

// POST /api/manuscripts/upload
router.post('/upload', requireTenant, upload.single('file'), manuscriptController.upload);

// GET /api/manuscripts/:id/report
router.get('/:id/report', requireTenant, manuscriptController.getReport);

export default router;
