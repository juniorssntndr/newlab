import crypto from 'node:crypto';
import { buildMarketingAudience } from './marketingAudience.js';
import { campaignError, campaignPayloadHash, campaignRequestId, normalizeCampaign } from './marketingCampaignPolicy.js';
import { sendCampaignPush } from '../modules/notifications/pushNotificationService.js';

export const CAMPAIGN_MIGRATION = 'migration_938_campaign_delivery.sql';
export async function campaignReadiness(pool) {
    const { rows } = await pool.query(`SELECT
        to_regclass('public.nl_campana_envios') IS NOT NULL
        AND to_regclass('public.nl_campana_destinatarios') IS NOT NULL
        AND to_regclass('public.nl_campana_push_envios') IS NOT NULL
        AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'nl_campanas_marketing' AND column_name IN ('fecha_inicio', 'fecha_fin')) = 2
        AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_campaign_coupon_usage' AND tgrelid = to_regclass('public.nl_descuentos_usos') AND NOT tgisinternal AND tgenabled = 'O')
        AND to_regclass('public.uq_campaign_coupon') IS NOT NULL AS ready`);
    return { ready: rows[0]?.ready === true, migration: CAMPAIGN_MIGRATION };
}
async function requireReady(pool) {
    if (!(await campaignReadiness(pool)).ready) throw campaignError(`Envíos no habilitados: falta aplicar ${CAMPAIGN_MIGRATION}. No se envió nada.`, 503);
}
export async function campaignAudience(pool, type, ids) {
    const audience = buildMarketingAudience(type, ids);
    if (audience.clinicIds.length) {
        const found = await pool.query('SELECT id FROM nl_clinicas WHERE id = ANY($1::int[])', [audience.clinicIds]);
        if (found.rows.length !== audience.clinicIds.length) throw campaignError('Alguna clínica seleccionada ya no existe.');
    }
    const { rows } = await pool.query(audience.query, audience.params);
    return rows;
}
export async function previewCampaignAudience(pool, body) {
    const rows = await campaignAudience(pool, body.tipo_audiencia, body.segmento_ids);
    const ids = rows.map(row => row.id);
    const subscriptions = ids.length ? await pool.query('SELECT COUNT(*)::int AS devices, COUNT(DISTINCT usuario_id)::int AS accounts FROM nl_push_subscriptions WHERE usuario_id = ANY($1::int[])', [ids]) : { rows: [{ devices: 0, accounts: 0 }] };
    const accounts = Number(subscriptions.rows[0].accounts);
    return { total: ids.length, cuentas: ids.length, clinicas: new Set(rows.map(row => row.clinica_id)).size, cuentas_push: accounts, dispositivos_push: Number(subscriptions.rows[0].devices), sin_push: ids.length - accounts };
}
export async function campaignDispatchStatus(pool, ownerId, requestId) {
    const { rows } = await pool.query('SELECT * FROM nl_campana_envios WHERE creado_por = $1 AND request_id = $2', [ownerId, campaignRequestId(requestId)]);
    if (!rows.length) return null;
    const dispatch = rows[0];
    const counts = await pool.query(`SELECT estado, COUNT(*)::int AS total FROM nl_campana_push_envios WHERE envio_id = $1 GROUP BY estado`, [dispatch.id]);
    const metrics = { ...dispatch.metricas, push_aceptados: 0, push_fallidos: 0, push_omitidos: 0, push_pendientes: 0, push_inciertos: 0 };
    const labels = { accepted: 'push_aceptados', failed: 'push_fallidos', skipped: 'push_omitidos', pending: 'push_pendientes', sending: 'push_inciertos' };
    for (const row of counts.rows) metrics[labels[row.estado]] = Number(row.total);
    return { envio_id: dispatch.id, request_id: dispatch.request_id, campana_id: dispatch.campana_id, es_prueba: dispatch.es_prueba, estado: dispatch.estado, metricas: metrics,
        advertencia: metrics.push_inciertos || metrics.push_pendientes ? 'Hay despachos sin resultado confirmado. No se reenvían automáticamente; revisa este estado antes de crear otra campaña.' : null };
}
export async function createCampaignDispatch({ pool, ownerId, body, isTest = false, validateImage, sendPush = sendCampaignPush }) {
    const campaign = normalizeCampaign(body);
    const requestId = campaignRequestId(body.request_id);
    const hash = campaignPayloadHash(campaign, isTest);
    if (campaign.imagen_url) await validateImage(body, ownerId);
    await requireReady(pool); // Never write or send against an old schema.
    const client = await pool.connect();
    let dispatchId;
    let campaignId = null;
    let couponCode = null;
    let subscriptions = [];
    let recipients = [];
    let replay = false;
    try {
        await client.query('BEGIN');
        await client.query("SET LOCAL lock_timeout = '5s'");
        await client.query("SET LOCAL statement_timeout = '20s'");
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`campaign:${ownerId}:${requestId}`]);
        const existing = await client.query('SELECT id, payload_hash FROM nl_campana_envios WHERE creado_por = $1 AND request_id = $2', [ownerId, requestId]);
        if (existing.rows.length) {
            if (existing.rows[0].payload_hash !== hash) throw campaignError('Este identificador ya corresponde a otro contenido. Revisa el envío anterior.', 409);
            replay = true;
        } else {
            recipients = isTest ? [{ id: ownerId }] : await campaignAudience(client, campaign.tipo_audiencia, campaign.segmento_ids);
            if (!recipients.length) throw campaignError('La audiencia no tiene cuentas activas.');
            let couponId = campaign.cupon_id || null;
            if (couponId) {
                const existingCoupon = await client.query('SELECT id, codigo FROM nl_descuentos WHERE id = $1', [couponId]);
                if (existingCoupon.rows.length) {
                    couponCode = existingCoupon.rows[0].codigo;
                }
            } else if (campaign.beneficio && !isTest) {
                const b = campaign.beneficio;
                couponCode = `AFX-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
                const coupon = await client.query(`INSERT INTO nl_descuentos
                    (codigo, descripcion, tipo, valor, limite_usos_total, limite_usos_por_doctor, fecha_inicio, fecha_fin,
                     monto_minimo_pedido, tope_descuento_maximo, creado_por, origen, evento_nombre, para_un_solo_producto)
                    VALUES ($1,$2,$3,$4,NULL,$5,$6,$7,$8,$9,$10,'campana',$2,TRUE) RETURNING id`,
                [couponCode, campaign.titulo, b.tipo, b.valor, b.limite_usos_por_clinica, campaign.fecha_inicio, campaign.fecha_fin, b.monto_minimo_pedido || 0, b.tope_descuento_maximo, ownerId]);
                couponId = coupon.rows[0].id;
            }

            if (!isTest) {
                const result = await client.query(`INSERT INTO nl_campanas_marketing
                    (titulo,mensaje,imagen_url,tipo_audiencia,segmento_ids,beneficio_tipo,cupon_id,codigo_descuento,link_destino,
                     mostrar_toast_in_app,enviar_push_web,creado_por,fecha_inicio,fecha_fin,total_enviados)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,0) RETURNING id`,
                [campaign.titulo, campaign.mensaje, campaign.imagen_url, campaign.tipo_audiencia, JSON.stringify(campaign.segmento_ids), couponId ? 'cupon' : 'comunicado', couponId, couponCode, campaign.link_destino, campaign.mostrar_toast_in_app, campaign.enviar_push_web, ownerId, campaign.fecha_inicio, campaign.fecha_fin]);
                campaignId = result.rows[0].id;
                await client.query(`INSERT INTO nl_campana_destinatarios (campana_id, usuario_id, clinica_id)
                    SELECT $1, r.id, r.clinica_id FROM jsonb_to_recordset($2::jsonb) AS r(id int, clinica_id int)`, [campaignId, JSON.stringify(recipients.map(r => ({ id: r.id, clinica_id: r.clinica_id })))]);
            }
            const notificationData = {
                campana_id: campaignId,
                prueba_campana: isTest,
                imagen_url: campaign.imagen_url,
                codigo_descuento: couponCode,
                texto_boton: campaign.texto_boton,
                beneficio: campaign.beneficio,
                mostrar_toast_in_app: campaign.mostrar_toast_in_app,
                fecha_inicio: campaign.fecha_inicio,
                fecha_fin: campaign.fecha_fin
            };
            if (campaign.mostrar_toast_in_app) {
                await client.query(`INSERT INTO nl_notificaciones (usuario_id,tipo,titulo,mensaje,link,data)
                    SELECT id,$2,$3,$4,$5,$6::jsonb FROM unnest($1::int[]) AS id`,
                [recipients.map(r => r.id), isTest ? 'prueba_campana' : 'campana_marketing', `${isTest ? '[PRUEBA] ' : ''}${campaign.titulo}`, campaign.mensaje, campaign.link_destino, JSON.stringify(notificationData)]);
            }
            subscriptions = campaign.enviar_push_web ? (await client.query('SELECT id,usuario_id,endpoint,p256dh,auth FROM nl_push_subscriptions WHERE usuario_id = ANY($1::int[]) ORDER BY id', [recipients.map(r => r.id)])).rows : [];
            if (isTest && !campaign.mostrar_toast_in_app && !subscriptions.length) throw campaignError('Tu cuenta no tiene dispositivos Push habilitados. Activa Portal para probar.');
            dispatchId = crypto.randomUUID();
            const metrics = { cuentas_objetivo: recipients.length, clinicas_objetivo: isTest ? 0 : new Set(recipients.map(r => r.clinica_id)).size, avisos_portal: campaign.mostrar_toast_in_app ? recipients.length : 0, dispositivos_objetivo: subscriptions.length, cuentas_sin_push: campaign.enviar_push_web ? recipients.length - new Set(subscriptions.map(s => s.usuario_id)).size : 0 };
            await client.query(`INSERT INTO nl_campana_envios (id,request_id,creado_por,payload_hash,es_prueba,campana_id,estado,metricas) VALUES ($1,$2,$3,$4,$5,$6,'dispatching',$7::jsonb)`, [dispatchId, requestId, ownerId, hash, isTest, campaignId, JSON.stringify(metrics)]);
            if (subscriptions.length) await client.query(`INSERT INTO nl_campana_push_envios (envio_id,subscription_id,usuario_id,estado)
                SELECT $1, s.id, s.usuario_id, 'pending' FROM jsonb_to_recordset($2::jsonb) AS s(id int,usuario_id int)`, [dispatchId, JSON.stringify(subscriptions.map(s => ({ id: s.id, usuario_id: s.usuario_id })))]);
        }
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
    if (replay) return { ...(await campaignDispatchStatus(pool, ownerId, requestId)), repetido: true };
    // Once committed, any interruption leaves a durable pending/unknown receipt.
    // Replaying the request only reads the receipt, never re-sends unknown results.
    let failed = false;
    try {
        const payload = { title: `${isTest ? '[PRUEBA] ' : ''}${campaign.titulo}`, body: campaign.mensaje, image: campaign.imagen_url || undefined, icon: '/icon-192x192.png', url: campaign.link_destino, tag: `campaign-${dispatchId}`, data: { campana_id: campaignId, codigo_descuento: couponCode } };
        for (let i = 0; i < subscriptions.length; i += 5) {
            const outcomes = await Promise.allSettled(subscriptions.slice(i, i + 5).map(async subscription => {
                await pool.query("UPDATE nl_campana_push_envios SET estado = 'sending' WHERE envio_id = $1 AND subscription_id = $2 AND estado = 'pending'", [dispatchId, subscription.id]);
                const outcome = await sendPush({ subscription, payload });
                if (!['accepted', 'failed', 'skipped'].includes(outcome?.state)) {
                    failed = true;
                    // The durable 'sending' state represents an unconfirmed
                    // provider result. Do not mislabel it failed or resend it.
                    return;
                }
                const state = outcome.state;
                if (state !== 'accepted') failed = true;
                await pool.query('UPDATE nl_campana_push_envios SET estado = $3 WHERE envio_id = $1 AND subscription_id = $2', [dispatchId, subscription.id, state]);
                if (outcome?.expired) await pool.query('DELETE FROM nl_push_subscriptions WHERE id = $1', [subscription.id]);
            }));
            if (outcomes.some(outcome => outcome.status === 'rejected')) throw new Error('Dispatch outcome could not be persisted');
        }
        await pool.query('UPDATE nl_campana_envios SET estado = $2, updated_at = NOW() WHERE id = $1', [dispatchId, failed ? 'partial' : 'completed']);
    } catch {
        // No success fiction: persistence/provider uncertainty stays visible, no auto retry.
        await pool.query("UPDATE nl_campana_envios SET estado = 'partial', updated_at = NOW() WHERE id = $1", [dispatchId]).catch(() => {});
    }
    return campaignDispatchStatus(pool, ownerId, requestId);
}
