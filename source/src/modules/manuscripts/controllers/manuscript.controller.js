import { manuscriptService } from '../services/manuscript.service.js';

export const manuscriptController = {
    async upload(req, res, next) {
        try {
            const tenantId = req.tenantId;
            const file = req.file;
            const authorId = req.body?.authorId || null;

            const result = await manuscriptService.processUpload({
                tenantId,
                file,
                authorId,
            });

            return res.status(201).json({
                success: true,
                message: 'Manuscript uploaded and format validation completed successfully.',
                data: result,
            });
        } catch (err) {
            next(err);
        }
    },

    async getReport(req, res, next) {
        try {
            const manuscriptId = req.params.id;
            const tenantId = req.tenantId;

            const report = await manuscriptService.getReport(manuscriptId, tenantId);

            return res.status(200).json({
                success: true,
                message: 'Manuscript report retrieved successfully.',
                data: report,
            });
        } catch (err) {
            next(err);
        }
    },
};
