import express from 'express';
import healthRouter from './modules/health/index.js';
import manuscriptsRouter from './modules/manuscripts/index.js';
import authRouter from './modules/auth/index.js';
import { errorHandler, AppError } from './common/middlewares/errorHandler.js';

export function createApp() {
    const app = express();

    // Global Middlewares
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Root Welcome Endpoint
    app.get('/', (req, res) => {
        res.status(200).json({
            name: 'JournalFit Backend API',
            version: '1.0.0',
            description: 'Multi-Tenant Journal Manuscript Pre-Submission Checker (Modular Monolith)',
            endpoints: {
                healthLive: 'GET /health/live',
                healthReady: 'GET /health/ready',
                uploadManuscript: 'POST /api/manuscripts/upload',
                getReport: 'GET /api/manuscripts/:id/report',
                issueToken: 'POST /api/auth/token',
            },
        });
    });

    // Modules Routing
    app.use('/health', healthRouter);
    app.use('/api/manuscripts', manuscriptsRouter);
    app.use('/api/auth', authRouter);

    // 404 Catch-All
    app.use((req, res, next) => {
        next(new AppError(`Endpoint not found: ${req.method} ${req.originalUrl}`, 404));
    });

    // Centralized Error Handling Middleware
    app.use(errorHandler);

    return app;
}
