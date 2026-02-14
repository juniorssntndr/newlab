import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const app = express();

// Allowed origins
const allowedOrigins = [
    'https://juniorssntndr-newlab.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            // Check if it's a Vercel preview deployment
            if (origin.endsWith('.vercel.app')) {
                return callback(null, true);
            }
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true
}));

app.use(express.json());

// Request logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Make pool available to routes
app.locals.pool = pool;

// Routes
import authRoutes from './routes/auth.js';
import clinicasRoutes from './routes/clinicas.js';
import productosRoutes from './routes/productos.js';
import pedidosRoutes from './routes/pedidos.js';
import dashboardRoutes from './routes/dashboard.js';
import notificacionesRoutes from './routes/notificaciones.js';
import categoriasRoutes from './routes/categorias.js';

app.use('/api/auth', authRoutes);
app.use('/api/clinicas', clinicasRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/categorias', categoriasRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Error handler
app.use((err, req, res, next) => {
    console.error('[ERROR]', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`NewLab API running on port ${PORT}`);
});
