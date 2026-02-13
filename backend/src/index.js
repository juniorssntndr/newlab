import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const app = express();
app.use(cors());
app.use(express.json());

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
