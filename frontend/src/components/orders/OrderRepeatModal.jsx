import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../state/AuthContext.jsx';
import Modal from '../Modal.jsx';
import { apiClient } from '../../services/http/apiClient.js';
import { invalidateOrderDetailAndLists } from '../../modules/orders/mutations/invalidateOrdersQueries.js';
import { buildRepeatFormData } from '../../modules/orders/orderRepeat.js';

const photoKey = (file) => JSON.stringify([file.name, file.size, file.lastModified, file.type]);

const RepeatPhotoPreview = ({ file, onRemove }) => {
    const [previewUrl, setPreviewUrl] = useState('');
    useEffect(() => {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);
    const size = file.size < 1024 * 1024
        ? `${Math.max(1, Math.round(file.size / 1024))} KB`
        : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    return (
        <li className="order-repeat-photo">
            <div className="order-repeat-photo-image">
                {previewUrl && <img src={previewUrl} alt={`Vista previa de ${file.name}`} />}
                <button type="button" className="order-repeat-photo-remove" onClick={onRemove} aria-label={`Quitar foto ${file.name}`} title="Quitar foto">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
                </button>
            </div>
            <div className="order-repeat-photo-caption">
                <span title={file.name}>{file.name}</span>
                <small>{size}</small>
            </div>
        </li>
    );
};

const OrderRepeatModal = ({ order, onClose, onCreated }) => {
    const { getHeaders } = useAuth();
    const queryClient = useQueryClient();
    const [kind, setKind] = useState('warranty');
    const [reason, setReason] = useState('');
    const [photos, setPhotos] = useState([]);
    const [chargeAgreed, setChargeAgreed] = useState(false);
    const [error, setError] = useState('');
    const requestKey = useRef(crypto.randomUUID());
    const submitting = useRef(false);
    const photoInput = useRef(null);
    const { data: quote, isPending: loadingQuote, error: quoteError, refetch } = useQuery({
        queryKey: ['order-repeat-quote', order.id],
        queryFn: () => apiClient(`/pedidos/${order.id}/repeticion/cotizacion`, { headers: getHeaders() }),
        staleTime: 0, retry: false
    });
    const mutation = useMutation({
        mutationFn: (payload) => apiClient(`/pedidos/${order.id}/repeticion`, { method: 'POST', headers: getHeaders(), body: payload }),
    });
    useEffect(() => { setChargeAgreed(false); }, [kind, quote?.total]);
    const submit = async (event) => {
        event.preventDefault();
        if (submitting.current || !quote) return;
        submitting.current = true;
        setError('');
        try {
            const child = await mutation.mutateAsync(buildRepeatFormData({ kind, reason, requestKey: requestKey.current, chargeAgreed, total: quote.total, photos }));
            // A cache refresh failure must not turn a committed order into a failed submission.
            invalidateOrderDetailAndLists(queryClient, order.id).catch(() => {});
            onCreated(child);
        } catch (err) {
            setError(err.message);
            if (err.status === 409) refetch();
        } finally {
            submitting.current = false;
        }
    };
    const selectPhotos = (event) => {
        const selected = Array.from(event.target.files || []);
        event.target.value = '';
        if (!selected.length) return;
        const existingKeys = new Set(photos.map(photoKey));
        const additions = selected.filter(file => {
            const key = photoKey(file);
            if (existingKeys.has(key)) return false;
            existingKeys.add(key);
            return true;
        });
        if (photos.length + additions.length > 3 || selected.some(f => f.size === 0 || f.size > 5 * 1024 * 1024 || !['image/png','image/jpeg','image/webp'].includes(f.type))) {
            setError('Selecciona hasta 3 fotos JPG, PNG o WebP de 5 MB cada una.');
            return;
        }
        setError('');
        setPhotos(previous => [...previous, ...additions]);
    };
    return (
        <Modal open onClose={() => { if (!mutation.isPending) onClose(); }} title="Repetir trabajo" icon="bi-arrow-repeat"
            subtitle={`${order.codigo} permanece enviado. El nuevo pedido empieza en diseño.`} className="order-repeat-modal">
            <form onSubmit={submit}>
                <fieldset disabled={mutation.isPending} className="order-repeat-fields">
                    <legend className="form-label">Tipo de repetición</legend>
                    <div className="order-repeat-options">
                        <label className={kind === 'warranty' ? 'is-selected' : ''}>
                            <input type="radio" name="repeat-kind" checked={kind === 'warranty'} onChange={() => setKind('warranty')} />
                            <span><strong>Garantía</strong><small>AFINIX asume el trabajo. Sin nuevo cobro.</small></span>
                        </label>
                        <label className={kind === 'paid' ? 'is-selected' : ''}>
                            <input type="radio" name="repeat-kind" checked={kind === 'paid'} onChange={() => setKind('paid')} />
                            <span><strong>Con cobro</strong><small>Nuevo pedido al precio actual del catálogo.</small></span>
                        </label>
                    </div>
                    <div className="form-group">
                        <label htmlFor="repeat-reason" className="form-label">Motivo de la repetición *</label>
                        <textarea id="repeat-reason" className="form-textarea" required maxLength={1000} rows={3}
                            placeholder="Ej.: repetir por ajuste de color; nuevo tono A2." value={reason} onChange={e => setReason(e.target.value)} />
                    </div>
                    <div className="form-group order-repeat-photo-picker" role="group" aria-labelledby="repeat-photos-label">
                        <div className="order-repeat-photo-heading">
                            <span id="repeat-photos-label" className="form-label">Fotos <span className="order-repeat-photo-optional">(opcionales)</span></span>
                            <small className="order-repeat-photo-count" role="status">{photos.length} de 3 fotos</small>
                        </div>
                        <div className="order-repeat-upload-zone">
                            <span className="order-repeat-upload-icon" aria-hidden="true">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4m-4 4 4-4 4 4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></svg>
                            </span>
                            <div className="order-repeat-upload-copy">
                                <strong>{photos.length ? 'Añade otra foto del caso' : 'Adjunta fotos del caso'}</strong>
                                <small id="repeat-photos-help">JPG, PNG o WebP · Hasta 5 MB por foto.</small>
                            </div>
                            <button type="button" className="btn btn-secondary order-repeat-upload-button" onClick={() => photoInput.current?.click()} disabled={photos.length >= 3} aria-describedby="repeat-photos-help">
                                {photos.length >= 3 ? 'Límite de 3 fotos' : 'Elegir fotos'}
                            </button>
                            <input ref={photoInput} id="repeat-photos" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={selectPhotos} hidden aria-label="Elegir fotos del caso" />
                        </div>
                        {photos.length > 0 && <ul className="order-repeat-photo-list">
                            {photos.map(file => <RepeatPhotoPreview key={photoKey(file)} file={file} onRemove={() => {
                                setPhotos(previous => previous.filter(photo => photo !== file));
                                setError('');
                            }} />)}
                        </ul>}
                        <small className="order-repeat-photo-privacy">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                            Solo el equipo interno puede descargarlas.
                        </small>
                    </div>
                    <div className="order-repeat-summary" aria-live="polite">
                        {loadingQuote ? 'Consultando precio y plazo…' : quote ? <>
                            <strong>Nuevo cobro: S/ {Number(kind === 'warranty' ? 0 : quote.total).toFixed(2)}</strong>
                            <span>{quote.productName} · Entrega estimada: {quote.deliveryDate}</span>
                            <small>Se conserva paciente, producto, piezas y tono. Detalla las correcciones en el motivo.</small>
                        </> : null}
                    </div>
                    {kind === 'paid' && <label className="order-repeat-agreement">
                        <input type="checkbox" checked={chargeAgreed} onChange={e => setChargeAgreed(e.target.checked)} required />
                        <span>El nuevo cobro fue acordado con la clínica.</span>
                    </label>}
                </fieldset>
                {(error || quoteError) && <p role="alert" className="order-repeat-error">{error || quoteError.message}</p>}
                {quoteError && <button type="button" className="btn btn-secondary" onClick={() => refetch()}>Reintentar consulta</button>}
                <div className="order-repeat-footer">
                    <button type="button" className="btn btn-secondary" disabled={mutation.isPending} onClick={onClose}>Cancelar</button>
                    <button type="submit" className="btn btn-primary" disabled={mutation.isPending || !quote || loadingQuote || !!quoteError || !reason.trim() || (kind === 'paid' && !chargeAgreed)}>
                        {mutation.isPending ? 'Creando…' : 'Crear nuevo pedido'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default OrderRepeatModal;
