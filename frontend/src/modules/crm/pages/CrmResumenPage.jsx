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

    const totalFunnel = (funnel.nuevo || 0) + (funnel.contactado || 0) + (funnel.visita_programada || 0) + (funnel.visitado || 0) + (funnel.convertido || 0);

    return (
        <div className="animate-fade-in page-container">
            <CrmNavigation
                title="Resumen Comercial"
                subtitle="Indicadores de captación, retención, salud de cartera y agenda territorial"
            />

            <div>
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '3rem' }}>
                        <div className="spinner-border text-primary" role="status"></div>
                        <p style={{ color: 'var(--color-text-secondary, #64748b)', marginTop: '0.5rem' }}>Cargando métricas comerciales...</p>
                    </div>
                ) : (
                    <>
                        {/* Panel Maestro: Salud de Cartera y Retención Comercial */}
                        <div className="card dashboard-ops-panel dashboard-stack" style={{ marginBottom: '1.25rem' }}>
                            <div className="card-header dashboard-card-header" style={{ marginBottom: '0.85rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(2, 132, 199, 0.12)', color: 'var(--color-primary, #0284c7)', fontSize: '1rem', flexShrink: 0 }}>
                                        <i className="bi bi-shield-check" aria-hidden="true"></i>
                                    </span>
                                    <div>
                                        <h3 className="card-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Salud de Cartera y Retención Comercial (Hoy)</h3>
                                        <p className="card-subtitle" style={{ margin: 0, fontSize: '0.78rem' }}>Monitoreo preventivo de recurrencia de pedidos y alertas de inactividad de clientes</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid dashboard-kpi-grid-4 dashboard-staggered-grid">
                                {/* Card 1: Clientes Verdes */}
                                <div className="card kpi-card dashboard-kpi-card dashboard-kpi-card--success">
                                    <div className="dashboard-kpi-shell">
                                        <div className="dashboard-kpi-row">
                                            <div className="kpi-icon" aria-hidden="true">
                                                <i className="bi bi-shield-check"></i>
                                            </div>
                                            <div className="dashboard-kpi-heading-group">
                                                <div className="dashboard-kpi-heading">CLIENTES ACTIVOS</div>
                                                <div className="dashboard-kpi-main-value">{s.verdes || 0}</div>
                                                <div className="dashboard-kpi-note">0 a 29 días · Cartera al día</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 2: En Riesgo */}
                                <div className="card kpi-card dashboard-kpi-card dashboard-kpi-card--warning">
                                    <div className="dashboard-kpi-shell">
                                        <div className="dashboard-kpi-row">
                                            <div className="kpi-icon" aria-hidden="true">
                                                <i className="bi bi-exclamation-triangle"></i>
                                            </div>
                                            <div className="dashboard-kpi-heading-group">
                                                <div className="dashboard-kpi-heading">EN RIESGO (30-59D)</div>
                                                <div className="dashboard-kpi-main-value">{s.amarillos || 0}</div>
                                                <div className="dashboard-kpi-note">Requiere visita o seguimiento</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 3: Críticos */}
                                <div className="card kpi-card dashboard-kpi-card dashboard-kpi-card--danger">
                                    <div className="dashboard-kpi-shell">
                                        <div className="dashboard-kpi-row">
                                            <div className="kpi-icon" aria-hidden="true">
                                                <i className="bi bi-x-circle"></i>
                                            </div>
                                            <div className="dashboard-kpi-heading-group">
                                                <div className="dashboard-kpi-heading">CRÍTICOS (+60D)</div>
                                                <div className="dashboard-kpi-main-value">{s.rojos || 0}</div>
                                                <div className="dashboard-kpi-note">Riesgo de pérdida de cartera</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 4: Reclamos Abiertos */}
                                <div className="card kpi-card dashboard-kpi-card dashboard-kpi-card--danger">
                                    <div className="dashboard-kpi-shell">
                                        <div className="dashboard-kpi-row">
                                            <div className="kpi-icon" aria-hidden="true">
                                                <i className="bi bi-bell"></i>
                                            </div>
                                            <div className="dashboard-kpi-heading-group">
                                                <div className="dashboard-kpi-heading">RECLAMOS ABIERTOS</div>
                                                <div className="dashboard-kpi-main-value">{s.reclamos_abiertos || 0}</div>
                                                <div className="dashboard-kpi-note">Incidencias pendientes</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Fila Secundaria: Embudo Comercial y Agenda de Visitas */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                            {/* Embudo Comercial */}
                            <div className="card" style={{ padding: 'var(--space-4)' }}>
                                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(2, 132, 199, 0.12)', color: 'var(--color-primary, #0284c7)', fontSize: '1.05rem', flexShrink: 0 }}>
                                            <i className="bi bi-funnel" aria-hidden="true"></i>
                                        </span>
                                        <div>
                                            <h3 className="card-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Embudo Comercial: Prospecto → Cliente</h3>
                                            <p className="card-subtitle" style={{ margin: 0, fontSize: '0.78rem' }}>Conversión de nuevas clínicas desde captación hasta cliente fidelizado</p>
                                        </div>
                                    </div>
                                    <Link to="/crm/prospectos" className="btn btn-ghost btn-sm" style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8125rem' }}>
                                        Ver Bandeja <i className="bi bi-arrow-right"></i>
                                    </Link>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                                    {[
                                        { key: 'nuevo', label: '1. Nuevos Ingresos', icon: 'bi-inbox', color: '#64748b', count: funnel.nuevo || 0 },
                                        { key: 'contactado', label: '2. Contactados', icon: 'bi-chat-dots', color: '#0284c7', count: funnel.contactado || 0 },
                                        { key: 'visita_programada', label: '3. Visita Agendada', icon: 'bi-calendar-event', color: '#6366f1', count: funnel.visita_programada || 0 },
                                        { key: 'visitado', label: '4. Visitados', icon: 'bi-geo-alt', color: '#d97706', count: funnel.visitado || 0 },
                                        { key: 'convertido', label: '5. Convertidos a Cliente', icon: 'bi-check-circle', color: '#059669', count: funnel.convertido || 0 },
                                    ].map((step) => (
                                        <div
                                            key={step.key}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '0.625rem 0.85rem',
                                                background: 'var(--color-bg-alt, #f8fafc)',
                                                borderRadius: '8px',
                                                border: '1px solid var(--color-border, #e2e8f0)',
                                                transition: 'background 0.15s ease'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ color: step.color, fontSize: '1.05rem', display: 'flex', alignItems: 'center' }}>
                                                    <i className={`bi ${step.icon}`}></i>
                                                </span>
                                                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary, #0f172a)' }}>
                                                    {step.label}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                {totalFunnel > 0 && (
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary, #64748b)', fontWeight: 500 }}>
                                                        {Math.round((step.count / totalFunnel) * 100)}%
                                                    </span>
                                                )}
                                                <span
                                                    style={{
                                                        fontSize: '0.9375rem',
                                                        fontWeight: 800,
                                                        color: step.color,
                                                        fontVariantNumeric: 'tabular-nums',
                                                        background: 'var(--color-surface, #ffffff)',
                                                        padding: '2px 10px',
                                                        borderRadius: '6px',
                                                        border: '1px solid var(--color-border, #e2e8f0)'
                                                    }}
                                                >
                                                    {step.count}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Agenda de Visitas */}
                            <div className="card" style={{ padding: 'var(--space-4)' }}>
                                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', fontSize: '1.05rem', flexShrink: 0 }}>
                                            <i className="bi bi-calendar-check" aria-hidden="true"></i>
                                        </span>
                                        <div>
                                            <h3 className="card-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Agenda de Visitas y Seguimiento</h3>
                                            <p className="card-subtitle" style={{ margin: 0, fontSize: '0.78rem' }}>Compromisos territoriales y visitas presenciales programadas</p>
                                        </div>
                                    </div>
                                    <Link to="/crm/visitas" className="btn btn-ghost btn-sm" style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8125rem' }}>
                                        Ver Agenda <i className="bi bi-arrow-right"></i>
                                    </Link>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                                    <div className="card kpi-card dashboard-kpi-card dashboard-kpi-card--danger" style={{ padding: '12px 14px' }}>
                                        <div className="dashboard-kpi-shell">
                                            <div className="dashboard-kpi-row">
                                                <div className="kpi-icon" aria-hidden="true" style={{ width: '38px', height: '38px', fontSize: '1.2rem' }}>
                                                    <i className="bi bi-clock-history"></i>
                                                </div>
                                                <div className="dashboard-kpi-heading-group">
                                                    <div className="dashboard-kpi-heading" style={{ fontSize: '0.6875rem' }}>VENCIDAS</div>
                                                    <div className="dashboard-kpi-main-value" style={{ fontSize: '1.4rem' }}>{visits.vencidas || 0}</div>
                                                    <div className="dashboard-kpi-note">Requieren reprogramar</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="card kpi-card dashboard-kpi-card dashboard-kpi-card--primary" style={{ padding: '12px 14px' }}>
                                        <div className="dashboard-kpi-shell">
                                            <div className="dashboard-kpi-row">
                                                <div className="kpi-icon" aria-hidden="true" style={{ width: '38px', height: '38px', fontSize: '1.2rem' }}>
                                                    <i className="bi bi-calendar-event"></i>
                                                </div>
                                                <div className="dashboard-kpi-heading-group">
                                                    <div className="dashboard-kpi-heading" style={{ fontSize: '0.6875rem' }}>PARA HOY</div>
                                                    <div className="dashboard-kpi-main-value" style={{ fontSize: '1.4rem' }}>{visits.hoy || 0}</div>
                                                    <div className="dashboard-kpi-note">En agenda de hoy</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Overdue / Pending Alerts */}
                                <div style={{ marginTop: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-secondary, #64748b)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                            Atención Requerida
                                        </h4>
                                        {overdueVisits.length > 0 && (
                                            <span className="badge badge-danger" style={{ fontSize: '0.6875rem' }}>
                                                {overdueVisits.length} pendientes
                                            </span>
                                        )}
                                    </div>

                                    {overdueVisits.length === 0 ? (
                                        <div style={{ padding: '16px', background: 'var(--color-bg-alt, #f8fafc)', borderRadius: '8px', textAlign: 'center', border: '1px dashed var(--color-border, #e2e8f0)' }}>
                                            <i className="bi bi-check-circle" style={{ color: 'var(--color-success, #10b981)', fontSize: '1.3rem' }}></i>
                                            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary, #64748b)', margin: '4px 0 0' }}>No hay visitas vencidas pendientes.</p>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {overdueVisits.slice(0, 4).map((v) => (
                                                <div
                                                    key={v.id}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '0.5rem 0.75rem',
                                                        background: 'rgba(239, 68, 68, 0.06)',
                                                        border: '1px solid rgba(239, 68, 68, 0.2)',
                                                        borderRadius: '8px',
                                                        fontSize: '0.8125rem',
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <i className="bi bi-exclamation-triangle" style={{ color: '#dc2626' }}></i>
                                                        <div>
                                                            <div style={{ fontWeight: 600, color: 'var(--color-text-primary, #0f172a)' }}>{v.establecimiento_nombre}</div>
                                                            <div style={{ fontSize: '0.72rem', color: '#dc2626' }}>
                                                                {v.fecha_visita ? new Date(v.fecha_visita).toLocaleDateString() : 'Fecha no especificada'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="btn btn-secondary btn-sm"
                                                        style={{ fontSize: '0.75rem', padding: '2px 8px', minHeight: '28px' }}
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
                        </div>

                        {/* Cumpleaños de Doctores Próximos */}
                        {upcomingBirthdays.length > 0 && (
                            <div className="card" style={{ padding: 'var(--space-4)', marginBottom: '1.5rem' }}>
                                <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(147, 51, 234, 0.1)', color: '#9333ea', fontSize: '1rem', flexShrink: 0 }}>
                                        <i className="bi bi-cake2" aria-hidden="true"></i>
                                    </span>
                                    <div>
                                        <h3 className="card-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Cumpleaños de Doctores Próximos</h3>
                                        <p className="card-subtitle" style={{ margin: 0, fontSize: '0.78rem' }}>Atenciones y saludos de fidelización médica en los próximos 15 días</p>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                                    {upcomingBirthdays.map((b) => (
                                        <div key={b.id} style={{ padding: '0.85rem 1rem', background: 'rgba(147, 51, 234, 0.04)', border: '1px solid rgba(147, 51, 234, 0.18)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <span style={{ fontSize: '1.5rem' }}>🎂</span>
                                            <div>
                                                <div style={{ fontWeight: 700, color: 'var(--color-text-primary, #0f172a)', fontSize: '0.875rem' }}>{b.nombre_completo}</div>
                                                <div style={{ fontSize: '0.78125rem', color: 'var(--color-text-secondary, #64748b)' }}>{b.establecimiento_nombre}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#9333ea', fontWeight: 600, marginTop: '2px' }}>
                                                    {new Date(b.fecha_nacimiento).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
                                                </div>
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
