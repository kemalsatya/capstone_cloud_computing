import { assertSafeStorageMode, env } from '../../config/env.js';
import { LocalStorage } from './local-storage.js';
import { S3Storage } from './s3-storage.js';

assertSafeStorageMode();

export const storage = env.STORAGE_DRIVER === 's3'
    ? new S3Storage()
    : new LocalStorage();

export function manuscriptObjectKey(tenantId, manuscriptId) {
    return `tenants/${tenantId}/manuscripts/${manuscriptId}.docx`;
}

export function templateObjectKey(tenantId, templateId) {
    return `tenants/${tenantId}/templates/${templateId}.docx`;
}
