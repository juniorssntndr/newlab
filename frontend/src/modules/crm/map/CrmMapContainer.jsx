import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { MarkerClusterer } from '@googlemaps/markerclusterer';

const DEFAULT_CENTER = { lat: -12.046374, lng: -77.042793 }; // Lima, Perú

const getMarkerPinColor = (item) => {
    if (item.etapa !== 'convertido' && !item.salud_comercial) {
        return '#3b82f6'; // Azul prospecto
    }
    if (item.tiene_reclamo_abierto) return '#dc2626'; // Rojo reclamo
    if (item.salud_comercial === 'verde') return '#10b981';
    if (item.salud_comercial === 'amarillo') return '#f59e0b';
    if (item.salud_comercial === 'rojo') return '#ef4444';
    return '#64748b';
};

const createCustomMarkerSvg = (color) => {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42">
            <path fill="${color}" stroke="#ffffff" stroke-width="2" d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 27 15 27s15-16.5 15-27c0-8.284-6.716-15-15-15z"/>
            <circle cx="15" cy="15" r="6" fill="#ffffff"/>
        </svg>
    `)}`;
};

export const CrmMapContainer = ({
    establishments = [],
    selectedEstablishment,
    onSelectEstablishment,
}) => {
    const mapRef = useRef(null);
    const googleMapInstance = useRef(null);
    const clustererRef = useRef(null);
    const markersRef = useRef([]);

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || '';

    const [mapError, setMapError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!apiKey) {
            setMapError('MISSING_API_KEY');
            setIsLoading(false);
            return;
        }

        let isMounted = true;
        const loader = new Loader({
            apiKey,
            version: 'weekly',
            libraries: ['places', 'geometry'],
        });

        loader
            .load()
            .then((google) => {
                if (!isMounted || !mapRef.current) return;

                const map = new google.maps.Map(mapRef.current, {
                    center: DEFAULT_CENTER,
                    zoom: 12,
                    mapId: mapId || undefined,
                    disableDefaultUI: false,
                    zoomControl: true,
                    streetViewControl: false,
                    mapTypeControl: false,
                });

                googleMapInstance.current = map;
                setIsLoading(false);
            })
            .catch((err) => {
                if (isMounted) {
                    setMapError(err.message || 'ERROR_LOADING_MAP');
                    setIsLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [apiKey, mapId]);

    // Update markers and clusterer whenever establishments or map instance changes
    useEffect(() => {
        if (!googleMapInstance.current || !window.google) return;

        // Clear existing markers
        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];
        if (clustererRef.current) {
            clustererRef.current.clearMarkers();
        }

        const validPoints = establishments.filter(
            (e) => e.latitud != null && e.longitud != null && !isNaN(Number(e.latitud)) && !isNaN(Number(e.longitud))
        );

        const newMarkers = validPoints.map((item) => {
            const position = { lat: Number(item.latitud), lng: Number(item.longitud) };
            const pinColor = getMarkerPinColor(item);

            const marker = new window.google.maps.Marker({
                position,
                title: `${item.nombre} (${item.etapa})`,
                icon: {
                    url: createCustomMarkerSvg(pinColor),
                    scaledSize: new window.google.maps.Size(26, 36),
                },
            });

            marker.addListener('click', () => {
                onSelectEstablishment && onSelectEstablishment(item);
                googleMapInstance.current.panTo(position);
            });

            return marker;
        });

        markersRef.current = newMarkers;

        if (newMarkers.length > 0) {
            clustererRef.current = new MarkerClusterer({
                map: googleMapInstance.current,
                markers: newMarkers,
            });
        }
    }, [establishments, onSelectEstablishment]);

    // Center map when selectedEstablishment changes
    useEffect(() => {
        if (
            selectedEstablishment &&
            selectedEstablishment.latitud &&
            selectedEstablishment.longitud &&
            googleMapInstance.current
        ) {
            googleMapInstance.current.panTo({
                lat: Number(selectedEstablishment.latitud),
                lng: Number(selectedEstablishment.longitud),
            });
            googleMapInstance.current.setZoom(15);
        }
    }, [selectedEstablishment]);

    if (mapError === 'MISSING_API_KEY' || mapError) {
        return (
            <div style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', textAlign: 'center' }}>
                <div style={{ maxWidth: '540px', background: '#ffffff', padding: '2rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <i className="bi bi-map text-primary" style={{ fontSize: '3rem' }}></i>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '1rem 0 0.5rem 0', color: '#0f172a' }}>
                        Visualización de Mapa Territorial
                    </h3>
                    <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.25rem' }}>
                        {mapError === 'MISSING_API_KEY'
                            ? 'Para cargar el mapa interactivo de Google Maps con clustering de los ~1,315 establecimientos, configure la variable VITE_GOOGLE_MAPS_API_KEY en su archivo de entorno (.env).'
                            : `No se pudo conectar a la API de Google Maps (${mapError}). Verifique su clave o conexión.`}
                    </p>

                    <div style={{ background: '#f1f5f9', borderRadius: '0.5rem', padding: '0.75rem', textAlign: 'left', fontSize: '0.8125rem', color: '#334155', marginBottom: '1.25rem' }}>
                        <strong>Modo de contingencia activo:</strong> Puede continuar visualizando los puntos con coordenadas en la lista sincronizada y abrir la navegación directa en Google Maps para cada uno.
                    </div>

                    <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                        Establecimientos con coordenadas: <strong>{establishments.filter((e) => e.latitud && e.longitud).length}</strong> de {establishments.length}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {isLoading && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(248, 250, 252, 0.8)', zIndex: 5 }}>
                    <div className="spinner-border text-primary" role="status"></div>
                    <span style={{ marginLeft: '0.75rem', color: '#475569', fontSize: '0.875rem', fontWeight: 500 }}>
                        Cargando Google Maps y clusters...
                    </span>
                </div>
            )}
            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        </div>
    );
};

export default CrmMapContainer;
