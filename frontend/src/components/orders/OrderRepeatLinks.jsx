import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../state/AuthContext.jsx';
import { API_URL } from '../../config.js';

const OrderRepeatLinks = ({ order, canDownloadEvidence = false, hideReason = false }) => {
    const navigate = useNavigate();
    const { getHeaders } = useAuth();
    const [error, setError] = useState('');
    const [downloading, setDownloading] = useState(false);
    const related = order.relatedOrders || [];
    const photos = canDownloadEvidence ? order.repeatPhotos || [] : [];
    if (!related.length && !order.repeat_kind) return null;
    const download = async (photo) => {
        setDownloading(true);
        setError('');
        let url;
        try {
            const response = await fetch(`${API_URL.replace(/\/$/, '')}/pedidos/${order.id}/repeticion/fotos/${photo.id}`, { headers: getHeaders(), cache: 'no-store' });
            if (!response.ok) throw new Error('No se pudo descargar la foto.');
            url = URL.createObjectURL(await response.blob());
            const link = document.createElement('a');
            link.href = url;
            link.download = `evidencia-${photo.id}.${({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[photo.mime_type]}`;
            link.click();
        } catch (err) { setError(err.message); }
        finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); setDownloading(false); }
    };
    return <div className="timeline-entry">
        <div className="timeline-dot"><i className="bi bi-arrow-repeat" aria-hidden="true" /></div>
        <div className="timeline-content">
            <div className="timeline-title-row">
                <div className="timeline-title">{order.repeat_kind === 'warranty' ? 'Garantía sin nuevo cobro' : order.repeat_kind === 'paid' ? 'Repetición con cobro' : 'Repeticiones de este trabajo'}</div>
            </div>
            {order.repeat_reason && !hideReason && <div className="timeline-detail">{order.repeat_reason}</div>}
            {order.repeat_kind === 'warranty' && <div className="timeline-detail">Valor de referencia: S/ {Number(order.repeat_reference_total).toFixed(2)}. No es deuda ni costo de producción.</div>}
            {related.length > 0 && <div className="timeline-detail pedido-repeat-link-list">{related.map(item => <button key={item.id} type="button" className="btn btn-secondary" onClick={() => navigate(`/pedidos/${item.id}`)}>
                {item.id === order.repeat_source_id ? 'Pedido original' : item.repeat_kind === 'warranty' ? 'Garantía' : 'Repetición con cobro'}: {item.codigo}
                <i className="bi bi-arrow-right" aria-hidden="true" />
            </button>)}</div>}
            {photos.length > 0 && <div className="timeline-detail pedido-repeat-link-list">{photos.map((photo, index) => <button key={photo.id} type="button" className="btn btn-secondary" disabled={downloading} onClick={() => download(photo)}>Descargar foto {index + 1}</button>)}</div>}
            {error && <div role="alert" className="timeline-detail">{error}</div>}
            <div className="timeline-meta"><i className="bi bi-link-45deg" aria-hidden="true" /><span>Relación del pedido</span></div>
        </div>
    </div>;
};

export default OrderRepeatLinks;
