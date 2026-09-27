import React, { useState } from 'react';
import CrmNavigation from '../components/CrmNavigation.jsx';
import CommercialHealthBadge from '../components/CommercialHealthBadge.jsx';
import EstablishmentDrawer from '../components/EstablishmentDrawer.jsx';
import EstablishmentModal from '../components/EstablishmentModal.jsx';
import CrmActionMenu from '../components/CrmActionMenu.jsx';
import VisitModal from '../components/VisitModal.jsx';
import ComplaintModal from '../components/ComplaintModal.jsx';
import CustomSelect from '../../../components/CustomSelect.jsx';
import { useCrmEstablecimientosQuery, useCrmMutations } from '../queries/useCrmQueries.js';
import { useAuth } from '../../../state/AuthContext.jsx';
import { isAdminRole } from '../../../utils/accessControl.js';
import toast from 'react-hot-toast';
import '../styles/crm.css';

export const CrmClinicasPage = () => {
    const { user } = useAuth();
    const isAdmin = isAdminRole(user);
    const { deleteEstablecimiento } = useCrmMutations();

    const [search, setSearch] = useState('');
    const [saludFilter, setSaludFilter] = useState('');
    const [activeDrawerId, setActiveDrawerId] = useState(null);
    const [visitModalTarget, setVisitModalTarget] = useState(null);
    const [complaintModalTarget, setComplaintModalTarget] = useState(null);
    const [editingEstablishment, setEditingEstablishment] = useState(null);

    const { data, isLoading, refetch } = useCrmEstablecimientosQuery({
        tipo: 'clinica',
        etapa: 'convertido',
        salud: saludFilter || undefined,
        search: search || undefined,
        limit: 200,
    });

    const clinics = data?.rows || [];

    const handleDeleteClinic = async (c) => {
        const confirmMsg = `¿Estás seguro de dar de baja la clínica "${c.nombre}"?\n\nEsta acción quitará el establecimiento de la cartera activa.`;
        if (!window.confirm(confirmMsg)) return;
        try {
            await deleteEstablecimiento(c.id);
            toast.success(`Clínica "${c.nombre}" dada de baja exitosamente.`);
            refetch();
        } catch (err) {
            toast.error(err.message || 'Error al dar de baja la clínica');
        }
    };

    return (
        <div className="animate-fade-in page-container">
            <CrmNavigation
                title="Cartera de Clínicas y Consultorios"
                subtitle="Monitoreo de retención comercial, cadencia de visitas y alertas por inactividad"
            />

            <div>
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

                    <div style={{ width: 'auto', minWidth: '240px' }}>
                        <CustomSelect
                            value={saludFilter}
                            onChange={(e) => setSaludFilter(e.target.value)}
                            placeholder="Todas las alertas de salud"
                            options={[
                                { value: '', label: 'Todas las alertas de salud', icon: 'bi-grid' },
                                { value: 'verde', label: 'Solo Verdes (0–29 días)', dotColor: '#22c55e' },
                                { value: 'amarillo', label: 'Solo Amarillos (30–59 días)', dotColor: '#eab308' },
                                { value: 'rojo', label: 'Solo Rojos / Críticos (60+ días)', dotColor: '#ef4444' },
                            ]}
                        />
                    </div>
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
                        <>
                            <div className="crm-table-container desktop-only">
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
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                                                        <button
                                                            type="button"
                                                            className="crm-btn crm-btn-primary crm-btn-sm"
                                                            onClick={() => setActiveDrawerId(c.id)}
                                                            title="Ver ficha integral"
                                                        >
                                                            <i className="bi bi-card-text"></i> Ficha
                                                        </button>
                                                        <CrmActionMenu
                                                            items={[
                                                                {
                                                                    label: 'Programar Visita',
                                                                    icon: 'bi bi-calendar-plus text-primary',
                                                                    onClick: () => setVisitModalTarget(c),
                                                                },
                                                                {
                                                                    label: 'Registrar Reclamo',
                                                                    icon: 'bi bi-exclamation-octagon text-danger',
                                                                    onClick: () => setComplaintModalTarget(c),
                                                                },
                                                                {
                                                                    label: 'Editar Datos de Clínica',
                                                                    icon: 'bi bi-pencil text-secondary',
                                                                    onClick: () => setEditingEstablishment(c),
                                                                    hidden: !isAdmin,
                                                                },
                                                                {
                                                                    divider: true,
                                                                    hidden: !isAdmin,
                                                                },
                                                                {
                                                                    label: 'Dar de Baja Clínica',
                                                                    icon: 'bi bi-trash',
                                                                    danger: true,
                                                                    onClick: () => handleDeleteClinic(c),
                                                                    hidden: !isAdmin,
                                                                },
                                                            ]}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="crm-mobile-cards mobile-only">
                                {clinics.map((c) => (
                                    <div key={c.id} className="crm-mobile-card">
                                        <div className="crm-mobile-card-head">
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div className="crm-mobile-card-title">{c.nombre}</div>
                                                <div className="crm-mobile-card-sub">
                                                    <i className="bi bi-geo-alt" style={{ marginRight: '4px' }}></i>
                                                    {c.direccion || 'Sin dirección registrada'}
                                                </div>
                                            </div>
                                            <div style={{ flexShrink: 0 }}>
                                                <CommercialHealthBadge
                                                    salud={c.salud_comercial}
                                                    etapa={c.etapa}
                                                    tieneReclamoAbierto={c.tiene_reclamo_abierto}
                                                    diasSinPedido={c.dias_sin_pedido}
                                                    causa={c.causa_salud}
                                                    showCause={false}
                                                />
                                            </div>
                                        </div>

                                        <div className="crm-mobile-card-meta">
                                            <div className="crm-mobile-meta-item">
                                                <span className="crm-mobile-meta-label">Teléfono</span>
                                                <span className="crm-mobile-meta-value">
                                                    {c.telefono ? (
                                                        <a href={`tel:${c.telefono}`} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
                                                            <i className="bi bi-telephone-fill" style={{ fontSize: '0.7rem' }}></i> {c.telefono}
                                                        </a>
                                                    ) : '—'}
                                                </span>
                                            </div>
                                            <div className="crm-mobile-meta-item">
                                                <span className="crm-mobile-meta-label">Responsable</span>
                                                <span className="crm-mobile-meta-value">{c.responsable_nombre || 'Sin asignar'}</span>
                                            </div>
                                            <div className="crm-mobile-meta-item">
                                                <span className="crm-mobile-meta-label">Última Visita</span>
                                                <span className="crm-mobile-meta-value">
                                                    {c.ultima_visita_at ? new Date(c.ultima_visita_at).toLocaleDateString() : 'Nunca'}
                                                </span>
                                            </div>
                                            <div className="crm-mobile-meta-item">
                                                <span className="crm-mobile-meta-label">Próxima Visita</span>
                                                <span className="crm-mobile-meta-value" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                                                    {c.proxima_visita_at
                                                        ? new Date(c.proxima_visita_at).toLocaleDateString()
                                                        : c.proxima_visita_sugerida
                                                        ? `${new Date(c.proxima_visita_sugerida).toLocaleDateString()} (Sugerida)`
                                                        : '—'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="crm-mobile-card-actions">
                                            <button
                                                type="button"
                                                className="crm-btn crm-btn-primary crm-btn-sm"
                                                onClick={() => setActiveDrawerId(c.id)}
                                                style={{ flex: 1 }}
                                            >
                                                <i className="bi bi-card-text"></i> Ficha Completa
                                            </button>
                                            <CrmActionMenu
                                                triggerLabel="Acciones"
                                                triggerClassName="crm-btn crm-btn-secondary crm-btn-sm"
                                                triggerIcon="bi bi-three-dots"
                                                items={[
                                                    {
                                                        label: 'Programar Visita',
                                                        icon: 'bi bi-calendar-plus text-primary',
                                                        onClick: () => setVisitModalTarget(c),
                                                    },
                                                    {
                                                        label: 'Registrar Reclamo',
                                                        icon: 'bi bi-exclamation-octagon text-danger',
                                                        onClick: () => setComplaintModalTarget(c),
                                                    },
                                                    {
                                                        label: 'Editar Datos de Clínica',
                                                        icon: 'bi bi-pencil text-secondary',
                                                        onClick: () => setEditingEstablishment(c),
                                                        hidden: !isAdmin,
                                                    },
                                                    {
                                                        divider: true,
                                                        hidden: !isAdmin,
                                                    },
                                                    {
                                                        label: 'Dar de Baja Clínica',
                                                        icon: 'bi bi-trash',
                                                        danger: true,
                                                        onClick: () => handleDeleteClinic(c),
                                                        hidden: !isAdmin,
                                                    },
                                                ]}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
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

            {editingEstablishment && (
                <EstablishmentModal
                    establishment={editingEstablishment}
                    onClose={() => setEditingEstablishment(null)}
                    onSaved={() => {
                        refetch();
                        setEditingEstablishment(null);
                    }}
                />
            )}
        </div>
    );
};

export default CrmClinicasPage;
