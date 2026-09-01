import React, { useState } from 'react';
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

    return (
        <div className="crm-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
            <div className="crm-modal" onClick={(e) => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <div className="crm-modal-header">
                        <div>
                            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: '#dc2626' }}>
                                <i className="bi bi-exclamation-triangle-fill" style={{ marginRight: '0.375rem' }}></i>
                                Registrar Reclamo Comercial
                            </h2>
                            <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '0.125rem 0 0 0' }}>
                                {establishment?.nombre}
                            </p>
                        </div>
                        <button type="button" className="crm-btn crm-btn-secondary crm-btn-icon" onClick={onClose}>
                            <i className="bi bi-x-lg"></i>
                        </button>
                    </div>

                    <div className="crm-modal-body">
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.8125rem', color: '#991b1b' }}>
                            Un reclamo abierto eleva la prioridad visual del cliente y sugiere una visita de resolución en 7 días, conservando la causa real de salud comercial por pedidos.
                        </div>

                        <div className="crm-form-group">
                            <label className="crm-form-label">Motivo del Reclamo *</label>
                            <input
                                type="text"
                                className="crm-form-control"
                                value={motivo}
                                onChange={(e) => setMotivo(e.target.value)}
                                placeholder="Ej. Demora en entrega de trabajo, ajuste de mordida..."
                                required
                            />
                        </div>

                        <div className="crm-form-group">
                            <label className="crm-form-label">Detalle o Circunstancias</label>
                            <textarea
                                className="crm-form-control"
                                value={detalle}
                                onChange={(e) => setDetalle(e.target.value)}
                                placeholder="Indica detalles para que el equipo comercial y técnico puedan actuar..."
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
        </div>
    );
};

export default ComplaintModal;
