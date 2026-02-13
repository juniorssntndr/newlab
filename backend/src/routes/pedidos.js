import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// GET /api/pedidos
router.get('/', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { estado, clinica_id, search, responsable_id } = req.query;
        let query = `SELECT p.*, c.nombre as clinica_nombre, u.nombre as responsable_nombre
                 FROM nl_pedidos p
                 LEFT JOIN nl_clinicas c ON p.clinica_id = c.id
                 LEFT JOIN nl_usuarios u ON p.responsable_id = u.id
                 WHERE 1=1`;
        const params = [];

        // Clients can only see their own clinic's orders
        if (req.user.tipo === 'cliente' && req.user.clinica_id) {
            params.push(req.user.clinica_id);
            query += ` AND p.clinica_id = $${params.length}`;
        }
        if (estado) { params.push(estado); query += ` AND p.estado = $${params.length}`; }
        if (clinica_id) { params.push(clinica_id); query += ` AND p.clinica_id = $${params.length}`; }
        if (responsable_id) { params.push(responsable_id); query += ` AND p.responsable_id = $${params.length}`; }
        if (search) { params.push(`%${search}%`); query += ` AND (p.codigo ILIKE $${params.length} OR p.paciente_nombre ILIKE $${params.length})`; }
        query += ' ORDER BY p.created_at DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) { next(err); }
});

// GET /api/pedidos/:id
router.get('/:id', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const pedido = await pool.query(
            `SELECT p.*, c.nombre as clinica_nombre, u.nombre as responsable_nombre, cr.nombre as creador_nombre
       FROM nl_pedidos p
       LEFT JOIN nl_clinicas c ON p.clinica_id = c.id
       LEFT JOIN nl_usuarios u ON p.responsable_id = u.id
       LEFT JOIN nl_usuarios cr ON p.created_by = cr.id
       WHERE p.id = $1`, [req.params.id]
        );
        if (pedido.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });

        const items = await pool.query(
            `SELECT pi.*, pr.nombre as producto_nombre
       FROM nl_pedido_items pi LEFT JOIN nl_productos pr ON pi.producto_id = pr.id
       WHERE pi.pedido_id = $1`, [req.params.id]
        );

        const timeline = await pool.query(
            `SELECT t.*, u.nombre as usuario_nombre FROM nl_pedido_timeline t
       LEFT JOIN nl_usuarios u ON t.usuario_id = u.id
       WHERE t.pedido_id = $1 ORDER BY t.created_at ASC`, [req.params.id]
        );

        const aprobaciones = await pool.query(
            'SELECT * FROM nl_pedido_aprobaciones WHERE pedido_id = $1 ORDER BY created_at DESC', [req.params.id]
        );

        res.json({
            ...pedido.rows[0],
            items: items.rows,
            timeline: timeline.rows,
            aprobaciones: aprobaciones.rows
        });
    } catch (err) { next(err); }
});

// POST /api/pedidos
router.post('/', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { clinica_id, paciente_nombre, fecha_entrega, observaciones, archivos_urls, items } = req.body;
        if (!clinica_id || !paciente_nombre || !fecha_entrega) {
            return res.status(400).json({ error: 'Clínica, paciente y fecha de entrega son requeridos' });
        }

        // Generate unique code
        const countResult = await pool.query('SELECT COUNT(*) FROM nl_pedidos');
        const count = parseInt(countResult.rows[0].count) + 1;
        const codigo = `NL-${String(count).padStart(5, '0')}`;

        // Calculate totals from items
        let subtotal = 0;
        if (items && items.length > 0) {
            subtotal = items.reduce((sum, item) => sum + (item.precio_unitario * (item.cantidad || 1)), 0);
        }
        const igv = subtotal * 0.18;
        const total = subtotal + igv;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const pedidoResult = await client.query(
                `INSERT INTO nl_pedidos (codigo, clinica_id, paciente_nombre, fecha_entrega, observaciones, archivos_urls, subtotal, igv, total, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
                [codigo, clinica_id, paciente_nombre, fecha_entrega, observaciones, archivos_urls, subtotal, igv, total, req.user.id]
            );
            const pedido = pedidoResult.rows[0];

            // Insert items
            if (items && items.length > 0) {
                for (const item of items) {
                    await client.query(
                        `INSERT INTO nl_pedido_items (pedido_id, producto_id, piezas_dentales, es_puente, pieza_inicio, pieza_fin,
             material, color_vita, color_munon, textura, oclusion, notas, cantidad, precio_unitario, subtotal)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
                        [pedido.id, item.producto_id, item.piezas_dentales || [], item.es_puente || false,
                        item.pieza_inicio, item.pieza_fin, item.material, item.color_vita, item.color_munon,
                        item.textura, item.oclusion, item.notas, item.cantidad || 1, item.precio_unitario || 0,
                        (item.precio_unitario || 0) * (item.cantidad || 1)]
                    );
                }
            }

            // Timeline entry
            await client.query(
                `INSERT INTO nl_pedido_timeline (pedido_id, estado_nuevo, usuario_id, comentario)
         VALUES ($1, 'pendiente', $2, 'Pedido creado')`,
                [pedido.id, req.user.id]
            );

            // Notify lab admins/technicians
            const admins = await client.query("SELECT id FROM nl_usuarios WHERE tipo IN ('admin','tecnico') AND estado='activo'");
            for (const admin of admins.rows) {
                await client.query(
                    `INSERT INTO nl_notificaciones (usuario_id, tipo, titulo, mensaje, link)
           VALUES ($1, 'nuevo_pedido', 'Nuevo Pedido Recibido', $2, $3)`,
                    [admin.id, `Pedido ${codigo} de ${paciente_nombre}`, `/pedidos/${pedido.id}`]
                );
            }

            await client.query('COMMIT');
            res.status(201).json(pedido);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) { next(err); }
});

