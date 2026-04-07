export const makeOrderPgRepository = ({ pool }) => ({
    listOrders: async ({ user, filters = {} }) => {
        const params = [];
        let query = `SELECT p.*, c.nombre as clinica_nombre, u.nombre as responsable_nombre,
                 (SELECT pr.nombre FROM nl_pedido_items pi JOIN nl_productos pr ON pi.producto_id = pr.id WHERE pi.pedido_id = p.id LIMIT 1) as producto_principal
                 FROM nl_pedidos p
                 LEFT JOIN nl_clinicas c ON p.clinica_id = c.id
                 LEFT JOIN nl_usuarios u ON p.responsable_id = u.id
                 WHERE 1=1`;

        if (user?.tipo === 'cliente' && user?.clinica_id) {
            params.push(user.clinica_id);
            query += ` AND p.clinica_id = $${params.length}`;
        }
        if (filters.estado) {
            params.push(filters.estado);
            query += ` AND p.estado = $${params.length}`;
        }
        if (filters.clinica_id) {
            params.push(filters.clinica_id);
            query += ` AND p.clinica_id = $${params.length}`;
        }
        if (filters.responsable_id) {
            params.push(filters.responsable_id);
            query += ` AND p.responsable_id = $${params.length}`;
        }
        if (filters.search) {
            params.push(`%${filters.search}%`);
            query += ` AND (p.codigo ILIKE $${params.length} OR p.paciente_nombre ILIKE $${params.length} OR c.nombre ILIKE $${params.length})`;
        }

        query += ' ORDER BY p.created_at DESC';

        const result = await pool.query(query, params);
        return result.rows;
    },
    getOrderBaseById: async ({ orderId }) => {
        const result = await pool.query(
            `SELECT p.*, c.nombre as clinica_nombre, c.ruc as clinica_ruc, c.dni as clinica_dni, c.razon_social as clinica_razon_social, c.direccion as clinica_direccion, u.nombre as responsable_nombre, cr.nombre as creador_nombre
             FROM nl_pedidos p
             LEFT JOIN nl_clinicas c ON p.clinica_id = c.id
             LEFT JOIN nl_usuarios u ON p.responsable_id = u.id
             LEFT JOIN nl_usuarios cr ON p.created_by = cr.id
             WHERE p.id = $1`,
            [orderId]
        );

        return result.rows[0] || null;
    },
    listOrderItems: async ({ orderId }) => {
        const result = await pool.query(
            `SELECT pi.*, pr.nombre as producto_nombre
             FROM nl_pedido_items pi LEFT JOIN nl_productos pr ON pi.producto_id = pr.id
             WHERE pi.pedido_id = $1`,
            [orderId]
        );

        return result.rows;
    },
    listOrderTimeline: async ({ orderId }) => {
        const result = await pool.query(
            `SELECT t.*, u.nombre as usuario_nombre FROM nl_pedido_timeline t
             LEFT JOIN nl_usuarios u ON t.usuario_id = u.id
             WHERE t.pedido_id = $1 ORDER BY t.created_at DESC NULLS LAST, t.id DESC`,
            [orderId]
        );

        return result.rows;
    },
    listOrderApprovals: async ({ orderId }) => {
        const result = await pool.query(
            'SELECT * FROM nl_pedido_aprobaciones WHERE pedido_id = $1 ORDER BY created_at DESC',
            [orderId]
        );

        return result.rows;
    },
    createOrder: async ({ orderInput, actorUserId }) => {
        const {
            clinica_id,
            paciente_nombre,
            fecha_entrega,
            observaciones,
            archivos_urls,
            items
        } = orderInput;

        const nextIdResult = await pool.query("SELECT nextval(pg_get_serial_sequence('nl_pedidos','id')) as id");
        const nextPedidoId = Number.parseInt(nextIdResult.rows[0].id, 10);
        const codigo = `NL-${String(nextPedidoId).padStart(5, '0')}`;

        const total = Array.isArray(items)
            ? items.reduce((sum, item) => sum + ((item.precio_unitario || 0) * (item.cantidad || 1)), 0)
            : 0;
        const subtotal = Number((total / 1.18).toFixed(2));
        const igv = Number((total - subtotal).toFixed(2));

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const pedidoResult = await client.query(
                `INSERT INTO nl_pedidos (id, codigo, clinica_id, paciente_nombre, fecha_entrega, observaciones, archivos_urls, subtotal, igv, total, created_by)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
                [
                    nextPedidoId,
                    codigo,
                    clinica_id,
                    paciente_nombre,
                    fecha_entrega,
                    observaciones,
                    archivos_urls,
                    subtotal,
                    igv,
                    total,
                    actorUserId
                ]
            );
            const pedido = pedidoResult.rows[0];

            if (Array.isArray(items) && items.length > 0) {
                for (const item of items) {
                    const itemTotal = (item.precio_unitario || 0) * (item.cantidad || 1);

                    await client.query(
                        `INSERT INTO nl_pedido_items (pedido_id, producto_id, piezas_dentales, es_puente, pieza_inicio, pieza_fin,
                         material, color_vita, color_munon, textura, oclusion, notas, cantidad, precio_unitario, subtotal)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
                        [
                            pedido.id,
                            item.producto_id,
                            item.piezas_dentales || [],
                            item.es_puente || false,
                            item.pieza_inicio,
                            item.pieza_fin,
                            item.material,
                            item.color_vita,
                            item.color_munon,
                            item.textura,
                            item.oclusion,
                            item.notas,
                            item.cantidad || 1,
                            item.precio_unitario || 0,
                            itemTotal
                        ]
                    );
                }
            }

            await client.query(
                `INSERT INTO nl_pedido_timeline (pedido_id, estado_nuevo, usuario_id, comentario)
                 VALUES ($1, 'pendiente', $2, 'Pedido creado')`,
                [pedido.id, actorUserId]
            );

            const admins = await client.query("SELECT id FROM nl_usuarios WHERE tipo IN ('admin','tecnico') AND estado='activo'");
            for (const admin of admins.rows) {
                await client.query(
                    `INSERT INTO nl_notificaciones (usuario_id, tipo, titulo, mensaje, link)
                     VALUES ($1, 'nuevo_pedido', 'Nuevo Pedido Recibido', $2, $3)`,
                    [admin.id, `Pedido ${codigo} de ${paciente_nombre}`, `/pedidos/${pedido.id}`]
                );
            }

            await client.query('COMMIT');

            return {
                pedido,
                totals: {
                    total,
                    subtotal,
                    igv
                }
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },
    updateOrderStatus: async ({ orderId, estado, sub_estado, comentario, responsable_id, link_exocad, actorUserId }) => {
        const current = await pool.query('SELECT * FROM nl_pedidos WHERE id = $1', [orderId]);
        if (current.rows.length === 0) {
            return { notFound: true };
        }

        const previousOrder = current.rows[0];

        let updateQuery = 'UPDATE nl_pedidos SET estado = $1, updated_at = NOW()';
        const updateParams = [estado];

        if (sub_estado) {
            updateParams.push(sub_estado);
            updateQuery += `, sub_estado = $${updateParams.length}`;
        }
        if (responsable_id) {
            updateParams.push(responsable_id);
            updateQuery += `, responsable_id = $${updateParams.length}`;
        }

        updateParams.push(orderId);
        updateQuery += ` WHERE id = $${updateParams.length} RETURNING *`;

        const updated = await pool.query(updateQuery, updateParams);
        const pedido = updated.rows[0];

        if (estado === 'esperando_aprobacion' && link_exocad) {
            await pool.query(
                'INSERT INTO nl_pedido_aprobaciones (pedido_id, link_exocad) VALUES ($1, $2)',
                [orderId, link_exocad]
            );
        }

        const timelineComment = comentario || (estado === 'esperando_aprobacion' && link_exocad ? 'Diseno enviado a aprobacion' : null);

        await pool.query(
            `INSERT INTO nl_pedido_timeline (pedido_id, estado_anterior, estado_nuevo, usuario_id, comentario)
             VALUES ($1, $2, $3, $4, $5)`,
            [orderId, previousOrder.estado, estado, actorUserId, timelineComment]
        );

        const clientNotifMap = {
            en_diseno: { tipo: 'estado_diseno', titulo: 'Pedido en Diseño', mensaje: `Tu pedido ${previousOrder.codigo} ha comenzado el proceso de diseño.` },
            esperando_aprobacion: { tipo: 'aprobacion', titulo: '⭐ Diseño listo para aprobar', mensaje: `Pedido ${previousOrder.codigo} tiene un diseño listo para que lo revises.` },
            en_produccion: { tipo: 'estado_produccion', titulo: 'Pedido en Producción', mensaje: `Tu pedido ${previousOrder.codigo} ha pasado a la etapa de producción.` },
            terminado: { tipo: 'estado_terminado', titulo: '✅ Pedido Terminado', mensaje: `Tu pedido ${previousOrder.codigo} está listo. Pronto será enviado.` },
            enviado: { tipo: 'enviado', titulo: '🚀 Pedido Enviado', mensaje: `Tu pedido ${previousOrder.codigo} ha sido enviado. ¡Gracias por confiar en nosotros!` }
        };

        const notifInfo = clientNotifMap[estado];
        if (notifInfo) {
            const clientUsers = await pool.query(
                "SELECT id FROM nl_usuarios WHERE clinica_id = $1 AND tipo = 'cliente' AND estado = 'activo'",
                [previousOrder.clinica_id]
            );

            for (const clientUser of clientUsers.rows) {
                await pool.query(
                    `INSERT INTO nl_notificaciones (usuario_id, tipo, titulo, mensaje, link)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [clientUser.id, notifInfo.tipo, notifInfo.titulo, notifInfo.mensaje, `/pedidos/${orderId}`]
                );
            }
        }

        return {
            notFound: false,
            pedido,
            previousOrder
        };
    },
    createOrderApprovalLink: async ({ orderId, link_exocad, actorUserId, comentario }) => {
        const pedidoResult = await pool.query('SELECT id FROM nl_pedidos WHERE id = $1', [orderId]);
        if (pedidoResult.rows.length === 0) {
            return { notFound: true };
        }

        const result = await pool.query(
            'INSERT INTO nl_pedido_aprobaciones (pedido_id, link_exocad) VALUES ($1, $2) RETURNING *',
            [orderId, link_exocad]
        );

        await pool.query(
            `INSERT INTO nl_pedido_timeline (pedido_id, estado_anterior, estado_nuevo, usuario_id, comentario)
             VALUES ($1, 'esperando_aprobacion', 'esperando_aprobacion', $2, $3)`,
            [orderId, actorUserId, comentario || 'Link de diseno actualizado']
        );

        return {
            notFound: false,
            approval: result.rows[0]
        };
    },
    updateOrderResponsible: async ({ orderId, responsable_id, actorUserId, comentario }) => {
        let responsableNombre = null;

        if (responsable_id) {
            const responsable = await pool.query(
                "SELECT id, nombre FROM nl_usuarios WHERE id = $1 AND tipo IN ('admin','tecnico') AND estado = 'activo'",
                [responsable_id]
            );

            if (responsable.rows.length === 0) {
                return { invalidResponsible: true };
            }

            responsableNombre = responsable.rows[0].nombre;
        }

        const result = await pool.query(
            'UPDATE nl_pedidos SET responsable_id = $1 WHERE id = $2 RETURNING *',
            [responsable_id || null, orderId]
        );

        if (result.rows.length === 0) {
            return { notFound: true };
        }

        const pedido = result.rows[0];
        const timelineComment = comentario || (responsableNombre ? `Responsable asignado: ${responsableNombre}` : 'Responsable liberado');

        await pool.query(
            `INSERT INTO nl_pedido_timeline (pedido_id, estado_anterior, estado_nuevo, usuario_id, comentario)
             VALUES ($1, $2, $3, $4, $5)`,
            [orderId, pedido.estado, pedido.estado, actorUserId, timelineComment]
        );

        return {
            notFound: false,
            invalidResponsible: false,
            pedido
        };
    },
    updateOrderDeliveryDate: async ({ orderId, fecha_entrega, actorUserId, comentario }) => {
        const result = await pool.query(
            'UPDATE nl_pedidos SET fecha_entrega = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [fecha_entrega, orderId]
        );

        if (result.rows.length === 0) {
            return { notFound: true };
        }

        const pedido = result.rows[0];

        await pool.query(
            `INSERT INTO nl_pedido_timeline (pedido_id, estado_anterior, estado_nuevo, usuario_id, comentario)
             VALUES ($1, $2, $3, $4, $5)`,
            [orderId, pedido.estado, pedido.estado, actorUserId, comentario || 'Fecha de entrega actualizada']
        );

        const fechaFormateada = new Date(fecha_entrega).toLocaleDateString('es-PE', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });

        const clientUsers = await pool.query(
            "SELECT id FROM nl_usuarios WHERE clinica_id = $1 AND tipo = 'cliente' AND estado = 'activo'",
            [pedido.clinica_id]
        );

        for (const clientUser of clientUsers.rows) {
            await pool.query(
                `INSERT INTO nl_notificaciones (usuario_id, tipo, titulo, mensaje, link)
                 VALUES ($1, 'fecha_actualizada', '📅 Fecha de entrega actualizada', $2, $3)`,
                [
                    clientUser.id,
                    `La fecha de entrega de ${pedido.codigo} fue actualizada al ${fechaFormateada}.`,
                    `/pedidos/${pedido.id}`
                ]
            );
        }

        return {
            notFound: false,
            pedido
        };
    },
    respondOrderApproval: async ({ orderId, approvalId, estado, comentarioCliente, actorUserId }) => {
        const pedidoResult = await pool.query('SELECT id, codigo, clinica_id FROM nl_pedidos WHERE id = $1', [orderId]);
        if (pedidoResult.rows.length === 0) {
            return { notFound: true };
        }

        const pedido = pedidoResult.rows[0];

        const result = await pool.query(
            `UPDATE nl_pedido_aprobaciones SET estado=$1, comentario_cliente=$2, respondido_at=NOW()
             WHERE id=$3 AND pedido_id=$4 RETURNING *`,
            [estado, comentarioCliente || null, approvalId, orderId]
        );

        if (result.rows.length === 0) {
            return {
                notFound: false,
                approvalNotFound: true,
                pedido
            };
        }

        const labUsers = await pool.query("SELECT id FROM nl_usuarios WHERE tipo IN ('admin','tecnico') AND estado='activo'");

        if (estado === 'aprobado') {
            await pool.query("UPDATE nl_pedidos SET estado='en_produccion', updated_at=NOW() WHERE id=$1", [orderId]);
            await pool.query(
                `INSERT INTO nl_pedido_timeline (pedido_id, estado_anterior, estado_nuevo, usuario_id, comentario)
                 VALUES ($1, 'esperando_aprobacion', 'en_produccion', $2, 'Diseño aprobado por el cliente')`,
                [orderId, actorUserId]
            );

            for (const labUser of labUsers.rows) {
                await pool.query(
                    `INSERT INTO nl_notificaciones (usuario_id, tipo, titulo, mensaje, link)
                     VALUES ($1, 'aprobacion_aprobada', 'Diseño aprobado', $2, $3)`,
                    [labUser.id, `Cliente aprobó el diseño de ${pedido.codigo}`, `/pedidos/${pedido.id}`]
                );
            }
        } else if (estado === 'ajuste_solicitado') {
            await pool.query("UPDATE nl_pedidos SET estado='en_diseno', updated_at=NOW() WHERE id=$1", [orderId]);
            await pool.query(
                `INSERT INTO nl_pedido_timeline (pedido_id, estado_anterior, estado_nuevo, usuario_id, comentario)
                 VALUES ($1, 'esperando_aprobacion', 'en_diseno', $2, $3)`,
                [orderId, actorUserId, `Ajuste solicitado: ${comentarioCliente}`]
            );

            for (const labUser of labUsers.rows) {
                await pool.query(
                    `INSERT INTO nl_notificaciones (usuario_id, tipo, titulo, mensaje, link)
                     VALUES ($1, 'ajuste_solicitado', 'Ajustes solicitados', $2, $3)`,
                    [labUser.id, `Cliente solicitó ajustes para ${pedido.codigo}`, `/pedidos/${pedido.id}`]
                );
            }
        }

        return {
            notFound: false,
            approvalNotFound: false,
            pedido,
            approval: result.rows[0]
        };
    }
});
