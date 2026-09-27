import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useCrmMutations } from '../queries/useCrmQueries.js';
import toast from 'react-hot-toast';

export const ComplaintModal = ({ establishment, onClose, onSaved }) => {
    const { createReclamo, isPending } = useCrmMutations();
    const [motivo, setMotivo] = useState('');
    const [detalle, setDetalle] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!motivo.trim()) {
            toast.error('El motivo del reclamo es obligatorio');
            return;
        }

        try {
            await createReclamo({
                establecimiento_id: establishment.id,
                motivo: motivo.trim(),
                detalle: detalle.trim() || null,
            });
            toast.success('Reclamo registrado. Se elevó la prioridad a atención inmediata.');
            onSaved && onSaved();
            onClose();
        } catch (err) {
            toast.error(err.message || 'Error al registrar reclamo');
        }
    };

    return createPortal(
        <div className="crm-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
            <div className="crm-modal" onClick={(e) => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <div className="crm-modal-header">
                        <div className="crm-modal-header-main">
                            <div className="crm-modal-avatar-badge" style={{ background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }}>
                                <i className="bi bi-exclamation-triangle-fill"></i>
                            </div>
                            <div className="crm-modal-header-text">
                                <div className="crm-modal-kicker" style={{ color: '#dc2626' }}>CALIDAD Y CONTROL CLÍNICO</div>
                                <h2 className="crm-modal-title">Registrar Reclamo u Observación</h2>
                                <p className="crm-modal-subtitle">
                                    {establishment?.nombre || 'Establecimiento'}
                                </p>
                            </div>
                        </div>
                        <button type="button" className="crm-btn crm-btn-secondary crm-btn-icon" onClick={onClose} aria-label="Cerrar">
                            <i className="bi bi-x-lg"></i>
                        </button>
                    </div>

                    <div className="crm-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '0.75rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.8125rem', color: '#991b1b', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <i className="bi bi-info-circle-fill" style={{ marginTop: '2px', flexShrink: 0 }}></i>
                            <span>Un reclamo abierto eleva la prioridad visual del cliente y sugiere una visita técnica de resolución en 7 días.</span>
                        </div>

                        <div className="crm-form-group" style={{ margin: 0 }}>
                            <label className="crm-form-label">Motivo del Reclamo *</label>
                            <div className="form-input-box has-lead">
                                <i className="bi bi-exclamation-octagon input-icon-lead"></i>
                                <input
                                    type="text"
                                    className="crm-form-control"
                                    value={motivo}
                                    onChange={(e) => setMotivo(e.target.value)}
                                    placeholder="Ej. Demora en entrega de trabajo, ajuste de mordida..."
                                    required
                                />
                            </div>
                        </div>

                        <div className="crm-form-group" style={{ margin: 0 }}>
                            <label className="crm-form-label">Detalle o Circunstancias</label>
                            <textarea
                                className="crm-form-control"
                                value={detalle}
                                onChange={(e) => setDetalle(e.target.value)}
                                placeholder="Indica detalles para que el equipo comercial y técnico puedan actuar..."
                                rows={3}
                            ></textarea>
                        </div>
                    </div>

                    <div className="crm-modal-footer">
                        <button type="button" className="crm-btn crm-btn-secondary" onClick={onClose} disabled={isPending}>
                            Cancelar
                        </button>
                        <button type="submit" className="crm-btn crm-btn-danger" disabled={isPending}>
                            {isPending ? 'Guardando...' : 'Registrar Reclamo'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default ComplaintModal;
