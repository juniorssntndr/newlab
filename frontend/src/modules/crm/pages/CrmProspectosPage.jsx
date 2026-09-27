import React, { useState, useRef, useEffect } from 'react';
import CrmNavigation from '../components/CrmNavigation.jsx';
import EstablishmentDrawer from '../components/EstablishmentDrawer.jsx';
import VisitModal from '../components/VisitModal.jsx';
import ConversionModal from '../components/ConversionModal.jsx';
import ImportModal from '../components/ImportModal.jsx';
import EstablishmentModal from '../components/EstablishmentModal.jsx';
import CrmActionMenu from '../components/CrmActionMenu.jsx';
import { useCrmEstablecimientosQuery, useCrmMutations } from '../queries/useCrmQueries.js';
import { useAuth } from '../../../state/AuthContext.jsx';
import { isAdminRole } from '../../../utils/accessControl.js';
import toast from 'react-hot-toast';
import '../styles/crm.css';

const ETAPAS = [
    { value: '', label: 'Todas las etapas', color: 'var(--color-primary)' },
    { value: 'nuevo', label: '1. Nuevo', color: '#0066f5' },
    { value: 'contactado', label: '2. Contactado', color: '#8b5cf6' },
    { value: 'visita_programada', label: '3. Visita Agendada', color: '#f59e0b' },
    { value: 'visitado', label: '4. Visitado', color: '#10b981' },
    { value: 'descartado', label: 'Descartado', color: '#ef4444' },
];

