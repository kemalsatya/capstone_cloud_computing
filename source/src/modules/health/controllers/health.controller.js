import { query } from '../../../config/database.js';

export const healthController = {
    getLive(req, res) {
        return res.status(200).json({
            status: 'alive',
            timestamp: new Date().toISOString(),
        });
    },

    async getReady(req, res) {
        try {
            await query('SELECT 1');
            return res.status(200).json({
                status: 'ready',
                database: 'connected',
                timestamp: new Date().toISOString(),
            });
        } catch (err) {
            return res.status(503).json({
                status: 'unready',
                database: 'disconnected',
                error: err.message,
                timestamp: new Date().toISOString(),
            });
        }
    },
};
