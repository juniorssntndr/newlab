import React, { useState } from 'react';
import CrmNavigation from '../components/CrmNavigation.jsx';
import CrmMapContainer from '../map/CrmMapContainer.jsx';
import CrmMapBottomSheet from '../map/CrmMapBottomSheet.jsx';
import EstablishmentDrawer from '../components/EstablishmentDrawer.jsx';
import VisitModal from '../components/VisitModal.jsx';
import ConversionModal from '../components/ConversionModal.jsx';
import EstablishmentModal from '../components/EstablishmentModal.jsx';
import { useCrmEstablecimientosQuery } from '../queries/useCrmQueries.js';
import '../styles/crm.css';

const AREQUIPA_DISTRITOS = [
    { value: '', label: 'Todos los distritos' },
    { value: 'Cercado', label: 'Cercado (Centro)' },
    { value: 'Bustamante', label: 'J.L. Bustamante y Rivero' },
    { value: 'Yanahuara', label: 'Yanahuara' },
    { value: 'Cayma', label: 'Cayma' },
    { value: 'Paucarpata', label: 'Paucarpata' },
    { value: 'Cerro Colorado', label: 'Cerro Colorado' },
    { value: 'Miraflores', label: 'Miraflores' },
    { value: 'Mariano Melgar', label: 'Mariano Melgar' },
    { value: 'Selva Alegre', label: 'Alto Selva Alegre' },
    { value: 'Socabaya', label: 'Socabaya' },
    { value: 'Hunter', label: 'Jacobo Hunter' },
    { value: 'Sachaca', label: 'Sachaca' },
];

const haversineMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

