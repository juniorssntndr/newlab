import React from 'react';
import CommercialHealthBadge from '../components/CommercialHealthBadge.jsx';

export const CrmMapBottomSheet = ({
    establishment,
    onClose,
    onViewDetail,
    onScheduleVisit,
    onConvert,
    isInRoute = false,
    onToggleRoute = null,
    onFindNearby = null,
}) => {
    if (!establishment) return null;

    const cleanPhone = establishment.telefono ? establishment.telefono.replace(/\D/g, '') : '';
    const whatsappUrl = cleanPhone
        ? `https://wa.me/51${cleanPhone}?text=${encodeURIComponent(`Hola estimado/a Dr./Dra., le saluda AFINIX Dental Lab en Arequipa. Nos comunicamos respecto a su consultorio ${establishment.nombre}.`)}`
        : null;

    return (
        <div className="crm-sheet-content" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div className="crm-sheet-drag-handle" aria-hidden="true"></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-primary, #0284c7)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {establishment.tipo || 'Establecimiento'} • {establishment.etapa}
                    </span>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0.2rem 0 0 0', color: 'var(--color-text-primary, #0f172a)', wordBreak: 'break-word' }}>
                        {establishment.nombre}
                    </h3>
                </div>
                <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={onClose}
                    aria-label="Cerrar panel de punto"
                    style={{ padding: '0.25rem 0.5rem', borderRadius: '50%', width: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: '8px' }}
                >
                    <i className="bi bi-x-lg"></i>
                </button>
            </div>

            <div>
                <CommercialHealthBadge
                    salud={establishment.salud_comercial}
                    etapa={establishment.etapa}
                    tieneReclamoAbierto={establishment.tiene_reclamo_abierto}
                    diasSinPedido={establishment.dias_sin_pedido}
                    causa={establishment.causa_salud}
                    showCause={true}
                />
            </div>

            <div style={{ fontSize: '0.8125rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.3rem', background: 'var(--color-bg, #f8fafc)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                {establishment.direccion && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem' }}>
                        <i className="bi bi-geo-alt text-primary" style={{ marginTop: '2px', flexShrink: 0 }}></i>
                        <span style={{ fontSize: '0.78rem', lineHeight: 1.3 }}>{establishment.direccion}</span>
                    </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {establishment.telefono ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <i className="bi bi-telephone text-primary"></i>
                            <a href={`tel:${establishment.telefono}`} style={{ color: 'var(--color-primary, #0284c7)', fontWeight: 700, textDecoration: 'none' }}>
                                {establishment.telefono}
                            </a>
                        </div>
                    ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Sin teléfono</span>
                    )}
                    {establishment.responsable_nombre && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.78rem' }}>
                            <i className="bi bi-person text-secondary"></i>
                            <span>{establishment.responsable_nombre}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Actions Grid (WhatsApp, Ruta, Visitar, Convertir) */}
            <div className="crm-sheet-actions-grid">
                {whatsappUrl && (
                    <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: '#16a34a', color: '#ffffff', fontWeight: 600, textDecoration: 'none' }}
                        title="Escribir por WhatsApp"
                    >
                        <i className="bi bi-whatsapp"></i> WhatsApp
                    </a>
                )}
                {onToggleRoute && (
                    <button
                        type="button"
                        className={`btn btn-sm ${isInRoute ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                        onClick={() => onToggleRoute(establishment)}
                        title={isInRoute ? 'Quitar de la ruta del día' : 'Agregar a la ruta del día'}
                    >
                        <i className={`bi ${isInRoute ? 'bi-check-circle-fill' : 'bi-plus-circle'}`}></i>
                        {isInRoute ? 'En Ruta' : '+ Ruta'}
                    </button>
                )}
                <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    onClick={() => onScheduleVisit && onScheduleVisit(establishment)}
                >
                    <i className="bi bi-calendar-plus"></i> Visitar
                </button>
                {establishment.etapa !== 'convertido' && (
                    <button
                        type="button"
                        className="btn btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: '#059669', color: '#ffffff' }}
                        onClick={() => onConvert && onConvert(establishment)}
                    >
                        <i className="bi bi-arrow-repeat"></i> Convertir
                    </button>
                )}
            </div>

            {/* Bottom Actions Row: 500m & Ficha Integral */}
            <div className="crm-sheet-actions-bottom">
                {onFindNearby && (
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm crm-sheet-btn-nearby"
                        onClick={() => onFindNearby(establishment)}
                        title="Buscar consultorios cercanos a 500m"
                    >
                        <i className="bi bi-broadcast-pin text-primary"></i> 500m
                    </button>
                )}
                <button
                    type="button"
                    className="btn btn-primary btn-sm crm-sheet-btn-ficha"
                    onClick={() => onViewDetail && onViewDetail(establishment.id)}
                >
                    <i className="bi bi-card-text"></i> Ver Ficha Integral
                </button>
            </div>
        </div>
    );
};

export default CrmMapBottomSheet;
