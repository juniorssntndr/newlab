import React, { useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { MarkerClusterer } from '@googlemaps/markerclusterer';

const DEFAULT_CENTER = { lat: -16.409047, lng: -71.537451 }; // Arequipa, Perú
const STORAGE_KEY_VIEWPORT = 'afinix_crm_map_viewport';

const getSavedViewport = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY_VIEWPORT);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (
                typeof parsed.lat === 'number' &&
                typeof parsed.lng === 'number' &&
                typeof parsed.zoom === 'number' &&
                parsed.lat <= -15.5 &&
                parsed.lat >= -17.5 &&
                parsed.lng <= -70.5 &&
                parsed.lng >= -72.5
            ) {
                return { center: { lat: parsed.lat, lng: parsed.lng }, zoom: parsed.zoom };
            }
        }
    } catch {
        // Fallback to default
    }
    return null;
};

let loaderConfigured = false;

const CLEAN_MAP_STYLES = [
    {
        featureType: 'poi',
        elementType: 'all',
        stylers: [{ visibility: 'off' }],
    },
    {
        featureType: 'transit',
        elementType: 'all',
        stylers: [{ visibility: 'off' }],
    },
    {
        featureType: 'road',
        elementType: 'labels.icon',
        stylers: [{ visibility: 'off' }],
    },
    {
        featureType: 'landscape.man_made',
        elementType: 'geometry',
        stylers: [{ color: '#f8fafc' }],
    },
    {
        featureType: 'water',
        elementType: 'geometry',
        stylers: [{ color: '#cde4f7' }],
    },
];

const getMarkerPinColor = (item) => {
    if (item.tiene_reclamo_abierto) return '#ef4444'; // Rojo reclamo
    if (item.salud_comercial === 'rojo') return '#ef4444';
    if (item.etapa === 'convertido') return '#10b981'; // Verde cliente AFINIX
    if (item.etapa === 'visita_programada' || item.etapa === 'contactado') return '#f59e0b'; // Ámbar visita
    if (item.etapa === 'visitado') return '#8b5cf6'; // Violeta visitado
    if (item.salud_comercial === 'verde') return '#10b981';
    if (item.salud_comercial === 'amarillo') return '#f59e0b';
    return '#2563eb'; // Azul prospecto nuevo
};

const createCustomToothMarkerSvg = (color, isSelected = false, isClient = false) => {
    const stroke = isSelected ? '#0f172a' : '#ffffff';
    const strokeWidth = isSelected ? 2.5 : 1.5;
    const badgeSvg = isClient ? `
        <circle cx="25" cy="8" r="5" fill="#ffffff" stroke="${color}" stroke-width="1.2"/>
        <path d="M23 8 L24.5 9.5 L27 6.5" stroke="#10b981" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    ` : '';

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
            <defs>
                <filter id="p-sh" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.32"/>
                </filter>
            </defs>
            <!-- Pin teardrop shape -->
            <path filter="url(#p-sh)" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" d="M17 1C8.7 1 2 7.7 2 16c0 10.5 15 26 15 26s15-15.5 15-26c0-8.3-6.7-15-15-15z"/>
            <!-- Dental Tooth / Molar Silhouette in White -->
            <g transform="translate(8.5, 7.5) scale(0.7)" fill="#ffffff">
                <path d="M12 2C9 2 7.5 3.8 5.2 4.2C3 4.5 2 6.8 2 9.5C2 13 3.8 18 5.8 21.5C7.2 23.8 8.8 21 10.5 17.5C11.3 15.8 12.7 15.8 13.5 17.5C15.2 21 16.8 23.8 18.2 21.5C20.2 18 22 13 22 9.5C22 6.8 21 4.5 18.8 4.2C16.5 3.8 15 2 12 2Z"/>
            </g>
            ${badgeSvg}
        </svg>
    `)}`;
};

