import React, { useState } from 'react';
import CrmNavigation from '../components/CrmNavigation.jsx';
import EstablishmentDrawer from '../components/EstablishmentDrawer.jsx';
import VisitModal from '../components/VisitModal.jsx';
import ConversionModal from '../components/ConversionModal.jsx';
import ImportModal from '../components/ImportModal.jsx';
import { useCrmEstablecimientosQuery } from '../queries/useCrmQueries.js';
import { useAuth } from '../../../state/AuthContext.jsx';
import { isAdminRole } from '../../../utils/accessControl.js';
import '../styles/crm.css';

const ETAPAS = [
    { value: '', label: 'Todas las etapas' },
    { value: 'nuevo', label: '1. Nuevo' },
    { value: 'contactado', label: '2. Contactado' },
    { value: 'visita_programada', label: '3. Visita Agendada' },
    { value: 'visitado', label: '4. Visitado' },
    { value: 'descartado', label: 'Descartado' },
];

export const CrmProspectosPage = () => {
    const { user } = useAuth();
    const isAdmin = isAdminRole(user);

    const [search, setSearch] = useState('');
    const [etapaFilter, setEtapaFilter] = useState('');
    const [activeDrawerId, setActiveDrawerId] = useState(null);
    const [visitModalTarget, setVisitModalTarget] = useState(null);
    const [conversionModalTarget, setConversionModalTarget] = useState(null);
    const [isImportOpen, setIsImportOpen] = useState(false);

    const { data, isLoading, refetch } = useCrmEstablecimientosQuery({
        etapa: etapaFilter || undefined,
        search: search || undefined,
        limit: 250,
    });

    // Filter out already converted if etapa filter is empty, or show matching prospects
    const prospects = (data?.rows || []).filter((e) =>
        etapaFilter ? e.etapa === etapaFilter : e.etapa !== 'convertido'
    );

    return (
        <div>
            <CrmNavigation
                title="Bandeja de Prospectos y Pre-clientes"
                subtitle="Captación territorial, seguimiento en etapas comerciales y conversión a cartera activa"
                actions={
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button type="button" className="crm-btn crm-btn-secondary" onClick={() => refetch()}>
                            <i className="bi bi-arrow-clockwise"></i>
                        </button>
                        {isAdmin && (
                            <button
                                type="button"
                                className="crm-btn crm-btn-primary"
                                onClick={() => setIsImportOpen(true)}
                            >
                                <i className="bi bi-cloud-upload"></i> Importar CSV / Excel
                            </button>
                        )}
                    </div>
                }
            />

            <div className="crm-container">
                <div className="crm-filter-bar">
                    <div className="crm-search-input-wrap">
                        <i className="bi bi-search"></i>
                        <input
                            type="text"
                            className="crm-search-input"
                            placeholder="Buscar prospecto por nombre o dirección..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <select
                        className="crm-select"
                        value={etapaFilter}
                        onChange={(e) => setEtapaFilter(e.target.value)}
                    >
                        {ETAPAS.map((et) => (
                            <option key={et.value} value={et.value}>
                                {et.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="crm-table-container">
                    {isLoading ? (
                        <div style={{ textAlign: 'center', padding: '3rem' }}>
                            <div className="spinner-border text-primary" role="status"></div>
                            <p style={{ color: '#64748b', marginTop: '0.5rem' }}>Cargando bandeja de prospectos...</p>
                        </div>
                    ) : prospects.length === 0 ? (
                        <div className="crm-empty-state">
                            <i className="bi bi-funnel"></i>
                            <h3>No hay prospectos en esta selección</h3>
                            <p>Importa archivos territoriales de Google My Maps/Excel o registra nuevos prospectos.</p>
                            {isAdmin && (
                                <button
                                    type="button"
                                    className="crm-btn crm-btn-primary"
                                    style={{ marginTop: '1rem' }}
                                    onClick={() => setIsImportOpen(true)}
                                >
                                    Importar Archivo
                                </button>
                            )}
                        </div>
                    ) : (
                        <table className="crm-table">
                            <thead>
                                <tr>
                                    <th>Establecimiento</th>
                                    <th>Etapa Comercial</th>
                                    <th>Dirección / Territorio</th>
                                    <th>Contacto</th>
                                    <th>Responsable</th>
                                    <th>Origen</th>
                                    <th style={{ textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {prospects.map((p) => (
                                    <tr key={p.id}>
                                        <td>
                                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{p.nombre}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'capitalize' }}>
                                                {p.tipo || 'Consultorio'}
                                            </div>
                                        </td>
                                        <td>
                                            <span
                                                className="crm-badge"
                                                style={{
                                                    background:
                                                        p.etapa === 'visitado'
                                                            ? '#fef3c7'
                                                            : p.etapa === 'visita_programada'
                                                            ? '#eff6ff'
                                                            : p.etapa === 'contactado'
                                                            ? '#e0f2fe'
                                                            : '#f1f5f9',
                                                    color:
                                                        p.etapa === 'visitado'
                                                            ? '#92400e'
                                                            : p.etapa === 'visita_programada'
                                                            ? '#1d4ed8'
                                                            : p.etapa === 'contactado'
                                                            ? '#0369a1'
                                                            : '#475569',
                                                    textTransform: 'capitalize',
                                                }}
                                            >
                                                {p.etapa.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '0.8125rem', color: '#334155' }}>
                                            {p.direccion || 'Sin dirección'}
                                        </td>
                                        <td>
                                            {p.telefono ? (
                                                <a
                                                    href={`tel:${p.telefono}`}
                                                    style={{ color: 'var(--color-primary, #3b82f6)', textDecoration: 'none', fontWeight: 600 }}
                                                >
                                                    {p.telefono}
                                                </a>
                                            ) : (
                                                <span style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>—</span>
                                            )}
                                        </td>
                                        <td style={{ fontSize: '0.8125rem', color: '#475569' }}>
                                            {p.responsable_nombre || <span style={{ color: '#94a3b8' }}>Sin asignar</span>}
                                        </td>
                                        <td style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>
                                            {p.origen || 'Manual'}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                                                <button
                                                    type="button"
                                                    className="crm-btn crm-btn-secondary crm-btn-sm"
                                                    onClick={() => setVisitModalTarget(p)}
                                                    title="Programar o registrar visita"
                                                >
                                                    <i className="bi bi-calendar-plus"></i> Visitar
                                                </button>
                                                <button
                                                    type="button"
                                                    className="crm-btn crm-btn-success crm-btn-sm"
                                                    onClick={() => setConversionModalTarget(p)}
                                                    title="Convertir a clínica activa"
                                                >
                                                    <i className="bi bi-arrow-repeat"></i> Convertir
                                                </button>
                                                <button
                                                    type="button"
                                                    className="crm-btn crm-btn-primary crm-btn-sm"
                                                    onClick={() => setActiveDrawerId(p.id)}
                                                    title="Ver ficha completa"
                                                >
                                                    <i className="bi bi-card-text"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {activeDrawerId && (
                <EstablishmentDrawer
                    establishmentId={activeDrawerId}
                    onClose={() => setActiveDrawerId(null)}
                    onScheduleVisit={(e) => setVisitModalTarget(e)}
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

            {conversionModalTarget && (
                <ConversionModal
                    establishment={conversionModalTarget}
                    onClose={() => setConversionModalTarget(null)}
                    onConverted={refetch}
                />
            )}

            {isImportOpen && (
                <ImportModal
                    onClose={() => setIsImportOpen(false)}
                    onImportCompleted={refetch}
                />
            )}
        </div>
    );
};

export default CrmProspectosPage;
