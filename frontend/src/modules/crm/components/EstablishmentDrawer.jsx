import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useCrmEstablecimientoDetailQuery, useCrmMutations, useCrmUsuariosQuery } from '../queries/useCrmQueries.js';
import { useAuth } from '../../../state/AuthContext.jsx';
import { isAdminRole } from '../../../utils/accessControl.js';
import EstablishmentModal from './EstablishmentModal.jsx';
import toast from 'react-hot-toast';

export const EstablishmentDrawer = ({
    establishmentId,
    onClose,
    onScheduleVisit,
    onAddComplaint,
    onConvert
}) => {
    const { user } = useAuth();
    const isAdmin = isAdminRole(user);
    const { data: detail, isLoading, refetch } = useCrmEstablecimientoDetailQuery(establishmentId);
    const { data: usuarios = [] } = useCrmUsuariosQuery();
    const { assignEstablecimiento, deleteEstablecimiento } = useCrmMutations();

    const [isAssigning, setIsAssigning] = useState(false);
    const [selectedResponsible, setSelectedResponsible] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    if (!establishmentId) return null;

    const e = detail?.establecimiento || (detail?.id ? detail : null);
    const doctors = detail?.doctores || e?.doctores || [];
    const visits = detail?.visitas || e?.visitas || [];
    const complaints = detail?.reclamos || e?.reclamos || [];

    const handleAssign = async () => {
        if (!selectedResponsible) return;
        try {
            await assignEstablecimiento({ id: e.id, responsable_id: Number(selectedResponsible) });
            toast.success('Responsable comercial asignado');
            setIsAssigning(false);
            refetch();
        } catch (err) {
            toast.error(err.message || 'Error al asignar');
        }
    };

    const handleDelete = async () => {
        const entityLabel = e?.etapa === 'convertido' ? 'la clínica' : 'el prospecto';
        const confirmMsg = `¿Estás seguro de dar de baja ${entityLabel} "${e?.nombre}"?\n\nEsta acción quitará el establecimiento de la cartera activa.`;
        if (!window.confirm(confirmMsg)) return;

        setIsDeleting(true);
        try {
            await deleteEstablecimiento(e.id);
            toast.success(`"${e?.nombre}" ha sido dado de baja exitosamente.`);
            onClose();
        } catch (err) {
            toast.error(err.message || 'Error al eliminar establecimiento');
        } finally {
            setIsDeleting(false);
        }
    };

    return createPortal(
        <div className="crm-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
            <div className="crm-modal crm-establishment-modal" onClick={(evt) => evt.stopPropagation()}>
                {/* Header */}
                <div className="crm-modal-header">
                    <div className="crm-modal-header-main">
                        <div className="crm-modal-avatar-badge">
                            <i className={`bi ${e?.tipo === 'clinica' ? 'bi-hospital' : 'bi-building'}`}></i>
                        </div>
                        <div className="crm-modal-header-text">
                            <div className="crm-modal-kicker">
                                {e?.tipo || 'Establecimiento'} • {e?.etapa || 'CRM'}
                            </div>
                            <h2 className="crm-modal-title">
                                {e?.nombre || 'Cargando...'}
                            </h2>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        {isAdmin && e && (
                            <>
                                <button
                                    type="button"
                                    className="crm-btn crm-btn-secondary crm-btn-sm"
                                    onClick={() => setIsEditing(true)}
                                    title="Editar datos del establecimiento"
                                >
                                    <i className="bi bi-pencil"></i> Editar
                                </button>
                                <button
                                    type="button"
                                    className="crm-btn crm-btn-danger crm-btn-sm"
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    title="Dar de baja o eliminar establecimiento"
                                    style={{ color: '#ef4444', borderColor: '#fca5a5', background: '#fef2f2' }}
                                >
                                    <i className="bi bi-trash"></i> {isDeleting ? 'Borrando...' : 'Eliminar'}
                                </button>
                            </>
                        )}
                        <button type="button" className="crm-btn crm-btn-secondary crm-btn-icon" onClick={onClose} aria-label="Cerrar ficha">
                            <i className="bi bi-x-lg"></i>
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="crm-modal-body">
                    {isLoading ? (
                        <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                            <div className="spinner-border text-primary" role="status"></div>
                            <p style={{ marginTop: '0.75rem', color: '#64748b', fontSize: '0.875rem' }}>Cargando ficha integral...</p>
                        </div>
                    ) : !e ? (
                        <p style={{ color: '#ef4444', textAlign: 'center', padding: '2rem' }}>No se pudo cargar la información del establecimiento.</p>
                    ) : (
                        <>
                            {/* Contact & Location Section */}
                            <div className="crm-sheet-section">
                                <div className="crm-sheet-section-header">
                                    <h3 className="crm-sheet-section-title">
                                        <i className="bi bi-geo-alt-fill text-primary"></i> Contacto y Ubicación
                                    </h3>
                                </div>
                                <div className="crm-info-grid">
                                    <div className="crm-info-cell">
                                        <div className="crm-info-lead">
                                            <i className="bi bi-telephone-fill"></i>
                                            {e.telefono ? (
                                                <a href={`tel:${e.telefono}`} className="crm-contact-link">
                                                    {e.telefono}
                                                </a>
                                            ) : (
                                                <span style={{ color: '#94a3b8' }}>Sin teléfono</span>
                                            )}
                                        </div>
                                        {e.telefono && (
                                            <a
                                                href={`whatsapp://send?phone=51${e.telefono.replace(/\D/g, '')}`}
                                                className="crm-btn crm-btn-secondary crm-btn-sm crm-btn-icon"
                                                title="Contactar por WhatsApp"
                                            >
                                                <i className="bi bi-whatsapp" style={{ color: '#25D366' }}></i>
                                            </a>
                                        )}
                                    </div>

                                    <div className="crm-info-cell">
                                        <div className="crm-info-lead" style={{ overflow: 'hidden' }}>
                                            <i className="bi bi-envelope-fill"></i>
                                            {e.email ? (
                                                <a href={`mailto:${e.email}`} className="crm-contact-link" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {e.email}
                                                </a>
                                            ) : (
                                                <span style={{ color: '#94a3b8' }}>Sin email</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="crm-info-cell crm-info-cell-full">
                                        <div className="crm-info-lead" style={{ flex: 1, minWidth: 0 }}>
                                            <i className="bi bi-pin-map-fill"></i>
                                            <span style={{ wordBreak: 'break-word', color: '#334155' }}>{e.direccion || 'Sin dirección registrada'}</span>
                                        </div>
                                        {e.latitud && e.longitud ? (
                                            <a
                                                href={`https://www.google.com/maps/dir/?api=1&destination=${e.latitud},${e.longitud}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="crm-btn crm-btn-secondary crm-btn-sm"
                                                style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                                            >
                                                <i className="bi bi-map"></i> Cómo llegar
                                            </a>
                                        ) : (
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((e.nombre || '') + ' ' + (e.direccion || 'Arequipa'))}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="crm-btn crm-btn-secondary crm-btn-sm"
                                                style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                                            >
                                                <i className="bi bi-search"></i> Ver en Maps
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Commercial Responsibility and Next Visit */}
                            <div className="crm-sheet-row-grid">
                                {/* Assigned Commercial Responsible Section */}
                                <div className="crm-sheet-section">
                                    <div className="crm-sheet-section-header">
                                        <h3 className="crm-sheet-section-title">
                                            <i className="bi bi-person-badge-fill text-primary"></i> Responsable Comercial
                                        </h3>
                                        {isAdmin && (
                                            <button
                                                type="button"
                                                className="crm-btn crm-btn-secondary crm-btn-sm"
                                                onClick={() => setIsAssigning(!isAssigning)}
                                            >
                                                {isAssigning ? 'Cancelar' : 'Reasignar'}
                                            </button>
                                        )}
                                    </div>
                                    {isAssigning ? (
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <select
                                                className="crm-form-control crm-form-control-sm"
                                                value={selectedResponsible}
                                                onChange={(e) => setSelectedResponsible(e.target.value)}
                                                style={{ flex: 1 }}
                                            >
                                                <option value="">Seleccionar responsable...</option>
                                                {usuarios
                                                    .filter((u) => u.tipo === 'visitador' || u.tipo === 'admin' || u.tipo === 'tecnico')
                                                    .map((u) => (
                                                        <option key={u.id} value={u.id}>
                                                            {u.nombre} ({u.tipo})
                                                        </option>
                                                    ))}
                                            </select>
                                            <button type="button" className="crm-btn crm-btn-primary crm-btn-sm" onClick={handleAssign}>
                                                Guardar
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="crm-responsible-card">
                                            <div className="crm-responsible-info">
                                                <div className="crm-responsible-avatar" style={{ background: e.responsable_nombre ? '#dcfce7' : '#f1f5f9', color: e.responsable_nombre ? '#15803d' : '#94a3b8' }}>
                                                    <i className={`bi ${e.responsable_nombre ? 'bi-person-check-fill' : 'bi-person-x'}`}></i>
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>
                                                        {e.responsable_nombre || 'Sin responsable asignado'}
                                                    </div>
                                                    {e.responsable_nombre && (
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                            Encargado del seguimiento y visitas
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Next Visit Section */}
                                <div className="crm-sheet-section">
                                    <div className="crm-sheet-section-header">
                                        <h3 className="crm-sheet-section-title">
                                            <i className="bi bi-calendar-event-fill text-primary"></i> Próxima Visita
                                        </h3>
                                        <button
                                            type="button"
                                            className="crm-btn crm-btn-secondary crm-btn-sm"
                                            onClick={() => onScheduleVisit && onScheduleVisit(e)}
                                        >
                                            <i className="bi bi-plus-lg"></i> Agendar
                                        </button>
                                    </div>
                                    <div className="crm-responsible-card">
                                        <div className="crm-responsible-info">
                                            <div
                                                className="crm-responsible-avatar"
                                                style={{
                                                    background: e.proxima_visita_sugerida ? '#eff6ff' : '#f1f5f9',
                                                    color: e.proxima_visita_sugerida ? 'var(--color-primary, #0284c7)' : '#94a3b8'
                                                }}
                                            >
                                                <i className="bi bi-calendar-event"></i>
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>
                                                    {e.proxima_visita_sugerida ? new Date(e.proxima_visita_sugerida).toLocaleDateString() : 'Sin programar'}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                    {e.proxima_visita_sugerida ? 'Fecha acordada de visita' : 'No hay visita futura agendada'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Associated Doctors Section */}
                            <div className="crm-sheet-section">
                                <div className="crm-sheet-section-header">
                                    <h3 className="crm-sheet-section-title">
                                        <i className="bi bi-people-fill text-primary"></i> Doctores Asociados
                                        <span className="crm-count-pill">{doctors.length}</span>
                                    </h3>
                                </div>
                                {doctors.length === 0 ? (
                                    <p className="crm-modal-empty-notice">No hay doctores registrados en este establecimiento.</p>
                                ) : (
                                    <div className="crm-flat-list">
                                        {doctors.map((d) => (
                                            <div key={d.id} className="crm-flat-item">
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        {d.nombre_completo}
                                                        {d.es_principal && (
                                                            <span className="crm-badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.6875rem' }}>
                                                                Principal
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>
                                                        {d.especialidad || 'Especialidad no especificada'}
                                                    </div>
                                                </div>
                                                {d.telefono && (
                                                    <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                                                        <a href={`tel:${d.telefono}`} className="crm-btn crm-btn-secondary crm-btn-sm crm-btn-icon" title={`Llamar a ${d.nombre_completo}`}>
                                                            <i className="bi bi-telephone-fill text-primary"></i>
                                                        </a>
                                                        <a
                                                            href={`whatsapp://send?phone=51${d.telefono.replace(/\D/g, '')}`}
                                                            className="crm-btn crm-btn-secondary crm-btn-sm crm-btn-icon"
                                                            title="Contactar por WhatsApp"
                                                        >
                                                            <i className="bi bi-whatsapp" style={{ color: '#25D366' }}></i>
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Recent Visits Section */}
                            <div className="crm-sheet-section">
                                <div className="crm-sheet-section-header">
                                    <h3 className="crm-sheet-section-title">
                                        <i className="bi bi-calendar-check-fill text-primary"></i> Visitas Recientes
                                        <span className="crm-count-pill">{visits.length}</span>
                                    </h3>
                                    <button
                                        type="button"
                                        className="crm-btn crm-btn-secondary crm-btn-sm"
                                        onClick={() => onScheduleVisit && onScheduleVisit(e)}
                                    >
                                        <i className="bi bi-plus-lg"></i> Programar
                                    </button>
                                </div>
                                {visits.length === 0 ? (
                                    <p className="crm-modal-empty-notice">No hay visitas registradas para este establecimiento.</p>
                                ) : (
                                    <div className="crm-flat-list">
                                        {visits.slice(0, 5).map((v) => (
                                            <div key={v.id} className="crm-flat-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.35rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{v.proposito || 'Visita comercial'}</span>
                                                    <span className="crm-badge" style={{ textTransform: 'capitalize', background: v.estado === 'completada' ? '#dcfce7' : '#eff6ff', color: v.estado === 'completada' ? '#15803d' : '#0284c7', fontSize: '0.6875rem' }}>
                                                        {v.estado}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                    {new Date(v.programada_para || v.created_at).toLocaleString()} • {v.responsable_nombre || 'Visitador'}
                                                </div>
                                                {v.resultado && (
                                                    <div style={{ fontSize: '0.75rem', color: '#334155', background: '#f8fafc', padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                                        <strong>Resultado:</strong> {v.resultado}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Complaints Section */}
                            <div className="crm-sheet-section">
                                <div className="crm-sheet-section-header">
                                    <h3 className="crm-sheet-section-title">
                                        <i className="bi bi-exclamation-triangle-fill text-warning"></i> Reclamos y Observaciones
                                        <span className="crm-count-pill">{complaints.length}</span>
                                    </h3>
                                    <button
                                        type="button"
                                        className="crm-btn crm-btn-secondary crm-btn-sm"
                                        onClick={() => onAddComplaint && onAddComplaint(e)}
                                    >
                                        <i className="bi bi-exclamation-octagon"></i> Reclamo
                                    </button>
                                </div>
                                {complaints.length === 0 ? (
                                    <p className="crm-modal-empty-notice">Sin reclamos registrados.</p>
                                ) : (
                                    <div className="crm-flat-list">
                                        {complaints.map((c) => (
                                            <div
                                                key={c.id}
                                                className="crm-flat-item"
                                                style={{
                                                    borderLeft: c.estado === 'abierto' ? '3px solid #ef4444' : '3px solid #64748b',
                                                    background: c.estado === 'abierto' ? '#fef2f2' : '#ffffff',
                                                    flexDirection: 'column',
                                                    alignItems: 'stretch',
                                                    gap: '0.35rem'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontWeight: 600, color: c.estado === 'abierto' ? '#b91c1c' : '#475569' }}>
                                                        {c.motivo}
                                                    </span>
                                                    <span className="crm-badge" style={{ fontSize: '0.6875rem', textTransform: 'uppercase', background: c.estado === 'abierto' ? '#fee2e2' : '#e2e8f0', color: c.estado === 'abierto' ? '#991b1b' : '#475569' }}>
                                                        {c.estado}
                                                    </span>
                                                </div>
                                                {c.detalle && <p style={{ margin: 0, fontSize: '0.75rem', color: '#334155' }}>{c.detalle}</p>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="crm-modal-footer">
                    <button
                        type="button"
                        className="crm-btn crm-btn-secondary"
                        onClick={onClose}
                    >
                        Cerrar
                    </button>
                    {e?.etapa !== 'convertido' && (
                        <button
                            type="button"
                            className="crm-btn crm-btn-success"
                            onClick={() => onConvert && onConvert(e)}
                        >
                            <i className="bi bi-arrow-repeat"></i> Convertir a Cliente
                        </button>
                    )}
                    <button
                        type="button"
                        className="crm-btn crm-btn-primary"
                        onClick={() => onScheduleVisit && onScheduleVisit(e)}
                    >
                        <i className="bi bi-calendar-plus"></i> Agendar Visita
                    </button>
                </div>
            </div>
            {isEditing && (
                <EstablishmentModal
                    establishment={e}
                    onClose={() => setIsEditing(false)}
                    onSaved={() => {
                        refetch();
                        setIsEditing(false);
                    }}
                />
            )}
        </div>,
        document.body
    );
};

export default EstablishmentDrawer;
