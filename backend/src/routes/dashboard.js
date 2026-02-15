import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

const statusFlow = ['pendiente', 'en_diseno', 'esperando_aprobacion', 'en_produccion', 'terminado', 'enviado'];

// GET /api/dashboard/stats
router.get('/stats', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;

        const [pedidosTotal, pedidosHoy, enProduccion, pendientes, clinicasActivas, terminadosMes, timelineMes] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM nl_pedidos'),
            pool.query("SELECT COUNT(*) FROM nl_pedidos WHERE fecha = CURRENT_DATE"),
            pool.query("SELECT COUNT(*) FROM nl_pedidos WHERE estado = 'en_produccion'"),
            pool.query("SELECT COUNT(*) FROM nl_pedidos WHERE estado = 'pendiente'"),
            pool.query("SELECT COUNT(*) FROM nl_clinicas WHERE estado = 'activo'"),
            pool.query("SELECT COUNT(*) FROM nl_pedidos WHERE estado IN ('terminado','enviado') AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)"),
            pool.query("SELECT estado_anterior, estado_nuevo FROM nl_pedido_timeline WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) AND estado_anterior IS NOT NULL AND estado_nuevo IS NOT NULL")
        ]);

        const statusIndex = new Map(statusFlow.map((s, i) => [s, i]));
        const retrocesosMes = timelineMes.rows.reduce((sum, row) => {
            const prev = statusIndex.get(row.estado_anterior);
            const next = statusIndex.get(row.estado_nuevo);
            if (prev === undefined || next === undefined) return sum;
            return next < prev ? sum + 1 : sum;
        }, 0);

        // Orders by status
        const porEstado = await pool.query(
            'SELECT estado, COUNT(*) as count FROM nl_pedidos GROUP BY estado'
        );

        // Recent orders
        const recientes = await pool.query(
            `SELECT p.id, p.codigo, p.estado, p.paciente_nombre, p.fecha_entrega, p.total, p.subtotal, c.nombre as clinica_nombre
       FROM nl_pedidos p LEFT JOIN nl_clinicas c ON p.clinica_id = c.id
       ORDER BY p.created_at DESC LIMIT 5`
        );

        // Monthly revenue (last 6 months)
        const ingresosMensuales = await pool.query(`
      SELECT DATE_TRUNC('month', created_at) as mes, SUM(total) as total
      FROM nl_pedidos WHERE created_at >= NOW() - INTERVAL '6 months'
      GROUP BY mes ORDER BY mes
    `);

        res.json({
            kpis: {
                total_pedidos: parseInt(pedidosTotal.rows[0].count),
                pedidos_hoy: parseInt(pedidosHoy.rows[0].count),
                en_produccion: parseInt(enProduccion.rows[0].count),
                pendientes: parseInt(pendientes.rows[0].count),
                clinicas_activas: parseInt(clinicasActivas.rows[0].count),
                terminados_mes: parseInt(terminadosMes.rows[0].count),
                retrocesos_mes: retrocesosMes
            },
            por_estado: porEstado.rows,
            recientes: recientes.rows,
            ingresos_mensuales: ingresosMensuales.rows
        });
    } catch (err) { next(err); }
});

export default router;
