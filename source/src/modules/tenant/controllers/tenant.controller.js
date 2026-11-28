import { successResponse } from '../../../common/utils/response.js';
import { tenantService } from '../services/tenant.service.js';

export const tenantController = {
    async getAimScope(req, res, next) {
        try {
            const data = await tenantService.getAimScope(req.tenantId);
            return successResponse(res, data, 'Aim and scope retrieved successfully.');
        } catch (err) {
            next(err);
        }
    },

    async updateAimScope(req, res, next) {
        try {
            const data = await tenantService.updateAimScope(req.tenantId, req.body);
            return successResponse(res, data, 'Aim and scope updated successfully.');
        } catch (err) {
            next(err);
        }
    },

    async summary(req, res, next) {
        try {
            const data = await tenantService.getSummary({
                tenantId: req.tenantId,
                query: req.query,
            });
            return successResponse(res, data, 'Tenant summary retrieved successfully.');
        } catch (err) {
            next(err);
        }
    },

    async aiUsage(req, res, next) {
        try {
            const data = await tenantService.getAiUsage(req.tenantId);
            return successResponse(res, data, 'AI usage retrieved successfully.');
        } catch (err) {
            next(err);
        }
    },
};
