import { successResponse } from '../../../common/utils/response.js';
import { tenantService } from '../services/tenant.service.js';

export const ruleTemplateController = {
    async create(req, res, next) {
        try {
            const data = await tenantService.createRuleTemplate({
                tenantId: req.tenantId,
                file: req.file,
                auth: req.auth,
            });
            return successResponse(res, data, 'Rule template draft created.', 201);
        } catch (err) {
            next(err);
        }
    },

    async list(req, res, next) {
        try {
            const data = await tenantService.listRuleTemplates(req.tenantId);
            return successResponse(res, data, 'Rule templates retrieved successfully.');
        } catch (err) {
            next(err);
        }
    },

    async get(req, res, next) {
        try {
            const data = await tenantService.getRuleTemplate({
                tenantId: req.tenantId,
                id: req.params.id,
            });
            return successResponse(res, data, 'Rule template retrieved successfully.');
        } catch (err) {
            next(err);
        }
    },

    async saveRules(req, res, next) {
        try {
            const data = await tenantService.saveRules({
                tenantId: req.tenantId,
                id: req.params.id,
                body: req.body,
                auth: req.auth,
            });
            return successResponse(res, data, 'Rule template updated successfully.');
        } catch (err) {
            next(err);
        }
    },

    async activate(req, res, next) {
        try {
            const data = await tenantService.activateRuleTemplate({
                tenantId: req.tenantId,
                id: req.params.id,
                auth: req.auth,
            });
            return successResponse(res, data, 'Rule template activated successfully.');
        } catch (err) {
            next(err);
        }
    },
};
