export class AppError extends Error {
    constructor(message, statusCode = 500, details = null, code = null) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

export function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    if (process.env.NODE_ENV !== 'test' && statusCode >= 500) {
        console.error('[Unhandled Error]', err);
    }

    if (err instanceof AppError && err.code) {
        return res.status(statusCode).json({
            error: {
                code: err.code,
                message,
                ...(req.id ? { request_id: req.id } : {}),
            },
        });
    }

    res.status(statusCode).json({
        success: false,
        status: statusCode,
        message,
        ...(err.details ? { details: err.details } : {}),
    });
}
