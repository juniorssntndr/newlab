import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as Sentry from '@sentry/node';
import { randomUUID } from 'crypto';
import { getAllowedOrigins, getDatabaseUrl, getPort, getRateLimitConfig, getSentryConfig, isProd } from './config/env.js';
import { logger } from './lib/logger.js';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: getDatabaseUrl() });

const app = express();

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
        path: req.url,
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
        return callback(new Error('Origin no permitido por CORS'));
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

// Make pool available to routes
app.locals.pool = pool;

// Routes
import authRoutes from './routes/auth.js';
import clinicasRoutes from './routes/clinicas.js';
import productosRoutes from './routes/productos.js';
import pedidosRoutes from './routes/pedidos.js';
import finanzasRoutes from './routes/finanzas.js';
import dashboardRoutes from './routes/dashboard.js';
import notificacionesRoutes from './routes/notificaciones.js';
import categoriasRoutes from './routes/categorias.js';
import inventoryRoutes from './routes/inventory.js';
import usuariosRoutes from './routes/usuarios.js';
import auditRoutes from './routes/audit.js';

app.use('/api/auth', authRoutes);
app.use('/api/clinicas', clinicasRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/finanzas', finanzasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/audit', auditRoutes);

// Static uploads
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
                path: req.url,
                user_id: req.user?.id || null
            }
        });
    }
    logger.error('request_failed', {
        request_id: req.requestId || null,
        method: req.method,
        path: req.url,
        user_id: req.user?.id || null,
        message: err.message
    });
    res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

const PORT = getPort();
app.listen(PORT, () => {
    logger.info('api_started', { port: PORT, env: sentryConfig.environment });
});
