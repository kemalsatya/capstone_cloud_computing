import { query } from '../../../config/database.js';
import { AppError } from '../../../common/middlewares/errorHandler.js';

export const userRepository = {
    async findTenantById(tenantId) {
        const res = await query('SELECT id FROM tenants WHERE id = $1', [tenantId]);
        return res.rows[0] || null;
    },

    async provisionFromClaims({ sub, tenantId, role, name, email }) {
        const tenant = await this.findTenantById(tenantId);
        if (!tenant) {
            throw new AppError(
                `Tenant '${tenantId}' from the access token is not provisioned.`,
                403,
                null,
                'FORBIDDEN'
            );
        }

        const sql = `
            INSERT INTO users (id, tenant_id, name, email, role, keycloak_sub)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (keycloak_sub) DO UPDATE
               SET name = EXCLUDED.name,
                   email = EXCLUDED.email,
                   role = EXCLUDED.role
             WHERE users.tenant_id = EXCLUDED.tenant_id
            RETURNING *;
        `;
        const res = await query(sql, [sub, tenantId, name, email, role, sub]);

        if (res.rows.length === 0) {
            throw new AppError(
                'Access token tenant does not match the provisioned user.',
                403,
                null,
                'FORBIDDEN'
            );
        }

        return res.rows[0];
    },
};