export const CrmProspectosPage = () => {
    const { user } = useAuth();
    const isAdmin = isAdminRole(user);
    const { deleteEstablecimiento } = useCrmMutations();

    const [search, setSearch] = useState('');
    const [etapaFilter, setEtapaFilter] = useState('');
    const [etapaDropdownOpen, setEtapaDropdownOpen] = useState(false);
    const etapaDropdownRef = useRef(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [activeDrawerId, setActiveDrawerId] = useState(null);
    const [visitModalTarget, setVisitModalTarget] = useState(null);
    const [conversionModalTarget, setConversionModalTarget] = useState(null);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isNewProspectOpen, setIsNewProspectOpen] = useState(false);
    const [editingEstablishment, setEditingEstablishment] = useState(null);

    const handleDeleteProspect = async (p) => {
        const confirmMsg = `¿Estás seguro de eliminar el prospecto "${p.nombre}"?\n\nEsta acción quitará el prospecto de la cartera activa.`;
        if (!window.confirm(confirmMsg)) return;
        try {
            await deleteEstablecimiento(p.id);
            toast.success(`Prospecto "${p.nombre}" eliminado exitosamente.`);
            refetch();
        } catch (err) {
            toast.error(err.message || 'Error al eliminar el prospecto');
        }
    };

    useEffect(() => {
        if (!etapaDropdownOpen) return;
        const handleClickOutside = (e) => {
            if (etapaDropdownRef.current && !etapaDropdownRef.current.contains(e.target)) {
                setEtapaDropdownOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setEtapaDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [etapaDropdownOpen]);

    const { data, isLoading, refetch } = useCrmEstablecimientosQuery({
        etapa: etapaFilter || undefined,
        search: search || undefined,
        page,
        limit: pageSize,
    });

    const totalCount = data?.total || 0;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const fromRecord = totalCount > 0 ? (page - 1) * pageSize + 1 : 0;
    const toRecord = Math.min(page * pageSize, totalCount);

    // Filter out already converted if etapa filter is empty, or show matching prospects
    const prospects = (data?.rows || []).filter((e) =>
        etapaFilter ? e.etapa === etapaFilter : e.etapa !== 'convertido'
    );

    return (
        <div className="animate-fade-in page-container">
            <CrmNavigation
                title="Bandeja de Prospectos y Pre-clientes"
                subtitle="Captación territorial, seguimiento en etapas comerciales y conversión a cartera activa"
                actions={
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => setIsNewProspectOpen(true)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                        >
                            <i className="bi bi-plus-circle"></i> Nuevo Prospecto
                        </button>
                        {isAdmin && (
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setIsImportOpen(true)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                            >
                                <i className="bi bi-cloud-upload"></i> Importar CSV
                            </button>
                        )}
                    </div>
                }
            />

            <div>
                <div className="crm-filter-bar">
                    <div className="crm-search-input-wrap">
                        <i className="bi bi-search"></i>
                        <input
                            type="text"
                            className="crm-search-input"
                            placeholder="Buscar prospecto por nombre o dirección..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>

                    <div className="pedidos-custom-select-wrap" ref={etapaDropdownRef}>
                        <button
                            type="button"
                            className={`btn btn-sm pedidos-custom-select-trigger${etapaFilter ? ' is-active' : ''}${etapaDropdownOpen ? ' is-open' : ''}`}
                            onClick={() => setEtapaDropdownOpen((prev) => !prev)}
                            aria-expanded={etapaDropdownOpen}
                            aria-haspopup="listbox"
                        >
                            {etapaFilter ? (
                                <>
                                    <span
                                        className="pedidos-filter-dot"
                                        style={{ backgroundColor: ETAPAS.find(e => e.value === etapaFilter)?.color || 'var(--color-primary)' }}
                                        aria-hidden="true"
                                    />
                                    <span className="pedidos-custom-select-text">
                                        {ETAPAS.find(e => e.value === etapaFilter)?.label || etapaFilter}
                                    </span>
                                    <span
                                        className="pedidos-chip-clear"
                                        role="button"
                                        tabIndex={0}
                                        title="Limpiar filtro de etapa"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEtapaFilter('');
                                            setPage(1);
                                        }}
                                    >
                                        ✕
                                    </span>
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-funnel" aria-hidden="true"></i>
                                    <span className="pedidos-custom-select-text">Todas las etapas</span>
                                    <i className={`bi bi-chevron-down pedidos-custom-select-chevron${etapaDropdownOpen ? ' is-rotated' : ''}`} aria-hidden="true"></i>
                                </>
                            )}
                        </button>

                        {etapaDropdownOpen && (
                            <div className="pedidos-custom-select-menu" role="listbox">
                                <button
                                    type="button"
                                    className={`pedidos-custom-select-item${!etapaFilter ? ' is-selected' : ''}`}
                                    onClick={() => {
                                        setEtapaFilter('');
                                        setPage(1);
                                        setEtapaDropdownOpen(false);
                                    }}
                                    role="option"
                                    aria-selected={!etapaFilter}
                                >
                                    <i className="bi bi-grid text-secondary" style={{ width: 14, textAlign: 'center' }}></i>
                                    <span>Todas las etapas</span>
                                    {!etapaFilter && <i className="bi bi-check2 text-primary" style={{ marginLeft: 'auto', fontWeight: 800 }}></i>}
                                </button>
                                <div className="pedidos-custom-select-divider" />
                                {ETAPAS.filter(e => e.value).map((et) => (
                                    <button
                                        key={et.value}
                                        type="button"
                                        className={`pedidos-custom-select-item${etapaFilter === et.value ? ' is-selected' : ''}`}
                                        onClick={() => {
                                            setEtapaFilter(et.value);
                                            setPage(1);
                                            setEtapaDropdownOpen(false);
                                        }}
                                        role="option"
                                        aria-selected={etapaFilter === et.value}
                                    >
                                        <span
                                            className="pedidos-filter-dot"
                                            style={{ backgroundColor: et.color }}
                                            aria-hidden="true"
                                        />
                                        <span>{et.label}</span>
                                        {etapaFilter === et.value && <i className="bi bi-check2 text-primary" style={{ marginLeft: 'auto', fontWeight: 800 }}></i>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
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
                        <>
                            <div className="crm-table-container desktop-only">
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
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                                                        <button
                                                            type="button"
                                                            className="crm-btn crm-btn-primary crm-btn-sm"
                                                            onClick={() => setActiveDrawerId(p.id)}
                                                            title="Ver ficha integral"
                                                        >
                                                            <i className="bi bi-card-text"></i> Ficha
                                                        </button>
                                                        <CrmActionMenu
                                                            items={[
                                                                {
                                                                    label: 'Visitar',
                                                                    icon: 'bi bi-calendar-plus text-primary',
                                                                    onClick: () => setVisitModalTarget(p),
                                                                },
                                                                {
                                                                    label: 'Convertir a Cliente',
                                                                    icon: 'bi bi-arrow-repeat text-success',
                                                                    onClick: () => setConversionModalTarget(p),
                                                                },
                                                                {
                                                                    label: 'Editar Prospecto',
                                                                    icon: 'bi bi-pencil text-secondary',
                                                                    onClick: () => setEditingEstablishment(p),
                                                                    hidden: !isAdmin,
                                                                },
                                                                {
                                                                    divider: true,
                                                                    hidden: !isAdmin,
                                                                },
                                                                {
                                                                    label: 'Eliminar Prospecto',
                                                                    icon: 'bi bi-trash',
                                                                    danger: true,
                                                                    onClick: () => handleDeleteProspect(p),
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
                                {prospects.map((p) => (
                                    <div key={p.id} className="crm-mobile-card">
                                        <div className="crm-mobile-card-head">
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div className="crm-mobile-card-title">{p.nombre}</div>
                                                <div className="crm-mobile-card-sub" style={{ textTransform: 'capitalize' }}>
                                                    <i className="bi bi-geo-alt" style={{ marginRight: '4px' }}></i>
                                                    {p.direccion || 'Sin dirección registrada'}
                                                </div>
                                            </div>
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
                                                    flexShrink: 0
                                                }}
                                            >
                                                {p.etapa.replace('_', ' ')}
                                            </span>
                                        </div>

                                        <div className="crm-mobile-card-meta">
                                            <div className="crm-mobile-meta-item">
                                                <span className="crm-mobile-meta-label">Contacto</span>
                                                <span className="crm-mobile-meta-value">
                                                    {p.telefono ? (
                                                        <a href={`tel:${p.telefono}`} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
                                                            <i className="bi bi-telephone-fill" style={{ fontSize: '0.7rem' }}></i> {p.telefono}
                                                        </a>
                                                    ) : '—'}
                                                </span>
                                            </div>
                                            <div className="crm-mobile-meta-item">
                                                <span className="crm-mobile-meta-label">Responsable</span>
                                                <span className="crm-mobile-meta-value">{p.responsable_nombre || 'Sin asignar'}</span>
                                            </div>
                                            <div className="crm-mobile-meta-item">
                                                <span className="crm-mobile-meta-label">Tipo</span>
                                                <span className="crm-mobile-meta-value" style={{ textTransform: 'capitalize' }}>{p.tipo || 'Consultorio'}</span>
                                            </div>
                                            <div className="crm-mobile-meta-item">
                                                <span className="crm-mobile-meta-label">Origen</span>
                                                <span className="crm-mobile-meta-value" style={{ textTransform: 'uppercase' }}>{p.origen || 'Manual'}</span>
                                            </div>
                                        </div>

                                        <div className="crm-mobile-card-actions">
                                            <button
                                                type="button"
                                                className="crm-btn crm-btn-primary crm-btn-sm"
                                                onClick={() => setActiveDrawerId(p.id)}
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
                                                        label: 'Visitar',
                                                        icon: 'bi bi-calendar-plus text-primary',
                                                        onClick: () => setVisitModalTarget(p),
                                                    },
                                                    {
                                                        label: 'Convertir a Cliente',
                                                        icon: 'bi bi-arrow-repeat text-success',
                                                        onClick: () => setConversionModalTarget(p),
                                                    },
                                                    {
                                                        label: 'Editar Prospecto',
                                                        icon: 'bi bi-pencil text-secondary',
                                                        onClick: () => setEditingEstablishment(p),
                                                        hidden: !isAdmin,
                                                    },
                                                    {
                                                        divider: true,
                                                        hidden: !isAdmin,
                                                    },
                                                    {
                                                        label: 'Eliminar Prospecto',
                                                        icon: 'bi bi-trash',
                                                        danger: true,
                                                        onClick: () => handleDeleteProspect(p),
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

                {totalCount > 0 && (
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.75rem 1rem',
                            background: '#ffffff',
                            border: '1px solid var(--color-border, #e2e8f0)',
                            borderTop: 'none',
                            borderRadius: '0 0 8px 8px',
                            fontSize: '0.85rem',
                            color: 'var(--color-text-secondary, #64748b)',
                            flexWrap: 'wrap',
                            gap: '0.75rem',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                            <span>Mostrar</span>
                            <select
                                className="crm-select"
                                style={{ width: 'auto', padding: '0.2rem 0.5rem', height: '32px', fontSize: '0.8125rem' }}
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setPage(1);
                                }}
                            >
                                <option value={25}>25 por página</option>
                                <option value={50}>50 por página</option>
                                <option value={100}>100 por página</option>
                            </select>
                            <span>
                                Mostrando <strong>{fromRecord}</strong>–<strong>{toRecord}</strong> de <strong>{totalCount}</strong> prospectos
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                disabled={page <= 1 || isLoading}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                style={{ padding: '0.25rem 0.625rem', height: '32px', fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                                <i className="bi bi-chevron-left"></i> Anterior
                            </button>
                            <span style={{ padding: '0 0.5rem', fontWeight: 600, color: 'var(--color-text-primary, #0f172a)' }}>
                                Página {page} de {totalPages}
                            </span>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                disabled={page >= totalPages || isLoading}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                style={{ padding: '0.25rem 0.625rem', height: '32px', fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                                Siguiente <i className="bi bi-chevron-right"></i>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {activeDrawerId && (
                <EstablishmentDrawer
                    establishmentId={activeDrawerId}
                    onClose={() => setActiveDrawerId(null)}
                    onScheduleVisit={(e) => setVisitModalTarget(e)}
                    onConvert={(e) => {
                        setActiveDrawerId(null);
                        setConversionModalTarget(e);
                    }}
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

            {isNewProspectOpen && (
                <EstablishmentModal
                    onClose={() => setIsNewProspectOpen(false)}
                    onCreated={refetch}
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

export default CrmProspectosPage;
