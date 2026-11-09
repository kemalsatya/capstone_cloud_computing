export function extractTenant(req, res, next) {
    const rawHeader = req.headers['x-tenant-id'];
    if (rawHeader) {
        req.tenantId = Array.isArray(rawHeader) ? rawHeader[0].trim() : rawHeader.trim();
    }
    next();
}

export function requireTenant(req, res, next) {
    extractTenant(req, res, () => {
        if (!req.tenantId) {
            return res.status(400).json({
                success: false,
                message: 'Header X-Tenant-ID is required for tenant-scoped operations.',
            });
        }
        next();
    });
}
