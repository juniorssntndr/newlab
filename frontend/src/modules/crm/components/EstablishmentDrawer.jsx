import React, { useState } from 'react';
import CommercialHealthBadge from './CommercialHealthBadge.jsx';
import { useCrmEstablecimientoDetailQuery, useCrmMutations, useCrmUsuariosQuery } from '../queries/useCrmQueries.js';
import { useAuth } from '../../../state/AuthContext.jsx';
import { isAdminRole } from '../../../utils/accessControl.js';
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
    const { assignEstablecimiento } = useCrmMutations();

    const [isAssigning, setIsAssigning] = useState(false);
    const [selectedResponsible, setSelectedResponsible] = useState('');

    if (!establishmentId) return null;

    const e = detail?.establecimiento;
    const doctors = detail?.doctores || [];
    const visits = detail?.visitas || [];
    const complaints = detail?.reclamos || [];

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

    return (
        <div className="crm-drawer-overlay" onClick={onClose} role="dialog" aria-modal="true">
            <div className="crm-drawer-content" onClick={(evt) => evt.stopPropagation()}>
                <div className="crm-drawer-header">
                    <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary, #3b82f6)', textTransform: 'uppercase' }}>
                            {e?.tipo || 'Establecimiento'} • {e?.etapa || 'CRM'}
                        </span>
                        <h2 style={{ fontSize: '1.25rem', margin: '0.25rem 0 0 0', color: 'var(--color-text-primary, #0f172a)' }}>
                            {e?.nombre || 'Cargando...'}
                        </h2>
                    </div>
                    <button type="button" className="crm-btn crm-btn-secondary crm-btn-icon" onClick={onClose} aria-label="Cerrar ficha">
                        <i className="bi bi-x-lg"></i>
                    </button>
                </div>

                <div className="crm-drawer-body">
                    {isLoading ? (
                        <div style={{ padding: '2rem', textAlign: 'center' }}>
                            <div className="spinner-border text-primary" role="status"></div>
                            <p style={{ marginTop: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>Cargando ficha integral...</p>
                        </div>
                    ) : !e ? (
                        <p style={{ color: '#ef4444' }}>No se pudo cargar la información del establecimiento.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {/* Health & Status Card */}
                            <div style={{ background: 'var(--color-bg, #f8fafc)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--color-border, #e2e8f0)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Salud Comercial</div>
                                        <CommercialHealthBadge
                                            salud={e.salud_comercial}
                                            etapa={e.etapa}
                                            tieneReclamoAbierto={e.tiene_reclamo_abierto}
                                            diasSinPedido={e.dias_sin_pedido}
                                            causa={e.causa_salud}
                                            showCause={true}
                                        />
                                    </div>
                                    {e.proxima_visita_sugerida && (
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Próxima Visita Sugerida</div>
                                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-primary, #3b82f6)' }}>
                                                {new Date(e.proxima_visita_sugerida).toLocaleDateString()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Contact & Location */}
                            <div>
                                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>Contacto y Ubicación</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                                    {e.telefono && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <i className="bi bi-telephone text-primary"></i>
                                            <a href={`tel:${e.telefono}`} style={{ color: 'var(--color-primary, #3b82f6)', textDecoration: 'none', fontWeight: 600 }}>
                                                {e.telefono}
                                            </a>
                                        </div>
                                    )}
                                    {e.email && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <i className="bi bi-envelope text-primary"></i>
                                            <span>{e.email}</span>
                                        </div>
                                    )}
                                    {e.direccion && (
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                                            <i className="bi bi-geo-alt text-primary" style={{ marginTop: '0.125rem' }}></i>
                                            <span>{e.direccion}</span>
                                        </div>
                                    )}
                                    {e.latitud && e.longitud && (
                                        <div style={{ marginTop: '0.25rem' }}>
                                            <a
                                                href={`https://www.google.com/maps/dir/?api=1&destination=${e.latitud},${e.longitud}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="crm-btn crm-btn-secondary crm-btn-sm"
                                            >
                                                <i className="bi bi-map"></i>
                                                <span>Cómo llegar (Google Maps)</span>
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Assigned Visitador */}
                            <div style={{ borderTop: '1px solid var(--color-border, #e2e8f0)', paddingTop: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#334155', margin: 0 }}>Responsable Asignado</h3>
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
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                        <select
                                            className="crm-select"
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
                                    <p style={{ fontSize: '0.875rem', color: '#475569', margin: 0 }}>
                                        {e.responsable_nombre ? (
                                            <>
                                                <i className="bi bi-person-check" style={{ marginRight: '0.375rem', color: '#10b981' }}></i>
                                                <strong>{e.responsable_nombre}</strong>
                                            </>
                                        ) : (
                                            <span style={{ color: '#94a3b8' }}>Sin responsable asignado</span>
                                        )}
                                    </p>
                                )}
                            </div>

                            {/* Associated Doctors */}
                            {doctors.length > 0 && (
                                <div style={{ borderTop: '1px solid var(--color-border, #e2e8f0)', paddingTop: '1rem' }}>
                                    <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
                                        Doctores Asociados ({doctors.length})
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {doctors.map((d) => (
                                            <div
                                                key={d.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '0.5rem 0.75rem',
                                                    background: 'var(--color-bg, #f8fafc)',
                                                    borderRadius: '0.375rem',
                                                    fontSize: '0.8125rem',
                                                }}
                                            >
                                                <div>
                                                    <div style={{ fontWeight: 600, color: '#1e293b' }}>
                                                        {d.nombre_completo}
                                                        {d.es_principal && (
                                                            <span className="crm-badge" style={{ background: '#e0f2fe', color: '#0369a1', marginLeft: '0.5rem' }}>
                                                                Principal
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ color: '#64748b' }}>
                                                        {d.especialidad || 'Especialidad no especificada'}
                                                    </div>
                                                </div>
                                                {d.telefono && (
                                                    <a href={`tel:${d.telefono}`} className="crm-btn crm-btn-secondary crm-btn-icon" title={`Llamar a ${d.nombre_completo}`}>
                                                        <i className="bi bi-telephone-fill text-primary"></i>
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Recent Visits */}
                            <div style={{ borderTop: '1px solid var(--color-border, #e2e8f0)', paddingTop: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#334155', margin: 0 }}>
                                        Visitas Recientes ({visits.length})
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
                                    <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: 0 }}>No hay visitas registradas.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {visits.slice(0, 5).map((v) => (
                                            <div
                                                key={v.id}
                                                style={{
                                                    padding: '0.5rem 0.75rem',
                                                    border: '1px solid var(--color-border, #e2e8f0)',
                                                    borderRadius: '0.375rem',
                                                    fontSize: '0.8125rem',
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                                                    <span>{v.proposito || 'Visita comercial'}</span>
                                                    <span style={{ textTransform: 'capitalize', color: 'var(--color-primary, #3b82f6)' }}>
                                                        {v.estado}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                                                    {new Date(v.programada_para || v.created_at).toLocaleString()} • {v.responsable_nombre || 'Visitador'}
                                                </div>
                                                {v.resultado && (
                                                    <div style={{ marginTop: '0.25rem', color: '#334155' }}>
                                                        <strong>Resultado:</strong> {v.resultado}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Complaints */}
                            <div style={{ borderTop: '1px solid var(--color-border, #e2e8f0)', paddingTop: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#334155', margin: 0 }}>
                                        Reclamos ({complaints.length})
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
                                    <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: 0 }}>Sin reclamos registrados.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {complaints.map((c) => (
                                            <div
                                                key={c.id}
                                                style={{
                                                    padding: '0.5rem 0.75rem',
                                                    borderRadius: '0.375rem',
                                                    border: c.estado === 'abierto' ? '1px solid #fecaca' : '1px solid #e2e8f0',
                                                    background: c.estado === 'abierto' ? '#fef2f2' : '#f8fafc',
                                                    fontSize: '0.8125rem',
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                                                    <span style={{ color: c.estado === 'abierto' ? '#b91c1c' : '#475569' }}>
                                                        {c.motivo}
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                                        {c.estado}
                                                    </span>
                                                </div>
                                                {c.detalle && <p style={{ margin: '0.25rem 0 0 0', color: '#334155' }}>{c.detalle}</p>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="crm-drawer-footer">
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
        </div>
    );
};

export default EstablishmentDrawer;
