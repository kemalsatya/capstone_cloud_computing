import crypto from 'node:crypto';
import express from 'express';
import healthRouter from './modules/health/index.js';
import manuscriptsRouter from './modules/manuscripts/index.js';
import authRouter from './modules/auth/index.js';
import { errorHandler, AppError } from './common/middlewares/errorHandler.js';
import { metricsMiddleware, renderPrometheusMetrics } from './common/utils/metrics.js';
import { env } from './config/env.js';
import { mountApiDocs } from './docs/index.js';

export function createApp() {
    const app = express();

    // Global Middlewares
    app.use((req, res, next) => {
        req.id = req.headers['x-request-id'] || crypto.randomUUID();
        res.set('X-Request-Id', req.id);
        next();
    });
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(metricsMiddleware);

    // Root Welcome Endpoint
    app.get('/', (req, res) => {
        res.status(200).json({
            name: 'JournalFit Backend API',
            version: '1.0.0',
            description: 'Multi-Tenant Journal Manuscript Pre-Submission Checker (Modular Monolith)',
            endpoints: {
                healthLive: 'GET /health/live',
                healthReady: 'GET /health/ready',
                metrics: 'GET /metrics',
                currentUser: 'GET /api/auth/me',
                uploadManuscript: 'POST /api/manuscripts',
                uploadManuscriptLegacy: 'POST /api/manuscripts/upload',
                getReport: 'GET /api/manuscripts/:id/report',
                apiDocs: env.ENABLE_DOCS ? 'GET /docs' : 'disabled (set ENABLE_DOCS=true)',
            },
        });
    });

    // Prometheus Metrics Endpoint
    app.get('/metrics', (req, res) => {
        res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        res.status(200).send(renderPrometheusMetrics());
    });

    // API documentation (demo/dev only)
    mountApiDocs(app, { enabled: env.ENABLE_DOCS });

    // Modules Routing
    app.use('/health', healthRouter);
    app.use('/api/manuscripts', manuscriptsRouter);
    app.use('/api/auth', authRouter);

    // 404 Catch-All
    app.use((req, res, next) => {
        next(new AppError(`Endpoint not found: ${req.method} ${req.originalUrl}`, 404, null, 'NOT_FOUND'));
    });

    // Centralized Error Handling Middleware
    app.use(errorHandler);

    return app;
}
