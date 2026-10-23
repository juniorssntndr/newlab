import React, { useState, useMemo } from 'react';
import CrmNavigation from '../components/CrmNavigation.jsx';
import VisitModal from '../components/VisitModal.jsx';
import EstablishmentDrawer from '../components/EstablishmentDrawer.jsx';
import { useCrmVisitasQuery } from '../queries/useCrmQueries.js';
import '../styles/crm.css';

const getLimaDateStr = (dateVal) => {
    if (!dateVal) return '';
    try {
        const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
        if (Number.isNaN(d.getTime())) return '';
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(d);
    } catch {
        return '';
    }
};

export const CrmVisitasPage = () => {
    const [tab, setTab] = useState('pendientes'); // 'pendientes', 'hoy', 'vencidas', 'todas'
    const [search, setSearch] = useState('');
    const [activeVisitModal, setActiveVisitModal] = useState(null); // { visit, establishment }
    const [drawerId, setDrawerId] = useState(null);

    const { data: visitas = [], isLoading, refetch } = useCrmVisitasQuery({ limit: 150 });

    const todayStr = getLimaDateStr(new Date());

    const counts = useMemo(() => {
        let pendientes = 0;
        let hoy = 0;
        let vencidas = 0;
        for (const v of visitas) {
            const isScheduled = v.estado === 'programada' || v.estado === 'reprogramada';
            if (!isScheduled) continue;
            pendientes++;
            const d = getLimaDateStr(v.programada_para);
            if (d && d < todayStr) vencidas++;
            if (d && d === todayStr) hoy++;
        }
        return { pendientes, hoy, vencidas, todas: visitas.length };
    }, [visitas, todayStr]);

    const filteredVisits = useMemo(() => {
        return visitas.filter((v) => {
            const isScheduled = v.estado === 'programada' || v.estado === 'reprogramada';
            const visitDateStr = getLimaDateStr(v.programada_para);

            if (tab === 'vencidas') {
                if (!isScheduled || !visitDateStr || visitDateStr >= todayStr) return false;
            } else if (tab === 'hoy') {
                if (!isScheduled || !visitDateStr || visitDateStr !== todayStr) return false;
            } else if (tab === 'pendientes') {
                if (!isScheduled) return false;
            }

            if (search.trim()) {
                const q = search.toLowerCase();
                const est = (v.establecimiento_nombre || '').toLowerCase();
                const prop = (v.proposito || '').toLowerCase();
                const notas = (v.notas || '').toLowerCase();
                const resp = (v.responsable_nombre || '').toLowerCase();
                if (!est.includes(q) && !prop.includes(q) && !notas.includes(q) && !resp.includes(q)) {
                    return false;
                }
            }

            return true;
        });
    }, [visitas, tab, todayStr, search]);

    return (
        <div className="animate-fade-in page-container">
            <CrmNavigation
                title="Agenda de Visitas Comerciales"
                subtitle="Seguimiento de visitas territoriales, check-in GPS y registro de resultados"
            />

            <div>
                {/* Agenda Status & Search Toolbar */}
                <div className="crm-filter-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div className="crm-search-input-wrap" style={{ flex: 1, minWidth: '220px' }}>
                        <i className="bi bi-search"></i>
                        <input
                            type="text"
                            className="crm-search-input"
                            placeholder="Buscar por clínica, notas o responsable..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div
                        className="crm-filter-pills-scroll"
                        role="group"
                        aria-label="Filtrar visitas"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            overflowX: 'auto',
                            WebkitOverflowScrolling: 'touch',
                            scrollbarWidth: 'none',
                            flexWrap: 'nowrap'
                        }}
                    >
                        <button
                            type="button"
                            className={`btn btn-sm pedidos-filter-chip${tab === 'pendientes' ? ' is-active' : ''}`}
                            onClick={() => setTab('pendientes')}
                        >
                            <i className="bi bi-calendar-event" aria-hidden="true"></i>
                            <span>Pendientes</span>
                            {counts.pendientes > 0 && (
                                <span className="crm-filter-count-badge">{counts.pendientes}</span>
                            )}
                        </button>

                        <button
                            type="button"
                            className={`btn btn-sm pedidos-filter-chip crm-filter-chip-hoy pedidos-chip-warning${tab === 'hoy' ? ' is-active' : ''}`}
                            onClick={() => setTab('hoy')}
                        >
                            <i className="bi bi-clock" aria-hidden="true"></i>
                            <span>Hoy</span>
                            {counts.hoy > 0 && (
                                <span className="crm-filter-count-badge crm-filter-badge-warning">{counts.hoy}</span>
                            )}
                        </button>

                        <button
                            type="button"
                            className={`btn btn-sm pedidos-filter-chip pedidos-chip-danger${tab === 'vencidas' ? ' is-active' : ''}`}
                            onClick={() => setTab('vencidas')}
                        >
                            <i className="bi bi-exclamation-circle" aria-hidden="true"></i>
                            <span>Vencidas</span>
                            {counts.vencidas > 0 && (
                                <span className="crm-filter-count-badge crm-filter-badge-danger">{counts.vencidas}</span>
                            )}
                        </button>

                        <button
                            type="button"
                            className={`btn btn-sm pedidos-filter-chip mobile-hide${tab === 'todas' ? ' is-active' : ''}`}
                            onClick={() => setTab('todas')}
                        >
                            <i className="bi bi-archive" aria-hidden="true"></i>
                            <span>Historial</span>
                            {counts.todas > 0 && (
                                <span className="crm-filter-count-badge">{counts.todas}</span>
                            )}
                        </button>
                    </div>
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
                        <>
                            <div className="crm-table-container desktop-only">
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
                            </div>

                            <div className="crm-mobile-cards mobile-only">
                                {filteredVisits.map((v) => {
                                    const isPast =
                                        (v.estado === 'programada' || v.estado === 'reprogramada') &&
                                        v.programada_para &&
                                        new Date(v.programada_para).toISOString().slice(0, 10) < todayStr;

                                    return (
                                        <div
                                            key={v.id}
                                            className="crm-mobile-card"
                                            style={{
                                                borderLeft: isPast
                                                    ? '4px solid #ef4444'
                                                    : (v.estado === 'completada' ? '4px solid #10b981' : undefined)
                                            }}
                                        >
                                            <div className="crm-mobile-card-head">
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div
                                                        className="crm-mobile-card-title"
                                                        style={{ cursor: 'pointer', color: 'var(--color-primary)' }}
                                                        onClick={() => setDrawerId(v.establecimiento_id)}
                                                    >
                                                        {v.establecimiento_nombre}
                                                    </div>
                                                    <div className="crm-mobile-card-sub">
                                                        <i className="bi bi-geo-alt" style={{ marginRight: '4px' }}></i>
                                                        {v.establecimiento_direccion || 'Sin dirección'}
                                                    </div>
                                                </div>
                                                <div style={{ flexShrink: 0 }}>
                                                    <span className={`crm-badge ${v.estado === 'completada' ? 'salud-verde' : (isPast ? 'salud-rojo' : 'salud-amarillo')}`}>
                                                        {isPast ? 'Vencida' : v.estado.replace('_', ' ')}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="crm-mobile-card-meta">
                                                <div className="crm-mobile-meta-item">
                                                    <span className="crm-mobile-meta-label">Fecha y Hora</span>
                                                    <span className="crm-mobile-meta-value" style={{ fontWeight: 600, color: isPast ? '#dc2626' : undefined }}>
                                                        <i className="bi bi-clock" style={{ fontSize: '0.75rem', marginRight: '4px' }}></i>
                                                        {v.programada_para
                                                            ? new Date(v.programada_para).toLocaleString(undefined, {
                                                                  dateStyle: 'short',
                                                                  timeStyle: 'short',
                                                              })
                                                            : 'Sin fecha'}
                                                    </span>
                                                </div>
                                                <div className="crm-mobile-meta-item">
                                                    <span className="crm-mobile-meta-label">Responsable</span>
                                                    <span className="crm-mobile-meta-value">{v.responsable_nombre || 'Sin asignar'}</span>
                                                </div>
                                                <div className="crm-mobile-meta-item" style={{ gridColumn: 'span 2' }}>
                                                    <span className="crm-mobile-meta-label">Propósito / Resultado</span>
                                                    <span className="crm-mobile-meta-value">
                                                        {v.proposito || 'Visita comercial'}
                                                        {v.resultado && (
                                                            <span style={{ display: 'block', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
                                                                ✓ {v.resultado}
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                                {v.checkin_latitud && v.checkin_longitud && (
                                                    <div className="crm-mobile-meta-item" style={{ gridColumn: 'span 2' }}>
                                                        <span className="crm-mobile-meta-label">GPS</span>
                                                        <span className="crm-mobile-meta-value" style={{ color: '#059669' }}>
                                                            <i className="bi bi-geo-alt-fill"></i> Check-in registrado
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="crm-mobile-card-actions">
                                                <button
                                                    type="button"
                                                    className="crm-btn crm-btn-secondary crm-btn-sm"
                                                    onClick={() => setDrawerId(v.establecimiento_id)}
                                                >
                                                    <i className="bi bi-card-text"></i> Ficha
                                                </button>
                                                <button
                                                    type="button"
                                                    className="crm-btn crm-btn-primary crm-btn-sm"
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
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
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
