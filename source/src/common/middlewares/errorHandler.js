export class AppError extends Error {
    constructor(message, statusCode = 500, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
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

    res.status(statusCode).json({
        success: false,
        status: statusCode,
        message,
        ...(err.details ? { details: err.details } : {}),
    });
}
