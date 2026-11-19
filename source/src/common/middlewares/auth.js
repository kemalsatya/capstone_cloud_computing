import { env } from '../../config/env.js';
import { AppError } from './errorHandler.js';
import { verifyAccessToken } from '../../modules/auth/services/token.service.js';
import { mapClaims } from '../../modules/auth/mappers/claims.js';
import { provisionUser } from '../../modules/auth/services/user.service.js';

let overrides = {};

export function configureAuthForTests(options = {}) {
    overrides = { ...overrides, ...options };
}

function authMode() {
    return overrides.mode || process.env.AUTH_MODE || env.AUTH_MODE;
}

function unauthenticated(message = 'Authentication is required.') {
    return new AppError(message, 401, null, 'UNAUTHENTICATED');
}

function extractBearerToken(req) {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : null;
}

function decodeMockToken(token) {
    const parts = token.split('.');
    if (parts.length < 3 || parts[0] !== 'mock' || parts[1] !== 'jwt') {
        throw unauthenticated('Invalid mock access token.');
    }

    try {
        return JSON.parse(Buffer.from(parts[2], 'base64url').toString('utf8'));
    } catch {
        throw unauthenticated('Invalid mock access token.');
    }
}

export async function authenticate(req, res, next) {
    try {
        const mode = authMode();

        if (mode === 'header') {
            const rawTenant = req.headers['x-tenant-id'];
            req.auth = {
                sub: null,
                tenantId: rawTenant ? String(rawTenant).trim() : null,
                roles: ['author'],
                role: 'author',
                name: null,
                email: null,
                user: null,
            };
            req.tenantId = req.auth.tenantId;
            return next();
        }

        const token = extractBearerToken(req);
        if (!token) {
            throw unauthenticated('Authorization bearer token is required.');
        }

        if (mode === 'mock') {
            const payload = decodeMockToken(token);
            const mapped = mapClaims({
                ...payload,
                realm_access: { roles: [payload.role].filter(Boolean) },
            });
            req.auth = { ...mapped, user: null };
            req.tenantId = mapped.tenantId;
            return next();
        }

        let claims;
        try {
            claims = await verifyAccessToken(token);
        } catch {
            throw unauthenticated('Invalid or expired access token.');
        }

        const mapped = mapClaims(claims);
        const user = await provisionUser(mapped);

        req.auth = { ...mapped, user };
        req.tenantId = mapped.tenantId;
        next();
    } catch (err) {
        next(err);
    }
}

export function requireTenantClaim(req, res, next) {
    if (req.auth?.tenantId) {
        return next();
    }

    if (authMode() === 'header') {
        return res.status(400).json({
            success: false,
            message: 'Header X-Tenant-ID is required for tenant-scoped operations.',
        });
    }

    return next(
        new AppError(
            'Access token is missing the tenant_id claim.',
            403,
            null,
            'TENANT_CLAIM_MISSING'
        )
    );
}

export function requireRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.auth) {
            return next(unauthenticated());
        }

        const roles = req.auth.roles || [];
        if (!roles.some((role) => allowedRoles.includes(role))) {
            return next(
                new AppError(
                    'You do not have permission to perform this action.',
                    403,
                    null,
                    'FORBIDDEN'
                )
            );
        }

        next();
    };
}
