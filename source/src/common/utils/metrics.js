const DURATION_BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30];

const requestCounts = new Map();
const durationBuckets = new Map(DURATION_BUCKETS.map((b) => [b, 0]));
let durationInf = 0;
let durationSum = 0;
let durationCount = 0;

function escapeLabel(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function normalizeRoute(req) {
    if (req.route?.path) {
        return `${req.baseUrl || ''}${req.route.path}`;
    }
    const cleanPath = (req.originalUrl || req.url || '/').split('?')[0];
    return cleanPath.replace(/\/[0-9a-fA-F-]{8,}(?=\/|$)/g, '/:id');
}

export function metricsMiddleware(req, res, next) {
    if (req.path === '/metrics') {
        return next();
    }

    const startNs = process.hrtime.bigint();
    res.on('finish', () => {
        const elapsedSeconds = Number(process.hrtime.bigint() - startNs) / 1e9;
        const route = normalizeRoute(req);
        const key = `${req.method}|${route}|${res.statusCode}`;
        requestCounts.set(key, (requestCounts.get(key) || 0) + 1);

        durationCount += 1;
        durationSum += elapsedSeconds;
        durationInf += 1;
        for (const bound of DURATION_BUCKETS) {
            if (elapsedSeconds <= bound) {
                durationBuckets.set(bound, durationBuckets.get(bound) + 1);
            }
        }
    });

    next();
}

export function renderPrometheusMetrics() {
    const lines = [
        '# HELP http_requests_total Total HTTP requests handled by JournalFit backend',
        '# TYPE http_requests_total counter',
    ];

    for (const [key, count] of requestCounts.entries()) {
        const [method, route, status] = key.split('|');
        lines.push(
            `http_requests_total{method="${escapeLabel(method)}",route="${escapeLabel(route)}",status="${escapeLabel(status)}"} ${count}`
        );
    }

    lines.push(
        '# HELP http_request_duration_seconds HTTP request duration in seconds',
        '# TYPE http_request_duration_seconds histogram'
    );
    for (const bound of DURATION_BUCKETS) {
        lines.push(`http_request_duration_seconds_bucket{le="${bound}"} ${durationBuckets.get(bound)}`);
    }
    lines.push(`http_request_duration_seconds_bucket{le="+Inf"} ${durationInf}`);
    lines.push(`http_request_duration_seconds_sum ${durationSum.toFixed(6)}`);
    lines.push(`http_request_duration_seconds_count ${durationCount}`);

    lines.push(
        '# HELP journalfit_process_uptime_seconds Process uptime in seconds',
        '# TYPE journalfit_process_uptime_seconds gauge',
        `journalfit_process_uptime_seconds ${process.uptime().toFixed(3)}`,
        '# HELP nodejs_heap_size_used_bytes Node.js heap memory used in bytes',
        '# TYPE nodejs_heap_size_used_bytes gauge',
        `nodejs_heap_size_used_bytes ${process.memoryUsage().heapUsed}`
    );

    return `${lines.join('\n')}\n`;
}
