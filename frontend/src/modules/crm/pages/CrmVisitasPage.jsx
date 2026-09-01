import React, { useState } from 'react';
import CrmNavigation from '../components/CrmNavigation.jsx';
import VisitModal from '../components/VisitModal.jsx';
import EstablishmentDrawer from '../components/EstablishmentDrawer.jsx';
import { useCrmVisitasQuery } from '../queries/useCrmQueries.js';
import '../styles/crm.css';

export const CrmVisitasPage = () => {
    const [tab, setTab] = useState('pendientes'); // 'pendientes', 'hoy', 'vencidas', 'todas'
    const [activeVisitModal, setActiveVisitModal] = useState(null); // { visit, establishment }
    const [drawerId, setDrawerId] = useState(null);

    const { data: visitas = [], isLoading, refetch } = useCrmVisitasQuery({ limit: 150 });

    const nowLima = new Date();
    const todayStr = nowLima.toISOString().slice(0, 10);

    const filteredVisits = visitas.filter((v) => {
        const isScheduled = v.estado === 'programada' || v.estado === 'reprogramada';
        const visitDateStr = v.programada_para ? new Date(v.programada_para).toISOString().slice(0, 10) : '';

        if (tab === 'vencidas') {
            return isScheduled && visitDateStr && visitDateStr < todayStr;
        }
        if (tab === 'hoy') {
            return isScheduled && visitDateStr === todayStr;
        }
        if (tab === 'pendientes') {
            return isScheduled;
        }
        return true;
    });

    return (
        <div>
            <CrmNavigation
                title="Agenda de Visitas Comerciales"
                subtitle="Seguimiento de visitas territoriales, check-in GPS y registro de resultados"
                actions={
                    <button type="button" className="crm-btn crm-btn-secondary" onClick={() => refetch()}>
                        <i className="bi bi-arrow-clockwise"></i> Actualizar
                    </button>
                }
            />

            <div className="crm-container">
                {/* Agenda Status Filters */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto' }}>
                    {[
                        { id: 'pendientes', label: 'Todas las Pendientes', icon: 'bi-calendar-event' },
                        { id: 'hoy', label: 'Para Hoy', icon: 'bi-clock' },
                        { id: 'vencidas', label: 'Vencidas', icon: 'bi-exclamation-circle' },
                        { id: 'todas', label: 'Historial Completo', icon: 'bi-archive' },
                    ].map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            className={`crm-btn ${tab === t.id ? 'crm-btn-primary' : 'crm-btn-secondary'}`}
                            onClick={() => setTab(t.id)}
                        >
                            <i className={`bi ${t.icon}`}></i> {t.label}
                        </button>
                    ))}
                </div>

                <div className="crm-table-container">
                    {isLoading ? (
                        <div style={{ textAlign: 'center', padding: '3rem' }}>
                            <div className="spinner-border text-primary" role="status"></div>
                            <p style={{ color: '#64748b', marginTop: '0.5rem' }}>Cargando agenda de visitas...</p>
                        </div>
                    ) : filteredVisits.length === 0 ? (
                        <div className="crm-empty-state">
                            <i className="bi bi-calendar-check"></i>
                            <h3>No hay visitas en esta selección</h3>
                            <p>Programa visitas desde el listado de clínicas, prospectos o el mapa territorial.</p>
                        </div>
                    ) : (
                        <table className="crm-table">
                            <thead>
                                <tr>
                                    <th>Fecha y Hora</th>
                                    <th>Establecimiento</th>
                                    <th>Propósito / Notas</th>
                                    <th>Estado</th>
                                    <th>Responsable</th>
                                    <th>Check-in GPS</th>
                                    <th style={{ textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredVisits.map((v) => {
                                    const isPast =
                                        (v.estado === 'programada' || v.estado === 'reprogramada') &&
                                        v.programada_para &&
                                        new Date(v.programada_para).toISOString().slice(0, 10) < todayStr;

                                    return (
                                        <tr key={v.id} style={{ background: isPast ? '#fff5f5' : '' }}>
                                            <td>
                                                <div style={{ fontWeight: 600, color: isPast ? '#dc2626' : '#0f172a' }}>
                                                    {v.programada_para
                                                        ? new Date(v.programada_para).toLocaleString(undefined, {
                                                              dateStyle: 'short',
                                                              timeStyle: 'short',
                                                          })
                                                        : 'Sin fecha'}
                                                </div>
                                                {isPast && (
                                                    <span className="crm-badge salud-rojo" style={{ marginTop: '0.25rem' }}>
                                                        Vencida
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <div
                                                    style={{ fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}
                                                    onClick={() => setDrawerId(v.establecimiento_id)}
                                                >
                                                    {v.establecimiento_nombre}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                    {v.establecimiento_direccion || 'Sin dirección'}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: '0.875rem', color: '#1e293b' }}>
                                                    {v.proposito || 'Visita comercial'}
                                                </div>
                                                {v.resultado && (
                                                    <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '0.125rem' }}>
                                                        ✓ Resultado: {v.resultado}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <span
                                                    className="crm-badge"
                                                    style={{
                                                        background:
                                                            v.estado === 'completada'
                                                                ? '#ecfdf5'
                                                                : v.estado === 'en_curso'
                                                                ? '#eff6ff'
                                                                : '#f1f5f9',
                                                        color:
                                                            v.estado === 'completada'
                                                                ? '#065f46'
                                                                : v.estado === 'en_curso'
                                                                ? '#1d4ed8'
                                                                : '#475569',
                                                        textTransform: 'capitalize',
                                                    }}
                                                >
                                                    {v.estado.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '0.8125rem', color: '#475569' }}>
                                                {v.responsable_nombre || '—'}
                                            </td>
                                            <td>
                                                {v.checkin_latitud && v.checkin_longitud ? (
                                                    <span className="crm-badge salud-verde" title={`GPS: ${v.checkin_latitud}, ${v.checkin_longitud}`}>
                                                        <i className="bi bi-geo-alt-fill"></i> Registrado
                                                    </span>
                                                ) : (
                                                    <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Sin GPS</span>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                                                    <button
                                                        type="button"
                                                        className="crm-btn crm-btn-secondary crm-btn-sm"
                                                        onClick={() =>
                                                            setActiveVisitModal({
                                                                visit: v,
                                                                establishment: {
                                                                    id: v.establecimiento_id,
                                                                    nombre: v.establecimiento_nombre,
                                                                    latitud: v.establecimiento_latitud,
                                                                    longitud: v.establecimiento_longitud,
                                                                },
                                                            })
                                                        }
                                                    >
                                                        <i className="bi bi-pencil-square"></i> Gestionar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="crm-btn crm-btn-secondary crm-btn-sm"
                                                        onClick={() => setDrawerId(v.establecimiento_id)}
                                                        title="Ver ficha"
                                                    >
                                                        <i className="bi bi-card-text"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {activeVisitModal && (
                <VisitModal
                    visit={activeVisitModal.visit}
                    establishment={activeVisitModal.establishment}
                    onClose={() => setActiveVisitModal(null)}
                    onSaved={refetch}
                />
            )}

            {drawerId && (
                <EstablishmentDrawer
                    establishmentId={drawerId}
                    onClose={() => setDrawerId(null)}
                />
            )}
        </div>
    );
};

export default CrmVisitasPage;
