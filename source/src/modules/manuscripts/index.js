import { Router } from 'express';
import multer from 'multer';
import { env } from '../../config/env.js';
import { AppError } from '../../common/middlewares/errorHandler.js';
import { authenticate, requireTenantClaim, requireRoles } from '../../common/middlewares/auth.js';
import { manuscriptController } from './controllers/manuscript.controller.js';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: env.MAX_UPLOAD_MB * 1024 * 1024,
    },
});

function uploadSingle(req, res, next) {
    upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            return next(new AppError(
                `Ukuran file melebihi batas ${env.MAX_UPLOAD_MB} MB.`,
                413,
                null,
                'FILE_TOO_LARGE'
            ));
        }
        if (err) return next(err);
        return next();
    });
}

router.use(authenticate, requireTenantClaim);

router.post('/', requireRoles('author'), uploadSingle, manuscriptController.create);
router.post('/upload', requireRoles('author'), uploadSingle, manuscriptController.uploadLegacy);

router.get(
    '/:id/report',
    requireRoles('author', 'editor', 'tenant_admin'),
    manuscriptController.getReport
);

export default router;