// PATCH /api/pedidos/:id/estado
router.patch('/:id/estado', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { estado, sub_estado, comentario, responsable_id } = req.body;
        if (!estado) return res.status(400).json({ error: 'Estado es requerido' });

        const current = await pool.query('SELECT * FROM nl_pedidos WHERE id = $1', [req.params.id]);
        if (current.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });

        const pedido = current.rows[0];

        // Validate state transitions
        const validTransitions = {
            pendiente: ['en_diseno'],
            en_diseno: ['esperando_aprobacion'],
            esperando_aprobacion: ['en_produccion', 'en_diseno'],
            en_produccion: ['terminado'],
            terminado: ['enviado']
        };

        if (!validTransitions[pedido.estado]?.includes(estado)) {
            return res.status(400).json({ error: `Transición de "${pedido.estado}" a "${estado}" no permitida` });
        }

        let updateQuery = 'UPDATE nl_pedidos SET estado = $1, updated_at = NOW()';
        const updateParams = [estado];

        if (sub_estado) { updateParams.push(sub_estado); updateQuery += `, sub_estado = $${updateParams.length}`; }
        if (responsable_id) { updateParams.push(responsable_id); updateQuery += `, responsable_id = $${updateParams.length}`; }

        updateParams.push(req.params.id);
        updateQuery += ` WHERE id = $${updateParams.length} RETURNING *`;

        const result = await pool.query(updateQuery, updateParams);

        // Timeline
        await pool.query(
            `INSERT INTO nl_pedido_timeline (pedido_id, estado_anterior, estado_nuevo, usuario_id, comentario)
       VALUES ($1, $2, $3, $4, $5)`,
            [req.params.id, pedido.estado, estado, req.user.id, comentario]
        );

        // Notify: if waiting for approval, notify the client
        if (estado === 'esperando_aprobacion') {
            const clientUsers = await pool.query(
                "SELECT id FROM nl_usuarios WHERE clinica_id = $1 AND tipo = 'cliente' AND estado = 'activo'",
                [pedido.clinica_id]
            );
            for (const cu of clientUsers.rows) {
                await pool.query(
                    `INSERT INTO nl_notificaciones (usuario_id, tipo, titulo, mensaje, link)
           VALUES ($1, 'aprobacion', 'Diseño listo para aprobar', $2, $3)`,
                    [cu.id, `Pedido ${pedido.codigo} tiene un diseño para revisar`, `/pedidos/${pedido.id}`]
                );
            }
        }

        // If sent, notify client
        if (estado === 'enviado') {
            const clientUsers = await pool.query(
                "SELECT id FROM nl_usuarios WHERE clinica_id = $1 AND tipo = 'cliente' AND estado = 'activo'",
                [pedido.clinica_id]
            );
            for (const cu of clientUsers.rows) {
                await pool.query(
                    `INSERT INTO nl_notificaciones (usuario_id, tipo, titulo, mensaje, link)
           VALUES ($1, 'enviado', 'Pedido Enviado', $2, $3)`,
                    [cu.id, `Su pedido ${pedido.codigo} ha sido enviado`, `/pedidos/${pedido.id}`]
                );
            }
        }

        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

// POST /api/pedidos/:id/aprobacion
router.post('/:id/aprobacion', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { link_exocad } = req.body;
        const result = await pool.query(
            `INSERT INTO nl_pedido_aprobaciones (pedido_id, link_exocad) VALUES ($1, $2) RETURNING *`,
            [req.params.id, link_exocad]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
});

// PATCH /api/pedidos/:id/aprobacion/:aprobacionId
router.patch('/:id/aprobacion/:aprobacionId', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { estado, comentario_cliente } = req.body;
        const result = await pool.query(
            `UPDATE nl_pedido_aprobaciones SET estado=$1, comentario_cliente=$2, respondido_at=NOW()
       WHERE id=$3 RETURNING *`,
            [estado, comentario_cliente, req.params.aprobacionId]
        );

        // If approved, auto-transition pedido to en_produccion
        if (estado === 'aprobado') {
            await pool.query("UPDATE nl_pedidos SET estado='en_produccion', updated_at=NOW() WHERE id=$1", [req.params.id]);
            await pool.query(
                `INSERT INTO nl_pedido_timeline (pedido_id, estado_anterior, estado_nuevo, usuario_id, comentario)
         VALUES ($1, 'esperando_aprobacion', 'en_produccion', $2, 'Diseño aprobado por el cliente')`,
                [req.params.id, req.user.id]
            );
        } else if (estado === 'ajuste_solicitado') {
            await pool.query("UPDATE nl_pedidos SET estado='en_diseno', updated_at=NOW() WHERE id=$1", [req.params.id]);
            await pool.query(
                `INSERT INTO nl_pedido_timeline (pedido_id, estado_anterior, estado_nuevo, usuario_id, comentario)
         VALUES ($1, 'esperando_aprobacion', 'en_diseno', $2, $3)`,
                [req.params.id, req.user.id, `Ajuste solicitado: ${comentario_cliente}`]
            );
        }

        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

export default router;