export const CrmMapContainer = ({
    establishments = [],
    selectedEstablishment,
    onSelectEstablishment,
    cleanStyle = true,
    proximityCenter = null,
    proximityRadius = 500,
    routePoints = [],
    onMapClick = null,
}) => {
    const mapRef = useRef(null);
    const [map, setMap] = useState(null);
    const initialBoundsFitDoneRef = useRef(Boolean(getSavedViewport()));

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
        let instance;

        // Catch Google Maps authentication failures (unauthorized domain, billing inactive, etc.)
        window.gm_authFailure = () => {
            if (isMounted) {
                setMapError('AUTH_FAILURE');
            }
        };
        const initialize = async () => {
            try {
                if (!loaderConfigured) {
                    setOptions({ key: apiKey, v: 'weekly' });
                    loaderConfigured = true;
                }
                const [{ Map }] = await Promise.all([
                    importLibrary('maps'),
                    importLibrary('marker'),
                ]);
                if (!isMounted || !mapRef.current) return;

                const savedViewport = getSavedViewport();
                instance = new Map(mapRef.current, {
                    center: savedViewport ? savedViewport.center : DEFAULT_CENTER,
                    zoom: savedViewport ? savedViewport.zoom : 13,
                    minZoom: 11,
                    maxZoom: 19,
                    mapId: mapId || undefined,
                    styles: cleanStyle ? CLEAN_MAP_STYLES : [],
                    disableDefaultUI: false,
                    zoomControl: true,
                    streetViewControl: false,
                    mapTypeControl: false,
                });

                instance.addListener('idle', () => {
                    const center = instance.getCenter();
                    const zoom = instance.getZoom();
                    if (center && typeof zoom === 'number') {
                        const lat = center.lat();
                        const lng = center.lng();
                        if (lat <= -15.5 && lat >= -17.5 && lng <= -70.5 && lng >= -72.5) {
                            try {
                                localStorage.setItem(
                                    STORAGE_KEY_VIEWPORT,
                                    JSON.stringify({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)), zoom })
                                );
                            } catch {
                                // ignore storage errors
                            }
                        }
                    }
                });

                if (onMapClick) {
                    instance.addListener('click', (ev) => {
                        if (ev.latLng) {
                            onMapClick({ lat: ev.latLng.lat(), lng: ev.latLng.lng() });
                        }
                    });
                }

                setMap(instance);
                setIsLoading(false);
            } catch {
                if (isMounted) {
                    setMapError('ERROR_LOADING_MAP');
                    setIsLoading(false);
                }
            }
        };
        initialize();

        return () => {
            isMounted = false;
            if (instance) window.google?.maps?.event?.clearInstanceListeners(instance);
        };
    }, [apiKey, mapId]);

    // Update map style when cleanStyle changes
    useEffect(() => {
        if (!map) return;
        map.setOptions({ styles: cleanStyle ? CLEAN_MAP_STYLES : [] });
    }, [map, cleanStyle]);

    // Update proximity circle
    useEffect(() => {
        if (!map || !window.google?.maps?.Circle) return;
        if (!proximityCenter) return;

        const circle = new window.google.maps.Circle({
            map,
            center: proximityCenter,
            radius: proximityRadius,
            fillColor: '#2563eb',
            fillOpacity: 0.12,
            strokeColor: '#2563eb',
            strokeWeight: 1.5,
            strokeOpacity: 0.8,
            clickable: false,
        });

        return () => {
            circle.setMap(null);
        };
    }, [map, proximityCenter, proximityRadius]);

    // Update route polyline
    useEffect(() => {
        if (!map || !window.google?.maps?.Polyline) return;
        if (!routePoints || routePoints.length < 2) return;

        const path = routePoints
            .filter((p) => p.latitud && p.longitud)
            .map((p) => ({ lat: Number(p.latitud), lng: Number(p.longitud) }));

        const polyline = new window.google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: '#0284c7',
            strokeOpacity: 0.85,
            strokeWeight: 4,
            map,
        });

        return () => {
            polyline.setMap(null);
        };
    }, [map, routePoints]);

    // Update markers, clusterer, and heatmap whenever establishments or map changes
    useEffect(() => {
        if (!map || !window.google) return;

        const validPoints = establishments.filter((e) => {
            if (e.latitud == null || e.longitud == null) return false;
            const lat = Number(e.latitud);
            const lng = Number(e.longitud);
            if (isNaN(lat) || isNaN(lng)) return false;
            // Retain consultorios within Arequipa metropolitan territory (rejecting Florida, Asia, etc.)
            return lat <= -15.5 && lat >= -17.5 && lng <= -70.5 && lng >= -72.5;
        });

        const newMarkers = validPoints.map((item) => {
            const position = { lat: Number(item.latitud), lng: Number(item.longitud) };
            const pinColor = getMarkerPinColor(item);
            const isSelected = selectedEstablishment?.id === item.id;
            const isClient = item.etapa === 'convertido';

            const marker = new window.google.maps.Marker({
                position,
                title: `${item.nombre} (${item.etapa})`,
                icon: {
                    url: createCustomToothMarkerSvg(pinColor, isSelected, isClient),
                    scaledSize: isSelected
                        ? new window.google.maps.Size(34, 44)
                        : new window.google.maps.Size(28, 36),
                    anchor: new window.google.maps.Point(14, 36),
                },
                zIndex: isSelected ? 999 : 1,
            });

            marker.addListener('click', () => {
                onSelectEstablishment && onSelectEstablishment(item);
                map.panTo(position);
            });

            return marker;
        });

        const clusterer = newMarkers.length > 0
            ? new MarkerClusterer({ map, markers: newMarkers })
            : null;

        // Auto-fit map viewport only on initial load if no saved viewport exists
        if (
            !initialBoundsFitDoneRef.current &&
            validPoints.length > 0 &&
            map &&
            window.google?.maps?.LatLngBounds &&
            !selectedEstablishment
        ) {
            const bounds = new window.google.maps.LatLngBounds();
            validPoints.forEach((pt) => {
                bounds.extend({ lat: Number(pt.latitud), lng: Number(pt.longitud) });
            });
            map.fitBounds(bounds, 30);
            initialBoundsFitDoneRef.current = true;
        } else if (!initialBoundsFitDoneRef.current && map && !selectedEstablishment) {
            map.setCenter(DEFAULT_CENTER);
            map.setZoom(13);
            initialBoundsFitDoneRef.current = true;
        }

        return () => {
            clusterer?.clearMarkers();
            clusterer?.setMap(null);
            newMarkers.forEach((marker) => {
                window.google.maps.event.clearInstanceListeners(marker);
                marker.setMap(null);
            });
        };
    }, [map, establishments, selectedEstablishment, onSelectEstablishment]);

    // Center map when selectedEstablishment changes
    useEffect(() => {
        if (
            selectedEstablishment &&
            selectedEstablishment.latitud &&
            selectedEstablishment.longitud &&
            map
        ) {
            map.panTo({
                lat: Number(selectedEstablishment.latitud),
                lng: Number(selectedEstablishment.longitud),
            });
            map.setZoom(16);
        }
    }, [map, selectedEstablishment]);

    if (mapError === 'MISSING_API_KEY' || mapError) {
        return (
            <div style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', textAlign: 'center' }}>
                <div style={{ maxWidth: '540px', background: '#ffffff', padding: '2rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <i className="bi bi-geo-alt-fill text-primary" style={{ fontSize: '3rem' }}></i>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '1rem 0 0.5rem 0', color: '#0f172a' }}>
                        Configuración de Google Maps
                    </h3>
                    <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.25rem' }}>
                        {mapError === 'MISSING_API_KEY'
                            ? 'Configure la variable VITE_GOOGLE_MAPS_API_KEY en su archivo .env.'
                            : mapError === 'AUTH_FAILURE'
                            ? 'Google Maps rechazó la autenticación. Es necesario vincular una cuenta de Facturación (Billing) en Google Cloud Console o verificar que la clave permita el origen actual.'
                            : `Error de carga en Google Maps (${mapError}).`}
                    </p>

                    <div style={{ background: '#f1f5f9', borderRadius: '0.5rem', padding: '0.75rem', textAlign: 'left', fontSize: '0.8125rem', color: '#334155', marginBottom: '1.25rem' }}>
                        <strong>Modo de contingencia activo:</strong> Los {establishments.filter((e) => e.latitud && e.longitud).length} establecimientos georreferenciados están preservados. En Google Cloud Console, vaya a <strong>Billing</strong> para habilitar la facturación gratuita (Google brinda $200 USD de crédito mensual).
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

            {map && (
                <button
                    type="button"
                    onClick={() => {
                        map.panTo(DEFAULT_CENTER);
                        map.setZoom(13);
                        try {
                            localStorage.setItem(
                                STORAGE_KEY_VIEWPORT,
                                JSON.stringify({
                                    lat: DEFAULT_CENTER.lat,
                                    lng: DEFAULT_CENTER.lng,
                                    zoom: 13,
                                })
                            );
                        } catch {
                            // ignore
                        }
                    }}
                    style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        zIndex: 10,
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                        padding: '6px 12px',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: '#0f172a',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease-in-out',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f8fafc';
                        e.currentTarget.style.borderColor = '#94a3b8';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#ffffff';
                        e.currentTarget.style.borderColor = '#cbd5e1';
                    }}
                    title="Re-centrar vista en Arequipa"
                >
                    <i className="bi bi-geo-alt-fill" style={{ color: '#0284c7' }}></i>
                    Centrar Arequipa
                </button>
            )}
        </div>
    );
};

export default CrmMapContainer;
