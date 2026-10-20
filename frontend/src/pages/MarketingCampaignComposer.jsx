import React, { useEffect, useRef, useState } from 'react';
import { apiClient } from '../services/http/apiClient.js';
import { useAuth } from '../state/AuthContext.jsx';
import CustomSelect from '../components/CustomSelect.jsx';
import FormDatePicker from '../components/FormDatePicker.jsx';
import Modal from '../components/Modal.jsx';
import { marketingErrorMessage, marketingClinicLabel } from './marketingData.js';
import { campaignAudiences, campaignBenefitLabel, campaignContentError, campaignDestinations, campaignReceiptLines, newCampaignForm } from './marketingCampaign.js';

const steps = ['Contenido', 'Destinatarios', 'Revisar'];
export default function MarketingCampaignComposer({ open, onClose, clinicas, cupones, onCreateCoupon, onCreated }) {
    const { getHeaders, user } = useAuth();
    const [form, setForm] = useState(newCampaignForm);
    const [step, setStep] = useState(0);
    const [audience, setAudience] = useState(null);
    const [readiness, setReadiness] = useState(null);
    const [readinessLoading, setReadinessLoading] = useState(false);
    const [readinessAttempt, setReadinessAttempt] = useState(0);
    const [previewBusy, setPreviewBusy] = useState(false);
    const [busy, setBusy] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [imageName, setImageName] = useState('');
    const [createdCoupons, setCreatedCoupons] = useState([]);
    const imageInputRef = useRef(null);
    const [error, setError] = useState('');
    const [receipt, setReceipt] = useState(null);
    const [pending, setPending] = useState(null);
    const [confirmed, setConfirmed] = useState(false);
    const requestRef = useRef(null);
    const errorRef = useRef(null);
    const activeRef = useRef(true);
    const pendingKey = `afinix-campaign-pending:${user?.id}`;
    const patch = values => { setForm(prev => ({ ...prev, ...values })); setConfirmed(false); requestRef.current = null; setReceipt(null); setError(''); };
    const patchBenefit = values => patch({ beneficio: { ...form.beneficio, ...values } });
    const updatePending = value => {
        setPending(value);
        try { if (value) sessionStorage.setItem(pendingKey, JSON.stringify(value)); else sessionStorage.removeItem(pendingKey); } catch { /* The durable server receipt is still authoritative. */ }
    };
    useEffect(() => { activeRef.current = true; return () => { activeRef.current = false; }; }, []);
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        try { const stored = JSON.parse(sessionStorage.getItem(pendingKey) || 'null'); if (stored?.request_id) setPending(stored); } catch { /* Invalid local draft does not authorize an action. */ }
        setReadinessLoading(true);
        setReadiness(previous => previous?.error ? { ...previous, ready: false } : null);
        apiClient.get('/api/marketing/campanas/readiness', { headers: getHeaders() })
            .then(result => { if (!cancelled) setReadiness(result); })
            .catch(err => { if (!cancelled) setReadiness({ ready: false, error: marketingErrorMessage(err) }); })
            .finally(() => { if (!cancelled) setReadinessLoading(false); });
        return () => { cancelled = true; };
    }, [open, pendingKey, readinessAttempt]);
    useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
    useEffect(() => {
        if (!open) return;
        setAudience(null);
        if (form.tipo_audiencia === 'clinicas_especificas' && !form.segmento_ids.length) { setPreviewBusy(false); return; }
        let cancelled = false;
        setPreviewBusy(true);
        const timer = setTimeout(() => apiClient.post('/api/marketing/campanas/preview', { tipo_audiencia: form.tipo_audiencia, segmento_ids: form.segmento_ids }, { headers: getHeaders() })
            .then(result => { if (!cancelled) setAudience(result); })
            .catch(err => { if (!cancelled) setError(marketingErrorMessage(err)); })
            .finally(() => { if (!cancelled) setPreviewBusy(false); }), 250);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [open, form.tipo_audiencia, form.segmento_ids]);
    const upload = async event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Sube PNG, JPEG o WebP de hasta 5 MB.'); return; }
        setUploading(true); setError('');
        try {
            const body = new FormData(); body.append('imagen', file);
            const result = await apiClient('/api/marketing/campanas/imagen', { method: 'POST', body, headers: getHeaders() });
            if (activeRef.current) {
                patch({ imagen_url: result.imagen_url, imagen_token: result.imagen_token });
                setImageName(file.name);
            }
        } catch (err) { if (activeRef.current) setError(marketingErrorMessage(err)); }
        finally { if (activeRef.current) setUploading(false); }
    };
    const next = () => {
        const invalid = step === 0 ? campaignContentError(form) : !audience?.cuentas ? 'Selecciona una audiencia con cuentas activas.' : !form.mostrar_toast_in_app && !form.enviar_push_web ? 'Selecciona al menos un canal.' : '';
        if (invalid) { setError(invalid); return; }
        setError(''); setStep(prev => prev + 1);
    };
    const acceptReceipt = async (result, isTest) => {
        setReceipt(result);
        if (result.estado === 'dispatching' || result.metricas?.push_inciertos || result.metricas?.push_pendientes) return;
        updatePending(null); requestRef.current = null;
        if (!isTest) await onCreated?.();
    };
    const send = async isTest => {
        const invalid = campaignContentError(form);
        if (invalid) { setError(invalid); return; }
        if (!readiness?.ready || readinessLoading || pending || busy) return;
        const requestId = requestRef.current || crypto.randomUUID();
        requestRef.current = requestId;
        const operation = { request_id: requestId, es_prueba: isTest };
        updatePending(operation);
        setBusy(true); setError(''); setReceipt(null);
        try {
            const result = await apiClient.post(`/api/marketing/campanas${isTest ? '/prueba' : ''}`, { ...form, request_id: requestId }, { headers: getHeaders() });
            await acceptReceipt(result.data, isTest);
        } catch (err) {
            if ((err.status >= 400 && err.status < 500) || (err.status === 503 && /migration_938/.test(err.message))) { updatePending(null); requestRef.current = null; }
            setError(marketingErrorMessage(err));
        } finally { setBusy(false); }
    };
    const checkStatus = async () => {
        setBusy(true); setError('');
        try { const result = await apiClient.get(`/api/marketing/campanas/envios/${pending.request_id}`, { headers: getHeaders() }); await acceptReceipt(result.data, pending.es_prueba); }
        catch (err) { if (err.status === 404) { updatePending(null); requestRef.current = null; } setError(marketingErrorMessage(err)); }
        finally { setBusy(false); }
    };
    const close = () => {
        if (busy || uploading) return;
        if (receipt && !pending && !receipt.es_prueba) { setForm(newCampaignForm()); setReceipt(null); setStep(0); setConfirmed(false); }
        onClose();
    };
    const benefitText = campaignBenefitLabel(form.beneficio, form.codigo_descuento);
    const immutable = busy || Boolean(pending) || Boolean(receipt && !receipt.es_prueba);
    return <Modal open={open} onClose={close} title="Nueva campaña" subtitle="Prepara, prueba y revisa antes del envío masivo." icon="bi-broadcast" size="2xl" className="marketing-modal campaign-composer-modal" footer={
            <div className="campaign-actions"><button type="button" className="btn btn-ghost" disabled={busy || uploading} onClick={close}>Cerrar</button>{step > 0 && <button type="button" className="btn btn-secondary" disabled={immutable || uploading} onClick={() => setStep(prev => prev - 1)}>Atrás</button>}{step < 2 ? <button type="button" className="btn btn-primary" disabled={immutable || uploading || previewBusy} onClick={next}>Continuar</button> : <button type="button" className="btn btn-primary" disabled={immutable || !confirmed || !readiness?.ready || readinessLoading || !audience?.cuentas || uploading || previewBusy} onClick={() => send(false)}>{busy ? 'Procesando…' : `Enviar a ${audience?.cuentas || 0} cuentas`}</button>}</div>
        }>
        <div className="campaign-composer">
            <ol className="campaign-steps" aria-label="Progreso">{steps.map((name, index) => <li key={name} aria-current={index === step ? 'step' : undefined}><span>{index + 1}</span>{name}</li>)}</ol>
            {error && <div className="marketing-inline-alert" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
            {readiness && !readiness.ready && <div className={`campaign-readiness${readiness.error ? ' campaign-readiness-error' : ''}`} role="status">
                <div className="campaign-readiness-heading"><i className={`bi ${readiness.error ? 'bi-exclamation-circle' : 'bi-info-circle'}`} aria-hidden="true" /><strong>{readiness.error ? 'No se pudo verificar el envío' : 'Envíos pendientes de habilitación'}</strong></div>
                <p>{readiness.error ? 'Puedes preparar la campaña, pero no se enviará hasta verificar el servicio.' : 'Puedes preparar y revisar la campaña. Falta actualizar la base de datos para habilitar pruebas y envíos; no se enviará nada.'}</p>
                <details><summary>Detalles técnicos</summary><p>{readiness.error || `Actualización pendiente: ${readiness.migration}.`}</p></details>
                {readiness.error && <button type="button" className="btn btn-secondary" disabled={readinessLoading || busy || Boolean(pending)} onClick={() => setReadinessAttempt(previous => previous + 1)}><i className="bi bi-arrow-clockwise" aria-hidden="true" />{readinessLoading ? 'Verificando…' : 'Reintentar'}</button>}
            </div>}
            {pending && <div className="campaign-status" role="status"><p>Hay una operación pendiente de confirmar. No vuelvas a enviar.</p><button type="button" className="btn btn-secondary" disabled={busy} onClick={checkStatus}>Consultar estado</button></div>}
            {receipt && <section className="campaign-status" aria-label="Resultado"><h3>{receipt.es_prueba ? 'Resultado de la prueba' : 'Resultado de campaña'}</h3><p>{receipt.estado === 'completed' ? 'Procesamiento finalizado.' : 'Procesamiento parcial o pendiente de confirmar.'}</p><ul>{campaignReceiptLines(receipt).map(line => <li key={line}>{line}</li>)}</ul><p>Push aceptado no confirma entrega ni lectura en el dispositivo.</p>{receipt.advertencia && <p>{receipt.advertencia}</p>}</section>}
            <div className="campaign-workspace">
                <fieldset disabled={immutable || uploading} className="campaign-fields">
                    {step === 0 && <>
                        <label htmlFor="campaign-title">
                            Nombre de la campaña
                            <input
                                id="campaign-title"
                                className="form-input"
                                maxLength={120}
                                value={form.titulo}
                                onChange={e => patch({ titulo: e.target.value })}
                                placeholder="Ej: Promo Apertura S/50 - Noviembre 2026"
                            />
                        </label>

                        <div className="campaign-flyer-picker">
                            <input ref={imageInputRef} id="campaign-image" type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={upload} />
                            <div className="campaign-flyer-picker-header">
                                <label htmlFor="campaign-image" className="campaign-flyer-picker-label">
                                    Flyer del pop-up
                                </label>
                                <span className={`campaign-flyer-badge ${form.imagen_url ? 'is-custom' : 'is-default'}`}>
                                    <i className={`bi ${form.imagen_url ? 'bi-image-fill' : 'bi-shield-check'}`} aria-hidden="true" />
                                    {form.imagen_url ? (imageName || 'Flyer personalizado') : 'Flyer oficial AFINIX'}
                                </span>
                            </div>
                            <div className="campaign-flyer-picker-bar">
                                <button type="button" className="btn btn-secondary btn-sm" disabled={immutable || uploading} onClick={() => imageInputRef.current?.click()}>
                                    <i className="bi bi-cloud-arrow-up" aria-hidden="true" />
                                    {uploading ? 'Subiendo…' : form.imagen_url ? 'Reemplazar imagen' : 'Subir otro flyer'}
                                </button>
                                {form.imagen_url && (
                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { patch({ imagen_url: '', imagen_token: '' }); setImageName(''); }}>
                                        <i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Restaurar oficial
                                    </button>
                                )}
                                <span className="campaign-flyer-picker-hint">PNG o JPG hasta 5 MB</span>
                            </div>
                        </div>

                        <div className="campaign-pair">
                            <div className="form-group">
                                <label htmlFor="campaign-button-text" className="form-label">
                                    Texto del botón comercial
                                </label>
                                <input
                                    id="campaign-button-text"
                                    type="text"
                                    className="form-input"
                                    maxLength={30}
                                    value={form.texto_boton ?? 'QUIERO MI DESCUENTO'}
                                    onChange={e => patch({ texto_boton: e.target.value })}
                                    placeholder="Ej. QUIERO MI DESCUENTO"
                                    style={{ fontWeight: 700 }}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="campaign-destination" className="form-label">
                                    Destino al hacer clic
                                </label>
                                <CustomSelect
                                    disabled={Boolean(immutable) || uploading}
                                    id="campaign-destination"
                                    options={campaignDestinations}
                                    value={form.link_destino}
                                    onChange={(_, value) => patch({ link_destino: value })}
                                />
                            </div>
                        </div>

                        <div className="campaign-pair">
                            <div className="form-group">
                                <label htmlFor="campaign-start" className="form-label">
                                    Vigente desde
                                </label>
                                <FormDatePicker
                                    id="campaign-start"
                                    value={form.fecha_inicio}
                                    onChange={iso => patch({ fecha_inicio: iso })}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="campaign-end" className="form-label">
                                    Hasta (Fin de la oferta)
                                </label>
                                <FormDatePicker
                                    id="campaign-end"
                                    value={form.fecha_fin}
                                    min={form.fecha_inicio}
                                    onChange={iso => patch({ fecha_fin: iso })}
                                />
                            </div>
                        </div>

                        {/* Beneficio: Selección de Cupón Promocional */}
                        <div className="campaign-coupon-picker-block">
                            <div className="campaign-coupon-picker-header">
                                <label htmlFor="campaign-coupon" className="campaign-coupon-picker-label">
                                    Cupón de descuento asociado (opcional)
                                </label>
                                {onCreateCoupon && (
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        disabled={Boolean(immutable) || uploading}
                                        onClick={() => onCreateCoupon((newCode, createdCoupon) => {
                                            const found = createdCoupon || (cupones || []).find(c => c.codigo === newCode);
                                            if (createdCoupon) {
                                                setCreatedCoupons(prev => [createdCoupon, ...prev.filter(c => c.id !== createdCoupon.id)]);
                                            }
                                            if (found) {
                                                patch({
                                                    cupon_id: found.id,
                                                    codigo_descuento: found.codigo,
                                                    beneficio: { tipo: found.tipo, valor: found.valor }
                                                });
                                            } else if (newCode) {
                                                patch({
                                                    codigo_descuento: newCode
                                                });
                                            }
                                        })}
                                        style={{ fontSize: '0.8rem', padding: '3px 10px', flexShrink: 0 }}
                                    >
                                        <i className="bi bi-plus-lg" aria-hidden="true" /> Crear cupón
                                    </button>
                                )}
                            </div>
                            <CustomSelect
                                disabled={Boolean(immutable) || uploading}
                                id="campaign-coupon"
                                placeholder="Selecciona un cupón o déjalo sin cupón..."
                                options={[
                                    { value: '', label: 'Sin cupón promocional', icon: 'bi-slash-circle' },
                                    ...[
                                        ...createdCoupons,
                                        ...(cupones || []).filter(c => !createdCoupons.some(cc => cc.id === c.id))
                                    ].filter(c => c.activo !== false).map(c => ({
                                        value: String(c.id),
                                        label: `${c.codigo} · ${c.tipo === 'porcentaje' ? `${c.valor}% OFF` : `S/ ${c.valor} OFF`}`,
                                        icon: 'bi-ticket-perforated'
                                    }))
                                ]}
                                value={form.cupon_id ? String(form.cupon_id) : ''}
                                onChange={(_, value) => {
                                    if (!value) {
                                        patch({ cupon_id: null, codigo_descuento: '', beneficio: null });
                                    } else {
                                        const allList = [...createdCoupons, ...(cupones || [])];
                                        const selected = allList.find(c => String(c.id) === String(value));
                                        patch({
                                            cupon_id: Number(value),
                                            codigo_descuento: selected?.codigo || '',
                                            beneficio: selected ? { tipo: selected.tipo, valor: selected.valor } : null
                                        });
                                    }
                                }}
                            />
                        </div>

                        <details style={{ marginTop: 2 }}>
                            <summary style={{ cursor: 'pointer', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                                Texto alternativo para notificación push (opcional)
                            </summary>
                            <label htmlFor="campaign-message" style={{ marginTop: 10 }}>
                                Mensaje Push para celular / navegador
                                <textarea
                                    id="campaign-message"
                                    className="form-input"
                                    maxLength={600}
                                    rows={2}
                                    value={form.mensaje}
                                    onChange={e => patch({ mensaje: e.target.value })}
                                    placeholder="Beneficio exclusivo para tu próximo trabajo en AFINIX Dental Lab."
                                />
                            </label>
                        </details>
                    </>}
                    {step === 1 && <>
                        <div className="form-group">
                            <label htmlFor="campaign-audience" className="form-label">
                                Segmento de audiencia
                            </label>
                            <CustomSelect
                                disabled={Boolean(immutable) || uploading}
                                id="campaign-audience"
                                options={campaignAudiences}
                                value={form.tipo_audiencia}
                                onChange={(_, value) => patch({ tipo_audiencia: value, segmento_ids: [] })}
                            />
                        </div>

                        {form.tipo_audiencia === 'clinicas_especificas' && (
                            <div className="form-group" style={{ marginTop: '-4px' }}>
                                <label htmlFor="campaign-clinic" className="form-label">
                                    Añadir clínica al segmento
                                </label>
                                <CustomSelect
                                    disabled={Boolean(immutable) || uploading}
                                    id="campaign-clinic"
                                    value=""
                                    placeholder="Buscar y seleccionar clínica..."
                                    options={clinicas
                                        .filter(c => !form.segmento_ids.includes(Number(c.id)))
                                        .map(c => ({ value: String(c.id), label: marketingClinicLabel(c), icon: 'bi-building' }))}
                                    onChange={(_, value) => {
                                        if (value) patch({ segmento_ids: [...form.segmento_ids, Number(value)] });
                                    }}
                                />
                                {form.segmento_ids.length > 0 && (
                                    <div className="campaign-clinics-tags">
                                        {form.segmento_ids.map(id => (
                                            <button
                                                className="campaign-clinic-tag"
                                                type="button"
                                                key={id}
                                                title="Remover clínica"
                                                onClick={() => patch({ segmento_ids: form.segmento_ids.filter(selected => selected !== id) })}
                                            >
                                                <i className="bi bi-building" aria-hidden="true" />
                                                <span>{clinicas.find(c => Number(c.id) === id)?.nombre || id}</span>
                                                <i className="bi bi-x-lg" style={{ fontSize: '0.7rem' }} aria-hidden="true" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {!form.segmento_ids.length && (
                                    <small style={{ color: 'var(--color-warning, #d97706)', fontWeight: 600 }}>
                                        <i className="bi bi-exclamation-triangle" /> Selecciona al menos una clínica para continuar.
                                    </small>
                                )}
                            </div>
                        )}

                        <AudienceSummary audience={audience} loading={previewBusy} />

                        <div className="form-group" style={{ marginTop: '6px' }}>
                            <span className="form-label" style={{ marginBottom: '8px' }}>
                                Canales de difusión habilitados
                            </span>
                            <div className="campaign-channels-group">
                                <label className={`campaign-channel-card${form.mostrar_toast_in_app ? ' is-active' : ''}`}>
                                    <input
                                        type="checkbox"
                                        className="campaign-channel-check"
                                        checked={form.mostrar_toast_in_app}
                                        onChange={e => patch({ mostrar_toast_in_app: e.target.checked })}
                                    />
                                    <div className="campaign-channel-body">
                                        <span className="campaign-channel-title">
                                            <i className="bi bi-window-fullscreen text-primary" /> Pop-up en portal
                                        </span>
                                        <span className="campaign-channel-desc">
                                            Banner flotante y campanita interactiva al iniciar sesión.
                                        </span>
                                    </div>
                                </label>

                                <label className={`campaign-channel-card${form.enviar_push_web ? ' is-active' : ''}`}>
                                    <input
                                        type="checkbox"
                                        className="campaign-channel-check"
                                        checked={form.enviar_push_web}
                                        onChange={e => patch({ enviar_push_web: e.target.checked })}
                                    />
                                    <div className="campaign-channel-body">
                                        <span className="campaign-channel-title">
                                            <i className="bi bi-phone text-primary" /> Push Web
                                        </span>
                                        <span className="campaign-channel-desc">
                                            Notificación emergente a móviles y PC con permisos activos.
                                        </span>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </>}

                    {step === 2 && <>
                        <AudienceSummary audience={audience} loading={previewBusy} />

                        <div className="campaign-review-grid">
                            <div className="campaign-review-row">
                                <span className="campaign-review-label">
                                    <i className="bi bi-megaphone" /> Nombre
                                </span>
                                <span className="campaign-review-value">{form.titulo || 'Sin nombre'}</span>
                            </div>
                            <div className="campaign-review-row">
                                <span className="campaign-review-label">
                                    <i className="bi bi-calendar-range" /> Vigencia
                                </span>
                                <span className="campaign-review-value">
                                    {form.fecha_inicio} al {form.fecha_fin}
                                </span>
                            </div>
                            <div className="campaign-review-row">
                                <span className="campaign-review-label">
                                    <i className="bi bi-ticket-perforated" /> Beneficio
                                </span>
                                <span className="campaign-review-value">
                                    {benefitText}
                                </span>
                            </div>
                            <div className="campaign-review-row">
                                <span className="campaign-review-label">
                                    <i className="bi bi-cursor" /> Destino
                                </span>
                                <span className="campaign-review-value">
                                    {campaignDestinations.find(d => d.value === form.link_destino)?.label || form.link_destino}
                                </span>
                            </div>
                            <div className="campaign-review-row">
                                <span className="campaign-review-label">
                                    <i className="bi bi-broadcast" /> Canales
                                </span>
                                <span className="campaign-review-value">
                                    {[form.mostrar_toast_in_app && 'Pop-up Portal', form.enviar_push_web && 'Push Web'].filter(Boolean).join(' + ') || 'Ninguno'}
                                </span>
                            </div>
                        </div>

                        <div className="campaign-test-box">
                            <div className="campaign-test-info">
                                <span className="campaign-test-title">
                                    <i className="bi bi-shield-check text-primary" /> Envío de prueba preventivo
                                </span>
                                <p className="campaign-test-desc">
                                    Envía la notificación a tu cuenta para verificarla antes del lanzamiento.
                                </p>
                            </div>
                            <button
                                className="btn btn-secondary btn-sm"
                                type="button"
                                disabled={!readiness?.ready || readinessLoading || uploading || busy}
                                onClick={() => send(true)}
                            >
                                <i className="bi bi-eye" aria-hidden="true" /> Probar conmigo
                            </button>
                        </div>

                        <label className="campaign-auth-card">
                            <input
                                type="checkbox"
                                checked={confirmed}
                                onChange={e => setConfirmed(e.target.checked)}
                            />
                            <span>He revisado el flyer, las fechas y los destinatarios. Autorizo el lanzamiento oficial.</span>
                        </label>
                    </>}
                </fieldset>
                <aside className="campaign-preview campaign-preview--flyer" aria-label="Vista previa de campaña">
                    <span className="campaign-preview-label">Vista previa del pop-up en el portal</span>
                    <div className="campaign-flyer-card" style={{ width: '100%', maxWidth: '380px' }}>
                        <img
                            src={resolveImageUrl(form.imagen_url) || '/images/promo-popup-bg.png'}
                            alt="Vista previa de campaña"
                            className="campaign-flyer-bg-img"
                        />
                        <button type="button" className="campaign-flyer-close-btn" disabled tabIndex={-1} aria-hidden="true">
                            <i className="bi bi-x-lg" />
                        </button>
                        <div className="campaign-flyer-interactive-zone">
                            <div className="campaign-flyer-countdown">
                                <div className="campaign-flyer-countdown-box">
                                    <span className="campaign-flyer-countdown-num">02</span>
                                    <span className="campaign-flyer-countdown-lbl">DÍAS</span>
                                </div>
                                <div className="campaign-flyer-countdown-box">
                                    <span className="campaign-flyer-countdown-num">18</span>
                                    <span className="campaign-flyer-countdown-lbl">HORAS</span>
                                </div>
                                <div className="campaign-flyer-countdown-box">
                                    <span className="campaign-flyer-countdown-num">19</span>
                                    <span className="campaign-flyer-countdown-lbl">MINUTOS</span>
                                </div>
                                <div className="campaign-flyer-countdown-box">
                                    <span className="campaign-flyer-countdown-num">00</span>
                                    <span className="campaign-flyer-countdown-lbl">SEGUNDOS</span>
                                </div>
                            </div>
                            <button type="button" className="campaign-flyer-cta-btn" disabled>
                                <span>{form.texto_boton || 'QUIERO MI DESCUENTO'}</span>
                                <i className="bi bi-arrow-right" />
                            </button>
                            <span className="campaign-flyer-dismiss-link">No, gracias</span>
                        </div>
                    </div>
                </aside>
            </div>

        </div>
    </Modal>;
}
function AudienceSummary({ audience, loading }) {
    if (loading) {
        return (
            <div className="campaign-audience-card" style={{ textAlign: 'center', padding: '16px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                    <i className="bi bi-arrow-repeat spin" /> Calculando alcance del segmento…
                </span>
            </div>
        );
    }
    if (!audience) {
        return (
            <div className="campaign-audience-card" style={{ borderStyle: 'dashed' }}>
                <p className="campaign-audience-note" style={{ color: 'var(--color-warning, #d97706)' }}>
                    <i className="bi bi-exclamation-circle-fill" /> Selecciona clínicas para calcular el alcance de la audiencia.
                </p>
            </div>
        );
    }
    return (
        <div className="campaign-audience-card">
            <span className="campaign-section-title">
                <i className="bi bi-graph-up text-primary" /> Alcance estimado de la campaña
            </span>
            <div className="campaign-audience-metrics">
                <div className="campaign-metric-item">
                    <div className="campaign-metric-icon is-primary">
                        <i className="bi bi-person-check-fill" />
                    </div>
                    <div className="campaign-metric-content">
                        <span className="campaign-metric-val">{audience.cuentas || 0}</span>
                        <span className="campaign-metric-lbl">Cuentas activas ({audience.clinicas || 0} clínicas)</span>
                    </div>
                </div>
                <div className="campaign-metric-item">
                    <div className="campaign-metric-icon is-success">
                        <i className="bi bi-bell-fill" />
                    </div>
                    <div className="campaign-metric-content">
                        <span className="campaign-metric-val">{audience.cuentas_push || 0}</span>
                        <span className="campaign-metric-lbl">Con Push ({audience.dispositivos_push || 0} disp.)</span>
                    </div>
                </div>
            </div>
            <p className="campaign-audience-note">
                <i className="bi bi-shield-check text-primary" />
                <span>{audience.sin_push || 0} cuentas recibirán el pop-up dentro del portal al iniciar sesión.</span>
            </p>
        </div>
    );
}
