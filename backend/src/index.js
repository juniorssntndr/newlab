import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as Sentry from '@sentry/node';
import { randomUUID } from 'crypto';
import { getAllowedOrigins, getPort, getRateLimitConfig, getSentryConfig, isProd } from './config/env.js';
import { logger } from './lib/logger.js';
import { createCompositionRoot } from './bootstrap/compositionRoot.js';
import { registerRoutes } from './bootstrap/registerRoutes.js';
import { syncMissingClinicEstablishments } from './modules/crm/application/services/clinicCrmIntegration.js';
import viewerRoutes from './routes/viewer.js';
import { sanitizeRequestPath } from './lib/sanitizeRequestPath.js';

const app = express();

// Trust reverse proxy (Traefik in Coolify) so req.hostname and IPs are correctly derived
app.set('trust proxy', true);

const sentryConfig = getSentryConfig();
if (sentryConfig.dsn) {
    Sentry.init({
        dsn: sentryConfig.dsn,
        environment: sentryConfig.environment
    });
}

// 1. Request logger
app.use((req, res, next) => {
    const requestId = randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    logger.info('request_received', {
        request_id: requestId,
        method: req.method,
        path: sanitizeRequestPath(req.originalUrl || req.url),
        user_id: req.user?.id || null,
        ip: req.ip
    });
    next();
});

// 2. CORS
const allowedOrigins = getAllowedOrigins();
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (!isProd()) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        // Reject without throwing — a thrown Error becomes HTTP 500 and looks like "Failed to fetch".
        return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

const rateConfig = getRateLimitConfig();
app.use(rateLimit({
    windowMs: rateConfig.windowMs,
    max: rateConfig.max,
    standardHeaders: true,
    legacyHeaders: false
}));

app.use(express.json());

// Coolify routes viewer.afinixlab.com to this isolated path; never expose it on the authenticated frontend origin.
app.use('/viewer', viewerRoutes);

// Make pool available to routes
const compositionRoot = createCompositionRoot();
app.locals.pool = compositionRoot.pool;
app.locals.modules = compositionRoot.modules;

registerRoutes(app, compositionRoot);

// Static uploads
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', (req, res, next) => {
    if (/\.html?$/i.test(req.path)) return res.status(404).end();
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('X-Frame-Options');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/', (req, res) => res.json({ status: 'API Online', version: '1.0.0' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Error handler
app.use((err, req, res, next) => {
    if (sentryConfig.dsn) {
        Sentry.captureException(err, {
            tags: { request_id: req.requestId || 'n/a' },
            extra: {
                method: req.method,
                path: sanitizeRequestPath(req.originalUrl || req.url),
                user_id: req.user?.id || null
            }
        });
    }
    logger.error('request_failed', {
        request_id: req.requestId || null,
        method: req.method,
        path: sanitizeRequestPath(req.originalUrl || req.url),
        user_id: req.user?.id || null,
        message: err.message
    });
    const status = err.status || 500;
    const safeMessage = status >= 500 && isProd()
        ? 'Error interno del servidor'
        : (err.message || 'Error interno del servidor');
    res.status(status).json({ error: safeMessage, request_id: req.requestId || null });
});

const PORT = getPort();
app.listen(PORT, () => {
    logger.info('api_started', {
        port: PORT,
        env: sentryConfig.environment,
        billing_acl_mode: app.locals?.modules?.billing?.billingAclMode || 'unknown'
    });

    try {
        import('./modules/billing/application/services/billingPassiveWorker.js').then(({ startBillingPassiveWorker }) => {
            startBillingPassiveWorker({
                pool: app.locals.pool,
                billingModule: app.locals?.modules?.billing,
                intervalMs: 5 * 60 * 1000
            });
            logger.info('billing_passive_worker_initialized', { interval_sec: 300 });
        }).catch((err) => {
            logger.error('failed_to_initialize_billing_passive_worker', { error: err.message });
        });
    } catch (workerErr) {
        logger.error('billing_passive_worker_startup_error', { error: workerErr.message });
    }

    syncMissingClinicEstablishments(app.locals.pool).then((count) => {
        if (count > 0) {
            logger.info('crm_synced_missing_establishments', { count });
        }
    }).catch((err) => {
        logger.error('failed_to_sync_missing_establishments', { error: err.message });
    });
});
