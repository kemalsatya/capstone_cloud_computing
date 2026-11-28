import { LocalStorage } from './local-storage.js';

export const storage = new LocalStorage();

export function manuscriptObjectKey(tenantId, manuscriptId) {
    return `tenants/${tenantId}/manuscripts/${manuscriptId}.docx`;
}

export function templateObjectKey(tenantId, templateId) {
    return `tenants/${tenantId}/templates/${templateId}.docx`;
}
