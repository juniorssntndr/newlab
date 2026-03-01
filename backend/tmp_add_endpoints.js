import fs from 'fs';
import path from 'path';

const filePath = 'd:/Archivos personales/Antigravity/NEWLAB/backend/src/routes/finanzas.js';
let content = fs.readFileSync(filePath, 'utf8');

const newEndpoints = `
// GET /api/finanzas/estado-cuenta/:clinica_id
router.get('/estado-cuenta/:clinica_id', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const clinicaId = req.params.clinica_id;

        // Security check for client role
        if (req.user.tipo === 'cliente' && req.user.clinica_id !== parseInt(clinicaId)) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        // Get clinica info
        const clinicaResult = await pool.query('SELECT id, nombre, ruc FROM nl_clinicas WHERE id = $1', [clinicaId]);
        if (clinicaResult.rows.length === 0) return res.status(404).json({ error: 'Clínica no encontrada' });
        const clinica = clinicaResult.rows[0];

        // Get all pending orders for this clinica (where total > monto_pagado)
        const query = \`
            SELECT p.id, p.codigo, p.created_at, p.paciente_nombre, p.total,
                   COALESCE(pg.monto_pagado, 0) as monto_pagado,
                   (p.total - COALESCE(pg.monto_pagado, 0)) as saldo
            FROM nl_pedidos p
            LEFT JOIN (
                SELECT pedido_id, SUM(monto) as monto_pagado
                FROM nl_pagos
                GROUP BY pedido_id
            ) pg ON pg.pedido_id = p.id
            WHERE p.clinica_id = $1 AND (p.total - COALESCE(pg.monto_pagado, 0)) > 0
            ORDER BY p.created_at ASC
        \`;
        const result = await pool.query(query, [clinicaId]);
        
        const pedidosPendientes = result.rows.map(row => ({
            ...row,
            total: parseFloat(row.total || 0),
            monto_pagado: parseFloat(row.monto_pagado || 0),
            saldo: parseFloat(row.saldo || 0)
        }));

        const saldoTotalPendiente = pedidosPendientes.reduce((sum, p) => sum + p.saldo, 0);

        res.json({
            clinica_id: clinica.id,
            clinica_nombre: clinica.nombre,
            clinica_ruc: clinica.ruc,
            saldo_total_pendiente: saldoTotalPendiente,
            pedidos_pendientes: pedidosPendientes
        });
    } catch (err) { next(err); }
});

// POST /api/finanzas/pagos-masivos
router.post('/pagos-masivos', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        if (req.user.tipo === 'cliente') return res.status(403).json({ error: 'No autorizado' });

        const { clinica_id, monto_total, metodo, referencia, fecha_pago, notas } = req.body;
        const montoTotalNumber = parseFloat(monto_total);

        if (!clinica_id || isNaN(montoTotalNumber) || montoTotalNumber <= 0) {
            return res.status(400).json({ error: 'Datos inválidos. Se requiere clinica_id y un monto_total mayor a 0.' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Find all pending orders for this clinica, FOR UPDATE to lock them during transaction
            const pendingOrdersQuery = \`
                SELECT p.id, p.codigo, p.total, COALESCE(pg.monto_pagado, 0) as monto_pagado,
                       (p.total - COALESCE(pg.monto_pagado, 0)) as saldo
                FROM nl_pedidos p
                LEFT JOIN (
                    SELECT pedido_id, SUM(monto) as monto_pagado
                    FROM nl_pagos
                    GROUP BY pedido_id
                ) pg ON pg.pedido_id = p.id
                WHERE p.clinica_id = $1 AND (p.total - COALESCE(pg.monto_pagado, 0)) > 0
                ORDER BY p.created_at ASC
                FOR UPDATE OF p
            \`;
            
            const ordersResult = await client.query(pendingOrdersQuery, [clinica_id]);
            const pendingOrders = ordersResult.rows.map(row => ({
                ...row,
                total: parseFloat(row.total || 0),
                saldo: parseFloat(row.saldo || 0)
            }));

            let remainingMonto = montoTotalNumber;
            const pagosRegistrados = [];

            for (const order of pendingOrders) {
                if (remainingMonto <= 0) break; // Finished distributing payment

                const montoAbonarOrder = Math.min(order.saldo, remainingMonto);
                
                // Insert individual payment record for this order
                const pagoResult = await client.query(
                    \`INSERT INTO nl_pagos (pedido_id, monto, metodo, referencia, fecha_pago, notas, creado_por)
                     VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE), $6, $7)
                     RETURNING *\`,
                    [
                        order.id, 
                        montoAbonarOrder, 
                        metodo || 'transferencia', 
                        referencia || 'Pago Masivo', 
                        fecha_pago || null, 
                        notas || 'Abono automático por pago masivo', 
                        req.user.id
                    ]
                );

                pagosRegistrados.push({
                    pedido_codigo: order.codigo,
                    monto_abonado: montoAbonarOrder,
                    pago: normalizePago(pagoResult.rows[0])
                });

                remainingMonto -= montoAbonarOrder;
            }

            await client.query('COMMIT');

            // Audit
            await writeAuditEvent(req, {
                entidad: 'clinica',
                entidadId: clinica_id,
                accion: 'pago_masivo_created',
                descripcion: \`Pago masivo de S/. \${montoTotalNumber.toFixed(2)} distribuido en \${pagosRegistrados.length} pedidos.\`,
                metadata: {
                    clinica_id,
                    monto_total: montoTotalNumber,
                    pedidos_afectados: pagosRegistrados.length
                }
            });

            res.status(201).json({
                message: 'Pago masivo procesado exitosamente',
                monto_total_ingresado: montoTotalNumber,
                monto_total_distribuido: montoTotalNumber - remainingMonto,
                monto_sobrante: remainingMonto, // Positive if they overpaid their entire debt
                pagos_registrados: pagosRegistrados
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (err) { next(err); }
});
`;

// Insert the new endpoints just before the patch for /pagos/:pagoId/conciliar
content = content.replace('// PATCH /api/finanzas/pagos/:pagoId/conciliar', newEndpoints + '\n// PATCH /api/finanzas/pagos/:pagoId/conciliar');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Endpoints added to finanzas.js');
