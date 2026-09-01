import React, { useState } from 'react';
import CrmNavigation from '../components/CrmNavigation.jsx';
import EstablishmentDrawer from '../components/EstablishmentDrawer.jsx';
import VisitModal from '../components/VisitModal.jsx';
import ComplaintModal from '../components/ComplaintModal.jsx';
import ConversionModal from '../components/ConversionModal.jsx';
import { useCrmSummaryQuery, useCrmAlertasQuery } from '../queries/useCrmQueries.js';
import { Link } from 'react-router-dom';
import '../styles/crm.css';

export const CrmResumenPage = () => {
    const { data: summary, isLoading, refetch } = useCrmSummaryQuery();
    const { data: alertas } = useCrmAlertasQuery();

    const [activeDrawerId, setActiveDrawerId] = useState(null);
    const [visitModalTarget, setVisitModalTarget] = useState(null);
    const [complaintModalTarget, setComplaintModalTarget] = useState(null);
    const [conversionModalTarget, setConversionModalTarget] = useState(null);

    const s = summary?.resumen || {};
    const funnel = summary?.funnel || {};
    const visits = summary?.visitas || {};
    const overdueVisits = alertas?.visits || [];
    const upcomingBirthdays = alertas?.birthdays || [];

    return (
        <div>
            <CrmNavigation
                title="Resumen Comercial"
                subtitle="Indicadores de captación, retención, salud de cartera y agenda territorial"
                actions={
                    <button type="button" className="crm-btn crm-btn-secondary" onClick={() => refetch()}>
                        <i className="bi bi-arrow-clockwise"></i> Actualizar
                    </button>
                }
            />

            <div className="crm-container">
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '3rem' }}>
                        <div className="spinner-border text-primary" role="status"></div>
                        <p style={{ color: '#64748b', marginTop: '0.5rem' }}>Cargando métricas comerciales...</p>
                    </div>
                ) : (
                    <>
                        {/* Commercial Health & Urgent Metrics */}
                        <div className="crm-metrics-grid">
                            <div className="crm-metric-card">
                                <div className="crm-metric-icon verde">
                                    <i className="bi bi-shield-check"></i>
                                </div>
                                <div className="crm-metric-info">
                                    <div className="crm-metric-value">{s.verdes || 0}</div>
                                    <div className="crm-metric-label">Clientes Verdes (0-29d)</div>
                                </div>
                            </div>

                            <div className="crm-metric-card">
                                <div className="crm-metric-icon amarillo">
                                    <i className="bi bi-exclamation-triangle"></i>
                                </div>
                                <div className="crm-metric-info">
                                    <div className="crm-metric-value">{s.amarillos || 0}</div>
                                    <div className="crm-metric-label">En Riesgo (30-59d)</div>
                                </div>
                            </div>

                            <div className="crm-metric-card">
                                <div className="crm-metric-icon rojo">
                                    <i className="bi bi-x-circle"></i>
                                </div>
                                <div className="crm-metric-info">
                                    <div className="crm-metric-value">{s.rojos || 0}</div>
                                    <div className="crm-metric-label">Críticos (60+d)</div>
                                </div>
                            </div>

                            <div className="crm-metric-card">
                                <div className="crm-metric-icon rojo">
                                    <i className="bi bi-bell"></i>
                                </div>
                                <div className="crm-metric-info">
                                    <div className="crm-metric-value">{s.reclamos_abiertos || 0}</div>
                                    <div className="crm-metric-label">Reclamos Abiertos</div>
                                </div>
                            </div>
                        </div>

                        {/* Funnel & Visits Secondary Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                            {/* Funnel */}
                            <div style={{ background: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                                        <i className="bi bi-funnel text-primary" style={{ marginRight: '0.375rem' }}></i>
                                        Embudo Comercial: Prospecto → Cliente
                                    </h3>
                                    <Link to="/crm/prospectos" style={{ fontSize: '0.8125rem', color: 'var(--color-primary, #3b82f6)', textDecoration: 'none', fontWeight: 600 }}>
                                        Ver Bandeja →
                                    </Link>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                                    {[
                                        { key: 'nuevo', label: '1. Nuevos Ingresos', color: '#94a3b8', count: funnel.nuevo || 0 },
                                        { key: 'contactado', label: '2. Contactados', color: '#38bdf8', count: funnel.contactado || 0 },
                                        { key: 'visita_programada', label: '3. Visita Agendada', color: '#818cf8', count: funnel.visita_programada || 0 },
                                        { key: 'visitado', label: '4. Visitados', color: '#f59e0b', count: funnel.visitado || 0 },
                                        { key: 'convertido', label: '5. Convertidos a Cliente', color: '#10b981', count: funnel.convertido || 0 },
                                    ].map((step) => (
                                        <div key={step.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '0.5rem' }}>
                                            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#334155' }}>
                                                {step.label}
                                            </span>
                                            <span style={{ fontSize: '1rem', fontWeight: 700, color: step.color }}>
                                                {step.count}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Agenda & Visits */}
                            <div style={{ background: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                                        <i className="bi bi-calendar-check text-primary" style={{ marginRight: '0.375rem' }}></i>
                                        Agenda de Visitas
                                    </h3>
                                    <Link to="/crm/visitas" style={{ fontSize: '0.8125rem', color: 'var(--color-primary, #3b82f6)', textDecoration: 'none', fontWeight: 600 }}>
                                        Ver Agenda →
                                    </Link>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                                    <div style={{ background: '#fef2f2', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#dc2626' }}>{visits.vencidas || 0}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 600 }}>Visitas Vencidas</div>
                                    </div>
                                    <div style={{ background: '#eff6ff', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2563eb' }}>{visits.hoy || 0}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600 }}>Visitas para Hoy</div>
                                    </div>
                                </div>

                                {/* Overdue / Pending Alerts */}
                                <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#475569', margin: '0 0 0.5rem 0' }}>
                                    Atención Requerida
                                </h4>
                                {overdueVisits.length === 0 ? (
                                    <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: 0 }}>No hay visitas vencidas pendientes.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                        {overdueVisits.slice(0, 4).map((v) => (
                                            <div
                                                key={v.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '0.375rem 0.5rem',
                                                    background: '#fff1f2',
                                                    borderRadius: '0.375rem',
                                                    fontSize: '0.8125rem',
                                                }}
                                            >
                                                <span style={{ fontWeight: 600, color: '#9f1239' }}>{v.establecimiento_nombre}</span>
                                                <button
                                                    type="button"
                                                    className="crm-btn crm-btn-secondary crm-btn-sm"
                                                    onClick={() => setActiveDrawerId(v.establecimiento_id)}
                                                >
                                                    Ficha
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Birthdays section */}
                        {upcomingBirthdays.length > 0 && (
                            <div style={{ background: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', padding: '1.25rem', marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.75rem 0', color: '#0f172a' }}>
                                    <i className="bi bi-cake2 text-primary" style={{ marginRight: '0.375rem' }}></i>
                                    Cumpleaños de Doctores Próximos
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                                    {upcomingBirthdays.map((b) => (
                                        <div key={b.id} style={{ padding: '0.75rem', background: '#faf5ff', border: '1px solid #f3e8ff', borderRadius: '0.5rem' }}>
                                            <div style={{ fontWeight: 600, color: '#6b21a8' }}>{b.nombre_completo}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#7e22ce' }}>{b.establecimiento_nombre}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#9333ea', marginTop: '0.25rem' }}>
                                                🎂 {new Date(b.fecha_nacimiento).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modals & Drawers */}
            {activeDrawerId && (
                <EstablishmentDrawer
                    establishmentId={activeDrawerId}
                    onClose={() => setActiveDrawerId(null)}
                    onScheduleVisit={(e) => setVisitModalTarget(e)}
                    onAddComplaint={(e) => setComplaintModalTarget(e)}
                    onConvert={(e) => setConversionModalTarget(e)}
                />
            )}

            {visitModalTarget && (
                <VisitModal
                    establishment={visitModalTarget}
                    onClose={() => setVisitModalTarget(null)}
                    onSaved={refetch}
                />
            )}

            {complaintModalTarget && (
                <ComplaintModal
                    establishment={complaintModalTarget}
                    onClose={() => setComplaintModalTarget(null)}
                    onSaved={refetch}
                />
            )}

            {conversionModalTarget && (
                <ConversionModal
                    establishment={conversionModalTarget}
                    onClose={() => setConversionModalTarget(null)}
                    onConverted={refetch}
                />
            )}
        </div>
    );
};

export default CrmResumenPage;
