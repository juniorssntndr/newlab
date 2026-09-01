import React, { useState } from 'react';
import CrmNavigation from '../components/CrmNavigation.jsx';
import CrmMapContainer from '../map/CrmMapContainer.jsx';
import CrmMapBottomSheet from '../map/CrmMapBottomSheet.jsx';
import EstablishmentDrawer from '../components/EstablishmentDrawer.jsx';
import VisitModal from '../components/VisitModal.jsx';
import ConversionModal from '../components/ConversionModal.jsx';
import { useCrmEstablecimientosQuery } from '../queries/useCrmQueries.js';
import '../styles/crm.css';

export const CrmMapaPage = () => {
    const [selectedEstablishment, setSelectedEstablishment] = useState(null);
    const [activeDrawerId, setActiveDrawerId] = useState(null);
    const [visitModalTarget, setVisitModalTarget] = useState(null);
    const [conversionModalTarget, setConversionModalTarget] = useState(null);
    const [filterEtapa, setFilterEtapa] = useState('');
    const [filterSalud, setFilterSalud] = useState('');
    const [search, setSearch] = useState('');

    const { data, isLoading } = useCrmEstablecimientosQuery({
        etapa: filterEtapa || undefined,
        salud: filterSalud || undefined,
        search: search || undefined,
        limit: 1500, // Load territorial points for clustering
    });

    const establishments = data?.rows || [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <CrmNavigation
                title="Mapa Territorial Comercial"
                subtitle="Georreferenciación de clínicas y prospectos con clustering y semáforo de retención"
                actions={
                    <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                        Puntos georreferenciados: <strong>{establishments.filter((e) => e.latitud && e.longitud).length}</strong>
                    </div>
                }
            />

            <div className="crm-container" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Map Filter Controls */}
                <div className="crm-filter-bar" style={{ marginBottom: '0.75rem' }}>
                    <div className="crm-search-input-wrap">
                        <i className="bi bi-search"></i>
                        <input
                            type="text"
                            className="crm-search-input"
                            placeholder="Buscar en el mapa por nombre o dirección..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

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
                </div>

                {/* Map Layout */}
                <div className="crm-map-layout">
                    <div className="crm-map-canvas">
                        <CrmMapContainer
                            establishments={establishments}
                            selectedEstablishment={selectedEstablishment}
                            onSelectEstablishment={(item) => setSelectedEstablishment(item)}
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
                            />
                        </div>
                    ) : (
                        <div className="crm-map-sidebar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>
                            <div>
                                <i className="bi bi-geo-alt" style={{ fontSize: '2rem', opacity: 0.5 }}></i>
                                <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: '0.5rem 0 0.25rem 0', color: '#334155' }}>
                                    Selecciona un punto en el mapa
                                </h4>
                                <p style={{ fontSize: '0.8125rem', margin: 0 }}>
                                    Haz clic sobre cualquier clínica o prospecto para ver sus datos de contacto, salud y acciones.
                                </p>
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
        </div>
    );
};

export default CrmMapaPage;
