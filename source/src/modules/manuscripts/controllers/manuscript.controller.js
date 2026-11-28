import { manuscriptService } from '../services/manuscript.service.js';
import { successResponse } from '../../../common/utils/response.js';

export const manuscriptController = {
    async list(req, res, next) {
        try {
            const data = await manuscriptService.listManuscripts(req.query, req.auth);
            return successResponse(res, data, 'Manuscripts retrieved successfully.');
        } catch (err) {
            next(err);
        }
    },

    async getDetail(req, res, next) {
        try {
            const data = await manuscriptService.getDetail(req.params.id, req.auth);
            return successResponse(res, data, 'Manuscript retrieved successfully.');
        } catch (err) {
            next(err);
        }
    },

    async getHistory(req, res, next) {
        try {
            const data = await manuscriptService.getHistory(req.params.id, req.auth);
            return successResponse(res, data, 'Manuscript history retrieved successfully.');
        } catch (err) {
            next(err);
        }
    },

    async create(req, res, next) {
        try {
            const result = await manuscriptService.processUpload({
                tenantId: req.tenantId,
                file: req.file,
                authorId: req.auth?.user?.id || null,
                parentManuscriptId: req.body?.parent_manuscript_id || null,
                legacy: false,
            });

            return res.status(202).json(result);
        } catch (err) {
            next(err);
        }
    },

    async uploadLegacy(req, res, next) {
        try {
            const result = await manuscriptService.processUpload({
                tenantId: req.tenantId,
                file: req.file,
                authorId: req.auth?.user?.id || null,
                parentManuscriptId: req.body?.parent_manuscript_id || null,
                legacy: true,
            });

            return res.status(201).json({
                success: true,
                message: 'Manuscript uploaded and queued for format checking.',
                data: {
                    ...result,
                    manuscript: {
                        id: result.manuscript_id,
                        revision_no: result.revision_no,
                        status: result.status,
                    },
                },
            });
        } catch (err) {
            next(err);
        }
    },

    async getReport(req, res, next) {
        try {
            const report = await manuscriptService.getReport(req.params.id, req.auth || {
                tenantId: req.tenantId,
                roles: ['tenant_admin'],
                user: null,
            });

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
