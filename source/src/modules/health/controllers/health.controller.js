import { query } from '../../../config/database.js';
import { isQueueReady } from '../../queue/index.js';

export const healthController = {
    getLive(req, res) {
        return res.status(200).json({
            status: 'alive',
            timestamp: new Date().toISOString(),
        });
    },

    async getReady(req, res) {
        let database = 'connected';
        let queue = isQueueReady() ? 'ready' : 'unavailable';

        try {
            await query('SELECT 1');
        } catch {
            database = 'disconnected';
        }

        const ready = database === 'connected' && queue === 'ready';

        return res.status(ready ? 200 : 503).json({
            status: ready ? 'ready' : 'unready',
            database,
            queue,
            timestamp: new Date().toISOString(),
        });
    },
};
