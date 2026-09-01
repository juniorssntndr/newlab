import React, { useState } from 'react';
import CrmNavigation from '../components/CrmNavigation.jsx';
import CommercialHealthBadge from '../components/CommercialHealthBadge.jsx';
import EstablishmentDrawer from '../components/EstablishmentDrawer.jsx';
import VisitModal from '../components/VisitModal.jsx';
import ComplaintModal from '../components/ComplaintModal.jsx';
import { useCrmEstablecimientosQuery } from '../queries/useCrmQueries.js';
import '../styles/crm.css';

export const CrmClinicasPage = () => {
    const [search, setSearch] = useState('');
    const [saludFilter, setSaludFilter] = useState('');
    const [activeDrawerId, setActiveDrawerId] = useState(null);
    const [visitModalTarget, setVisitModalTarget] = useState(null);
    const [complaintModalTarget, setComplaintModalTarget] = useState(null);

    const { data, isLoading, refetch } = useCrmEstablecimientosQuery({
        tipo: 'clinica',
        etapa: 'convertido',
        salud: saludFilter || undefined,
        search: search || undefined,
        limit: 200,
    });

    const clinics = data?.rows || [];

    return (
        <div>
            <CrmNavigation
                title="Cartera de Clínicas y Consultorios"
                subtitle="Monitoreo de retención comercial, cadencia de visitas y alertas por inactividad"
                actions={
                    <button type="button" className="crm-btn crm-btn-secondary" onClick={() => refetch()}>
                        <i className="bi bi-arrow-clockwise"></i> Actualizar
                    </button>
                }
            />

            <div className="crm-container">
                {/* Filter Bar */}
                <div className="crm-filter-bar">
                    <div className="crm-search-input-wrap">
                        <i className="bi bi-search"></i>
                        <input
                            type="text"
                            className="crm-search-input"
                            placeholder="Buscar clínica por nombre, dirección o teléfono..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <select
                        className="crm-select"
                        value={saludFilter}
                        onChange={(e) => setSaludFilter(e.target.value)}
                    >
                        <option value="">Todas las alertas de salud</option>
                        <option value="verde">Solo Verdes (0–29 días)</option>
                        <option value="amarillo">Solo Amarillos (30–59 días)</option>
                        <option value="rojo">Solo Rojos / Críticos (60+ días)</option>
                    </select>
                </div>

                {/* Clinics Table */}
                <div className="crm-table-container">
                    {isLoading ? (
                        <div style={{ textAlign: 'center', padding: '3rem' }}>
                            <div className="spinner-border text-primary" role="status"></div>
                            <p style={{ color: '#64748b', marginTop: '0.5rem' }}>Cargando cartera de clínicas...</p>
                        </div>
                    ) : clinics.length === 0 ? (
                        <div className="crm-empty-state">
                            <i className="bi bi-building"></i>
                            <h3>No se encontraron clínicas</h3>
                            <p>Prueba ajustando los filtros de búsqueda o convierte prospectos existentes.</p>
                        </div>
                    ) : (
                        <table className="crm-table">
                            <thead>
                                <tr>
                                    <th>Clínica / Consultorio</th>
                                    <th>Salud Comercial y Causa</th>
                                    <th>Contacto Directo</th>
                                    <th>Responsable</th>
                                    <th>Última Visita</th>
                                    <th>Próxima Visita</th>
                                    <th style={{ textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clinics.map((c) => (
                                    <tr key={c.id}>
                                        <td>
                                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{c.nombre}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                {c.direccion || 'Sin dirección registrada'}
                                            </div>
                                        </td>
                                        <td>
                                            <CommercialHealthBadge
                                                salud={c.salud_comercial}
                                                etapa={c.etapa}
                                                tieneReclamoAbierto={c.tiene_reclamo_abierto}
                                                diasSinPedido={c.dias_sin_pedido}
                                                causa={c.causa_salud}
                                                showCause={true}
                                            />
                                        </td>
                                        <td>
                                            {c.telefono ? (
                                                <a
                                                    href={`tel:${c.telefono}`}
                                                    style={{ color: 'var(--color-primary, #3b82f6)', textDecoration: 'none', fontWeight: 600 }}
                                                >
                                                    <i className="bi bi-telephone-fill" style={{ marginRight: '0.25rem' }}></i>
                                                    {c.telefono}
                                                </a>
                                            ) : (
                                                <span style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>Sin teléfono</span>
                                            )}
                                        </td>
                                        <td style={{ fontSize: '0.8125rem', color: '#475569' }}>
                                            {c.responsable_nombre || <span style={{ color: '#94a3b8' }}>Sin asignar</span>}
                                        </td>
                                        <td style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                                            {c.ultima_visita_at ? new Date(c.ultima_visita_at).toLocaleDateString() : 'Nunca'}
                                        </td>
                                        <td style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-primary, #3b82f6)' }}>
                                            {c.proxima_visita_at
                                                ? new Date(c.proxima_visita_at).toLocaleDateString()
                                                : c.proxima_visita_sugerida
                                                ? `${new Date(c.proxima_visita_sugerida).toLocaleDateString()} (Sugerida)`
                                                : '—'}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                                                <button
                                                    type="button"
                                                    className="crm-btn crm-btn-secondary crm-btn-sm"
                                                    onClick={() => setVisitModalTarget(c)}
                                                    title="Programar visita"
                                                >
                                                    <i className="bi bi-calendar-plus"></i> Visita
                                                </button>
                                                <button
                                                    type="button"
                                                    className="crm-btn crm-btn-secondary crm-btn-sm"
                                                    onClick={() => setComplaintModalTarget(c)}
                                                    title="Registrar reclamo"
                                                >
                                                    <i className="bi bi-exclamation-octagon text-danger"></i>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="crm-btn crm-btn-primary crm-btn-sm"
                                                    onClick={() => setActiveDrawerId(c.id)}
                                                    title="Ver ficha completa"
                                                >
                                                    <i className="bi bi-card-text"></i> Ficha
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

            {/* Modals */}
            {activeDrawerId && (
                <EstablishmentDrawer
                    establishmentId={activeDrawerId}
                    onClose={() => setActiveDrawerId(null)}
                    onScheduleVisit={(e) => setVisitModalTarget(e)}
                    onAddComplaint={(e) => setComplaintModalTarget(e)}
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
        </div>
    );
};

export default CrmClinicasPage;
