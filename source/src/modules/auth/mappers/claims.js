import { env } from '../../../config/env.js';
import { AppError } from '../../../common/middlewares/errorHandler.js';

const ROLE_ALIASES = {
    user: 'author',
    author: 'author',
    operator: 'editor',
    editor: 'editor',
    admin: 'tenant_admin',
    admin_tenant: 'tenant_admin',
    tenant_admin: 'tenant_admin',
};

const ROLE_PRECEDENCE = ['tenant_admin', 'editor', 'author'];

function extractRawRoles(claims) {
    const realmRoles = claims.realm_access?.roles || [];
    const clientRoles = claims.resource_access?.[env.KEYCLOAK_AUDIENCE]?.roles || [];
    return [...realmRoles, ...clientRoles];
}

export function normalizeRoles(claims) {
    const roles = extractRawRoles(claims)
        .map((role) => ROLE_ALIASES[role])
        .filter(Boolean);

    return [...new Set(roles)];
}

export function mapClaims(claims) {
    if (!claims.sub) {
        throw new AppError(
            'Access token is missing the sub claim.',
            401,
            null,
            'UNAUTHENTICATED'
        );
    }

    const rawTenant = claims[env.KEYCLOAK_TENANT_CLAIM] ?? claims.tenantId;
    const tenantId = rawTenant ? String(rawTenant).trim() : null;

    if (!tenantId) {
        throw new AppError(
            'Access token is missing the tenant_id claim.',
            403,
            null,
            'TENANT_CLAIM_MISSING'
        );
    }

    const roles = normalizeRoles(claims);
    if (roles.length === 0) {
        throw new AppError(
            'Access token does not contain a recognized realm role.',
            403,
            null,
            'FORBIDDEN'
        );
    }

    const role = ROLE_PRECEDENCE.find((candidate) => roles.includes(candidate));
    const username = claims.preferred_username || claims.sub;
    const name = String(claims.name || username || 'Unknown User').slice(0, 100);
    const email = String(
        claims.email || `${username || claims.sub}@${tenantId}.local`
    ).slice(0, 100);

    return {
        sub: claims.sub,
        tenantId,
        roles,
        role,
        name,
        email,
    };
}