export const CrmMapaPage = () => {
    const [selectedEstablishment, setSelectedEstablishment] = useState(null);
    const [activeDrawerId, setActiveDrawerId] = useState(null);
    const [visitModalTarget, setVisitModalTarget] = useState(null);
    const [conversionModalTarget, setConversionModalTarget] = useState(null);
    const [filterEtapa, setFilterEtapa] = useState('');
    const [filterSalud, setFilterSalud] = useState('');
    const [filterDistrito, setFilterDistrito] = useState('');
    const [search, setSearch] = useState('');

    // Advanced map controls
    const [cleanStyle, setCleanStyle] = useState(true);
    const [proximityCenter, setProximityCenter] = useState(null); // { lat, lng, name }
    const [proximityRadius, setProximityRadius] = useState(500); // meters
    const [routeStops, setRouteStops] = useState([]); // array of establishments
    const [isNewProspectOpen, setIsNewProspectOpen] = useState(false);
    const [newProspectCoords, setNewProspectCoords] = useState(null);

    const { data, isLoading, refetch } = useCrmEstablecimientosQuery({
        etapa: filterEtapa || undefined,
        salud: filterSalud || undefined,
        search: search || undefined,
        limit: 2500, // Load all territorial points for clustering and routing
    });

    const rawEstablishments = data?.rows || [];

    // Filter by district if selected
    let establishments = rawEstablishments;
    if (filterDistrito) {
        establishments = establishments.filter((e) =>
            (e.direccion || '').toLowerCase().includes(filterDistrito.toLowerCase())
        );
    }

    // Filter by proximity radius if active
    if (proximityCenter) {
        establishments = establishments.filter((e) => {
            if (!e.latitud || !e.longitud) return false;
            const dist = haversineMeters(
                proximityCenter.lat,
                proximityCenter.lng,
                Number(e.latitud),
                Number(e.longitud)
            );
            return dist <= proximityRadius;
        });
    }

    const toggleRouteStop = (establishment) => {
        setRouteStops((prev) => {
            const exists = prev.some((p) => p.id === establishment.id);
            if (exists) {
                return prev.filter((p) => p.id !== establishment.id);
            }
            return [...prev, establishment];
        });
    };

    const handleFindNearby = (establishment) => {
        if (!establishment.latitud || !establishment.longitud) return;
        setProximityCenter({
            lat: Number(establishment.latitud),
            lng: Number(establishment.longitud),
            name: establishment.nombre,
        });
        setProximityRadius(500);
    };

    const clearProximity = () => {
        setProximityCenter(null);
    };

    const openRouteInGoogleMaps = () => {
        const validStops = routeStops.filter((p) => p.latitud && p.longitud);
        if (validStops.length === 0) return;

        if (validStops.length === 1) {
            window.open(
                `https://www.google.com/maps/search/?api=1&query=${validStops[0].latitud},${validStops[0].longitud}`,
                '_blank'
            );
            return;
        }

        const origin = `${validStops[0].latitud},${validStops[0].longitud}`;
        const destination = `${validStops[validStops.length - 1].latitud},${validStops[validStops.length - 1].longitud}`;
        const waypoints = validStops
            .slice(1, -1)
            .map((p) => `${p.latitud},${p.longitud}`)
            .join('|');

        const url = waypoints
            ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`
            : `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;

        window.open(url, '_blank');
    };

    return (
        <div className="animate-fade-in page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 'calc(100vh - 120px)' }}>
            <CrmNavigation
                title="Mapa Territorial Comercial"
                subtitle="Georreferenciación con íconos dentales, ruteo diario, proximidad y zonificación Arequipa"
                actions={
                    <div className="crm-mapa-header-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div className="crm-mapa-counter" style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary, #64748b)', background: 'var(--color-bg, #f8fafc)', border: '1px solid var(--color-border, #e2e8f0)', padding: '0.35rem 0.75rem', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                            Consultorios en mapa: <strong style={{ color: 'var(--color-text-primary, #0f172a)' }}>{establishments.filter((e) => e.latitud && e.longitud).length}</strong>
                        </div>
                        <button
                            type="button"
                            className="btn btn-primary btn-sm crm-mapa-btn-prospecto"
                            onClick={() => {
                                setNewProspectCoords(null);
                                setIsNewProspectOpen(true);
                            }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, whiteSpace: 'nowrap' }}
                        >
                            <i className="bi bi-plus-circle"></i> Nuevo Prospecto
                        </button>
                    </div>
                }
            />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {/* Map Filter Controls */}
                <div className="crm-filter-bar crm-mapa-filter-bar" style={{ marginBottom: '0.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div className="crm-search-input-wrap" style={{ minWidth: '220px', flex: 1 }}>
                        <i className="bi bi-search"></i>
                        <input
                            type="text"
                            className="crm-search-input"
                            placeholder="Buscar en el mapa por nombre o dirección..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="crm-mapa-filter-grid">
                        <select
                            className="crm-select"
                            value={filterDistrito}
                            onChange={(e) => setFilterDistrito(e.target.value)}
                        >
                            {AREQUIPA_DISTRITOS.map((d) => (
                                <option key={d.value} value={d.value}>
                                    {d.label}
                                </option>
                            ))}
                        </select>

                        <select
                            className="crm-select"
                            value={filterEtapa}
                            onChange={(e) => setFilterEtapa(e.target.value)}
                        >
                            <option value="">Todas las etapas</option>
                            <option value="convertido">Solo Clientes Activos</option>
                            <option value="nuevo">Nuevos Prospectos</option>
                            <option value="contactado">Contactados</option>
                            <option value="visita_programada">Visita Agendada</option>
                            <option value="visitado">Visitados</option>
                        </select>

                        <select
                            className="crm-select"
                            value={filterSalud}
                            onChange={(e) => setFilterSalud(e.target.value)}
                        >
                            <option value="">Cualquier salud comercial</option>
                            <option value="verde">Verde (0–29d)</option>
                            <option value="amarillo">Amarillo (30–59d)</option>
                            <option value="rojo">Rojo (60+d / Reclamo)</option>
                        </select>

                        <button
                            type="button"
                            className={`btn btn-sm ${cleanStyle ? 'btn-primary' : 'btn-secondary'} crm-mapa-style-btn`}
                            onClick={() => setCleanStyle((v) => !v)}
                            title="Activar/Desactivar mapa limpio (oculta tiendas y ruido ajeno)"
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
                        >
                            <i className="bi bi-layers"></i> {cleanStyle ? 'Mapa Limpio' : 'Mapa Estándar'}
                        </button>
                    </div>
                </div>

                {/* Proximity active banner */}
                {proximityCenter && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '6px',
                        padding: '0.4rem 0.75rem',
                        fontSize: '0.8125rem',
                        color: '#1e40af',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <i className="bi bi-broadcast-pin text-primary" style={{ fontSize: '1.1rem' }}></i>
                            <span>
                                Radio de proximidad alrededor de <strong>{proximityCenter.name}</strong>:
                            </span>
                            <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                                {[300, 500, 1000, 2000].map((m) => (
                                    <button
                                        key={m}
                                        type="button"
                                        className={`btn btn-sm ${proximityRadius === m ? 'btn-primary' : 'btn-secondary'}`}
                                        style={{ padding: '0.15rem 0.45rem', fontSize: '0.75rem' }}
                                        onClick={() => setProximityRadius(m)}
                                    >
                                        {m >= 1000 ? `${m / 1000}km` : `${m}m`}
                                    </button>
                                ))}
                            </div>
                            <span style={{ marginLeft: '0.5rem', fontWeight: 600 }}>
                                ({establishments.length} consultorios encontrados)
                            </span>
                        </div>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={clearProximity}
                        >
                            <i className="bi bi-x-circle"></i> Quitar radio
                        </button>
                    </div>
                )}

                {/* Map Layout */}
                <div className="crm-map-layout" style={{ position: 'relative', flex: 1 }}>
                    <div className="crm-map-canvas">
                        <CrmMapContainer
                            establishments={establishments}
                            selectedEstablishment={selectedEstablishment}
                            onSelectEstablishment={(item) => setSelectedEstablishment(item)}
                            cleanStyle={cleanStyle}
                            proximityCenter={proximityCenter}
                            proximityRadius={proximityRadius}
                            routePoints={routeStops}
                            onMapClick={(coords) => {
                                setNewProspectCoords(coords);
                                setIsNewProspectOpen(true);
                            }}
                        />
                    </div>

                    {selectedEstablishment ? (
                        <div className="crm-map-sidebar">
                            <CrmMapBottomSheet
                                establishment={selectedEstablishment}
                                onClose={() => setSelectedEstablishment(null)}
                                onViewDetail={(id) => setActiveDrawerId(id)}
                                onScheduleVisit={(item) => setVisitModalTarget(item)}
                                onConvert={(item) => setConversionModalTarget(item)}
                                isInRoute={routeStops.some((s) => s.id === selectedEstablishment.id)}
                                onToggleRoute={toggleRouteStop}
                                onFindNearby={handleFindNearby}
                            />
                        </div>
                    ) : (
                        <>
                            <div className="crm-map-mobile-hint">
                                <i className="bi bi-geo-alt-fill"></i> Toca un consultorio en el mapa
                            </div>
                            <div className="crm-map-sidebar crm-map-sidebar--empty" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>
                                <div>
                                    <i className="bi bi-geo-alt" style={{ fontSize: '2rem', opacity: 0.5 }}></i>
                                    <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: '0.5rem 0 0.25rem 0', color: '#334155' }}>
                                        Selecciona un punto en el mapa
                                    </h4>
                                    <p style={{ fontSize: '0.8125rem', margin: 0 }}>
                                        Haz clic sobre cualquier consultorio dental para ver sus datos, agregarlo a tu ruta de visita o chatear por WhatsApp.
                                    </p>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Floating Route Widget (when route stops > 0) */}
                    {routeStops.length > 0 && (
                        <div
                            style={{
                                position: 'absolute',
                                bottom: '16px',
                                left: '16px',
                                zIndex: 10,
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                                padding: '0.75rem 1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                maxWidth: 'calc(100% - 32px)',
                                flexWrap: 'wrap',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span className="badge" style={{ background: '#0284c7', color: '#ffffff', fontSize: '0.8125rem', padding: '0.35rem 0.6rem', borderRadius: '50px' }}>
                                    {routeStops.length}
                                </span>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>
                                        Ruta Comercial del Día
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                        {routeStops.map((s) => s.nombre).slice(0, 3).join(' → ')}
                                        {routeStops.length > 3 ? ` (+${routeStops.length - 3} más)` : ''}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={openRouteInGoogleMaps}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                                    title="Abre la navegación paso a paso en Google Maps"
                                >
                                    <i className="bi bi-cursor-fill"></i> Iniciar Ruta en Google Maps
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setRouteStops([])}
                                    title="Vaciar paradas seleccionadas"
                                >
                                    Limpiar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals & Drawers */}
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
                />
            )}

            {conversionModalTarget && (
                <ConversionModal
                    establishment={conversionModalTarget}
                    onClose={() => setConversionModalTarget(null)}
                />
            )}

            {isNewProspectOpen && (
                <EstablishmentModal
                    initialCoords={newProspectCoords}
                    onClose={() => {
                        setIsNewProspectOpen(false);
                        setNewProspectCoords(null);
                    }}
                    onCreated={(created) => {
                        refetch();
                        if (created) setSelectedEstablishment(created);
                    }}
                />
            )}
        </div>
    );
};

export default CrmMapaPage;
