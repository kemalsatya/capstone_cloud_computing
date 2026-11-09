import crypto from 'node:crypto';

export const authController = {
    async issueToken(req, res) {
        const {
            username = 'test-author',
            role = 'author',
            tenantId = req.headers['x-tenant-id'] || 'tenant-a',
        } = req.body || {};

        const validRoles = ['author', 'editor', 'admin'];
        const normalizedRole = validRoles.includes(role.toLowerCase())
            ? role.toLowerCase()
            : 'author';

        // Generate lightweight mock token
        const mockPayload = {
            sub: crypto.randomUUID(),
            username,
            role: normalizedRole,
            tenant_id: tenantId,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600,
        };

        const base64Payload = Buffer.from(JSON.stringify(mockPayload)).toString('base64url');
        const mockAccessToken = `mock.jwt.${base64Payload}.signature`;

        return res.status(200).json({
            token_type: 'Bearer',
            access_token: mockAccessToken,
            expires_in: 3600,
            user: {
                username,
                role: normalizedRole,
                tenant_id: tenantId,
            },
        });
    },
};
