import React, { useState } from 'react';
import { useCrmMutations } from '../queries/useCrmQueries.js';
import toast from 'react-hot-toast';

const calculateCadenceDays = (salud, tieneReclamo) => {
    if (tieneReclamo || salud === 'rojo') return 7;
    if (salud === 'amarillo') return 15;
    return 45;
};

export const VisitModal = ({ visit, establishment, onClose, onSaved }) => {
    const { createVisita, updateVisita, isPending } = useCrmMutations();

    const isEdit = Boolean(visit?.id);

    const defaultCadenceDays = calculateCadenceDays(
        establishment?.salud_comercial,
        establishment?.tiene_reclamo_abierto
    );

    const defaultNextDate = () => {
        const d = new Date();
        d.setDate(d.getDate() + defaultCadenceDays);
        return d.toISOString().slice(0, 10);
    };

    const [form, setForm] = useState({
        proposito: visit?.proposito || 'Visita comercial de seguimiento',
        estado: visit?.estado || 'programada',
        resultado: visit?.resultado || '',
        notas: visit?.notas || '',
        proxima_accion: visit?.proxima_accion || '',
        programada_para: visit?.programada_para
            ? new Date(visit.programada_para).toISOString().slice(0, 16)
            : new Date().toISOString().slice(0, 16),
        proxima_visita_at: visit?.proxima_visita_at
            ? new Date(visit.proxima_visita_at).toISOString().slice(0, 10)
            : defaultNextDate(),
        checkin_latitud: visit?.checkin_latitud || null,
        checkin_longitud: visit?.checkin_longitud || null,
    });

    const [gpsStatus, setGpsStatus] = useState(
        visit?.checkin_latitud ? 'Ubicación registrada' : 'No registrada'
    );
    const [isLocating, setIsLocating] = useState(false);

    const handleGpsCheckin = () => {
        if (!navigator.geolocation) {
            setGpsStatus('Geolocalización no soportada por el navegador');
            return;
        }

        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setIsLocating(false);
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                setForm((prev) => ({
                    ...prev,
                    checkin_latitud: lat,
                    checkin_longitud: lon,
                }));
                setGpsStatus(`GPS capturado (${lat.toFixed(4)}, ${lon.toFixed(4)})`);
                toast.success('Ubicación capturada con éxito');
            },
            (error) => {
                setIsLocating(false);
                setGpsStatus('Permiso de GPS denegado o no disponible (no impide guardar)');
                toast('No se obtuvo GPS, pero puedes completar tu visita normalmente.', {
                    icon: 'ℹ️',
                });
            },
            { timeout: 10000, enableHighAccuracy: true }
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEdit) {
                await updateVisita({
                    id: visit.id,
                    payload: {
                        ...form,
                        checkin_latitud: form.checkin_latitud ? Number(form.checkin_latitud) : null,
                        checkin_longitud: form.checkin_longitud ? Number(form.checkin_longitud) : null,
                    },
                });
                toast.success('Visita actualizada');
            } else {
                await createVisita({
                    establecimiento_id: establishment.id,
                    ...form,
                    checkin_latitud: form.checkin_latitud ? Number(form.checkin_latitud) : null,
                    checkin_longitud: form.checkin_longitud ? Number(form.checkin_longitud) : null,
                });
                toast.success('Visita programada exitosamente');
            }
            onSaved && onSaved();
            onClose();
        } catch (err) {
            toast.error(err.message || 'Error al guardar visita');
        }
    };

    return (
        <div className="crm-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
            <div className="crm-modal" onClick={(e) => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <div className="crm-modal-header">
                        <div>
                            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>
                                {isEdit ? 'Actualizar Visita' : 'Programar Nueva Visita'}
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
                        <div className="crm-form-group">
                            <label className="crm-form-label">Estado de la Visita</label>
                            <select
                                className="crm-form-control"
                                value={form.estado}
                                onChange={(e) => setForm({ ...form, estado: e.target.value })}
                            >
                                <option value="programada">Programada</option>
                                <option value="en_curso">En curso</option>
                                <option value="completada">Completada</option>
                                <option value="sin_contacto">Sin contacto</option>
                                <option value="reprogramada">Reprogramada</option>
                                <option value="cancelada">Cancelada</option>
                            </select>
                        </div>

                        <div className="crm-form-group">
                            <label className="crm-form-label">Fecha y Hora Programada</label>
                            <input
                                type="datetime-local"
                                className="crm-form-control"
                                value={form.programada_para}
                                onChange={(e) => setForm({ ...form, programada_para: e.target.value })}
                                required
                            />
                        </div>

                        <div className="crm-form-group">
                            <label className="crm-form-label">Propósito de la Visita</label>
                            <input
                                type="text"
                                className="crm-form-control"
                                value={form.proposito}
                                onChange={(e) => setForm({ ...form, proposito: e.target.value })}
                                placeholder="Ej. Presentación de catálogo, seguimiento de reclamo..."
                                required
                            />
                        </div>

                        {(form.estado === 'completada' || form.estado === 'sin_contacto' || isEdit) && (
                            <>
                                <div className="crm-form-group">
                                    <label className="crm-form-label">Resultado Obtenido</label>
                                    <input
                                        type="text"
                                        className="crm-form-control"
                                        value={form.resultado}
                                        onChange={(e) => setForm({ ...form, resultado: e.target.value })}
                                        placeholder="Ej. Interesado en zirconio, pide lista de precios..."
                                    />
                                </div>

                                <div className="crm-form-group">
                                    <label className="crm-form-label">Notas Adicionales</label>
                                    <textarea
                                        className="crm-form-control"
                                        value={form.notas}
                                        onChange={(e) => setForm({ ...form, notas: e.target.value })}
                                        placeholder="Detalles sobre doctores contactados, observaciones..."
                                    ></textarea>
                                </div>

                                <div className="crm-form-group">
                                    <label className="crm-form-label">Próxima Acción Acordada</label>
                                    <input
                                        type="text"
                                        className="crm-form-control"
                                        value={form.proxima_accion}
                                        onChange={(e) => setForm({ ...form, proxima_accion: e.target.value })}
                                        placeholder="Ej. Enviar cotización por WhatsApp..."
                                    />
                                </div>
                            </>
                        )}

                        <div className="crm-form-group">
                            <label className="crm-form-label">
                                Próxima Visita (Cadencia sugerida: {defaultCadenceDays} días)
                            </label>
                            <input
                                type="date"
                                className="crm-form-control"
                                value={form.proxima_visita_at}
                                onChange={(e) => setForm({ ...form, proxima_visita_at: e.target.value })}
                            />
                            <div className="crm-form-hint">
                                Rojo / Reclamo: 7 días · Amarillo: 15 días · Verde: 45 días
                            </div>
                        </div>

                        {/* Check-in GPS puntual y opcional */}
                        <div style={{ background: 'var(--color-bg, #f8fafc)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--color-border, #e2e8f0)', marginTop: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>
                                        <i className="bi bi-geo text-primary"></i> Check-in GPS (Opcional)
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{gpsStatus}</div>
                                </div>
                                <button
                                    type="button"
                                    className="crm-btn crm-btn-secondary crm-btn-sm"
                                    onClick={handleGpsCheckin}
                                    disabled={isLocating}
                                >
                                    {isLocating ? 'Obteniendo GPS...' : 'Capturar Ubicación'}
                                </button>
                            </div>
                        </div>

                        {/* External navigation shortcut */}
                        {establishment?.latitud && establishment?.longitud && (
                            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                                <a
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${establishment.latitud},${establishment.longitud}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="crm-btn crm-btn-secondary crm-btn-sm"
                                    style={{ flex: 1 }}
                                >
                                    <i className="bi bi-google"></i> Google Maps
                                </a>
                                <a
                                    href={`https://waze.com/ul?ll=${establishment.latitud},${establishment.longitud}&navigate=yes`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="crm-btn crm-btn-secondary crm-btn-sm"
                                    style={{ flex: 1 }}
                                >
                                    <i className="bi bi-cursor-fill"></i> Waze
                                </a>
                            </div>
                        )}
                    </div>

                    <div className="crm-modal-footer">
                        <button type="button" className="crm-btn crm-btn-secondary" onClick={onClose} disabled={isPending}>
                            Cancelar
                        </button>
                        <button type="submit" className="crm-btn crm-btn-primary" disabled={isPending}>
                            {isPending ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Agendar Visita'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default VisitModal;
