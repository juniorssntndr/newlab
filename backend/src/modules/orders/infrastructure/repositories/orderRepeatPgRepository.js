import { buildRepeatQuote, repeatError, repeatFingerprint } from '../../domain/orderRepeat.js';

const loadSource = async (db, orderId, lock = false) => {
    const source = (await db.query(`SELECT * FROM nl_pedidos WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [orderId])).rows[0];
    const items = (await db.query(`SELECT i.*, p.precio_base, p.activo, p.nombre AS producto_nombre,
        TO_CHAR(CURRENT_DATE + p.tiempo_estimado_dias, 'YYYY-MM-DD') AS delivery_date
        FROM nl_pedido_items i LEFT JOIN nl_productos p ON p.id=i.producto_id
        WHERE i.pedido_id=$1 ORDER BY i.id`, [orderId])).rows;
    return { source, items };
};

export const makeOrderRepeatPgRepository = ({ pool, igvFactor }) => ({
    quote: async (orderId) => {
        const { source, items } = await loadSource(pool, orderId);
        return buildRepeatQuote(source, items, igvFactor);
    },
    listRelated: async (orderId) => (await pool.query(`SELECT id,codigo,estado,repeat_source_id,repeat_kind,total
        FROM nl_pedidos WHERE repeat_source_id=$1 OR id=(SELECT repeat_source_id FROM nl_pedidos WHERE id=$1)
        ORDER BY id`, [orderId])).rows,
    listPhotos: async (orderId) => (await pool.query('SELECT id,mime_type FROM nl_pedido_repeat_photos WHERE pedido_id=$1 ORDER BY id', [orderId])).rows,
    readPhoto: async (orderId, photoId) => (await pool.query('SELECT data,mime_type FROM nl_pedido_repeat_photos WHERE pedido_id=$1 AND id=$2', [orderId, photoId])).rows[0],
    create: async (orderId, actorId, input) => {
        const db = await pool.connect();
        try {
            await db.query('BEGIN');
            await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [input.requestKey]);
            const fingerprint = repeatFingerprint(orderId, actorId, input);
            const existing = (await db.query('SELECT * FROM nl_pedidos WHERE repeat_request_key=$1', [input.requestKey])).rows[0];
            if (existing) {
                if (existing.repeat_request_hash !== fingerprint) throw repeatError('La solicitud ya se usó con otros datos', 'CONFLICT');
                await db.query('COMMIT');
                return existing;
            }
            const { source, items } = await loadSource(db, orderId, true);
            const quote = buildRepeatQuote(source, items, igvFactor);
            const total = input.kind === 'warranty' ? 0 : quote.total;
            if (total !== input.expectedTotal) throw repeatError('El precio cambió. Revisa el importe actualizado antes de confirmar', 'CONFLICT');
            const id = (await db.query("SELECT nextval(pg_get_serial_sequence('nl_pedidos','id')) AS id")).rows[0].id;
            const label = input.kind === 'warranty' ? 'Garantía sin cobro' : 'Repetición con cobro';
            const child = (await db.query(`INSERT INTO nl_pedidos
                (id,codigo,clinica_id,paciente_nombre,fecha_entrega,estado,observaciones,subtotal,igv,total,created_by,
                 repeat_source_id,repeat_kind,repeat_reason,repeat_reference_total,repeat_request_key,repeat_request_hash)
                VALUES ($1,$2,$3,$4,$5,'en_diseno',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
                [id, `NL-${String(id).padStart(5, '0')}`, source.clinica_id, source.paciente_nombre, quote.deliveryDate,
                    [source.observaciones, `${label}: ${input.reason}`].filter(Boolean).join('\n'),
                    total === 0 ? 0 : quote.subtotal, total === 0 ? 0 : quote.igv, total, actorId,
                    orderId, input.kind, input.reason, quote.total, input.requestKey, fingerprint])).rows[0];
            // Copy only clinical fields, never old prices, responsibility, approvals or payments.
            for (const item of items) {
                const price = input.kind === 'warranty' ? 0 : Number(item.precio_base);
                await db.query(`INSERT INTO nl_pedido_items
                    (pedido_id,producto_id,piezas_dentales,pilares_dentales,ponticos_dentales,tramos_detalle,guia_color,
                     es_puente,pieza_inicio,pieza_fin,material,color_vita,color_munon,textura,oclusion,notas,cantidad,precio_unitario,subtotal)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
                    [id,item.producto_id,item.piezas_dentales,item.pilares_dentales,item.ponticos_dentales,
                        JSON.stringify(item.tramos_detalle || []),item.guia_color,item.es_puente,item.pieza_inicio,item.pieza_fin,
                        item.material,item.color_vita,item.color_munon,item.textura,item.oclusion,item.notas,item.cantidad,
                        price,Math.round(price * Number(item.cantidad) * 100) / 100]);
            }
            for (const photo of input.photos) await db.query('INSERT INTO nl_pedido_repeat_photos(pedido_id,mime_type,data) VALUES ($1,$2,$3)', [id,photo.mime,photo.buffer]);
            await db.query(`INSERT INTO nl_pedido_timeline(pedido_id,estado_nuevo,usuario_id,comentario)
                VALUES ($1,'en_diseno',$2,$3),($4,NULL,$2,$5)`,
                [id,actorId,`${label} de ${source.codigo}: ${input.reason}`,orderId,`${label}: nuevo pedido ${child.codigo}. ${input.reason}`]);
            await db.query('COMMIT');
            return child;
        } catch (error) {
            await db.query('ROLLBACK');
            throw error;
        } finally {
            db.release();
        }
    }
});
