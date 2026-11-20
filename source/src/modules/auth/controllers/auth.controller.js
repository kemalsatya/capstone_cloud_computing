export const authController = {
    async me(req, res) {
        const auth = req.auth;

        return res.status(200).json({
            user_id: auth.user?.id || null,
            sub: auth.sub,
            tenant_id: auth.tenantId,
            role: auth.role,
            roles: auth.roles,
            name: auth.user?.name || auth.name || null,
            email: auth.user?.email || auth.email || null,
        });
    },
};
