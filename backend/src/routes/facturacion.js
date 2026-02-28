import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { emitirComprobanteSunat } from '../services/apisperu.js';

const router = Router();
router.use(authenticateToken);

// Emitir comprobante electrónico SUNAT (Boleta o Factura)
router.post('/:pedidoId/emitir', async (req, res, next) => {
    try {
        const { tipoComprobante, billingData } = req.body; // '01' (Factura) o '03' (Boleta)
        if (!['01', '03'].includes(tipoComprobante)) {
            return res.status(400).json({ error: 'Tipo de comprobante inválido. Use 01 o 03.' });
        }

        const pool = req.app.locals.pool;

        // Aquí podrías validar que solo admin o ciertos roles puedan emitir
        if (req.user.tipo !== 'admin' && req.user.tipo !== 'tecnico') {
            return res.status(403).json({ error: 'No tienes permiso para emitir comprobantes.' });
        }

        // Verificar si ya existe un comprobante para este pedido
        const existing = await pool.query('SELECT * FROM nl_comprobantes WHERE pedido_id = $1 LIMIT 1', [req.params.pedidoId]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'El pedido ya tiene un comprobante emitido.' });
        }

        const comprobante = await emitirComprobanteSunat(pool, req.params.pedidoId, tipoComprobante, billingData);

        res.json(comprobante);
    } catch (err) {
        console.error('Error al emitir comprobante:', err);
        import('fs').then(fs => fs.appendFileSync('error_facturacion.log', `[${new Date().toISOString()}] ${err.stack}\n`));
        next(err);
    }
});

// Listar comprobantes de un pedido
router.get('/:pedidoId', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;

        // Si el usuario es cliente, validar que el pedido es de su clínica
        if (req.user.tipo === 'cliente') {
            const pedido = await pool.query('SELECT clinica_id FROM nl_pedidos WHERE id = $1', [req.params.pedidoId]);
            if (pedido.rows.length === 0 || Number(pedido.rows[0].clinica_id) !== Number(req.user.clinica_id)) {
                return res.status(403).json({ error: 'Acceso denegado' });
            }
        }

        const result = await pool.query(
            'SELECT * FROM nl_comprobantes WHERE pedido_id = $1 ORDER BY created_at DESC',
            [req.params.pedidoId]
        );
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

// Listar todos los comprobantes globales (Historial)
router.get('/', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;

        let queryStr = `
            SELECT c.*, p.codigo as pedido_codigo, p.paciente_nombre, cl.nombre as clinica_nombre
            FROM nl_comprobantes c
            JOIN nl_pedidos p ON c.pedido_id = p.id
            LEFT JOIN nl_clinicas cl ON p.clinica_id = cl.id
        `;
        const queryParams = [];

        // Si es cliente, solo ve los comprobantes de su clínica
        if (req.user.tipo === 'cliente') {
            queryStr += ` WHERE p.clinica_id = $1`;
            queryParams.push(req.user.clinica_id);
        }

        queryStr += ` ORDER BY c.created_at DESC`;

        const result = await pool.query(queryStr, queryParams);
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

export default router;
