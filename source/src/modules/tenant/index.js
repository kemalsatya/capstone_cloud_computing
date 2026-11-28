import { Router } from 'express';
import { authenticate, requireTenantClaim, requireRoles } from '../../common/middlewares/auth.js';
import { createUploadSingle } from '../../common/middlewares/upload.js';
import { ruleTemplateController } from './controllers/rule-template.controller.js';
import { tenantController } from './controllers/tenant.controller.js';

const router = Router();
const uploadSingle = createUploadSingle('file');

router.use(authenticate, requireTenantClaim, requireRoles('tenant_admin'));

router.post('/rule-templates', uploadSingle, ruleTemplateController.create);
router.get('/rule-templates', ruleTemplateController.list);
router.get('/rule-templates/:id', ruleTemplateController.get);
router.put('/rule-templates/:id/rules', ruleTemplateController.saveRules);
router.post('/rule-templates/:id/activate', ruleTemplateController.activate);

router.get('/aim-scope', tenantController.getAimScope);
router.put('/aim-scope', tenantController.updateAimScope);
router.get('/summary', tenantController.summary);
router.get('/ai-usage', tenantController.aiUsage);

export default router;
