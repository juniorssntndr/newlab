import React from 'react';
import CommercialHealthBadge from '../components/CommercialHealthBadge.jsx';

export const CrmMapBottomSheet = ({
    establishment,
    onClose,
    onViewDetail,
    onScheduleVisit,
    onConvert
}) => {
    if (!establishment) return null;

    return (
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary, #3b82f6)', textTransform: 'uppercase' }}>
                        {establishment.tipo || 'Establecimiento'} • {establishment.etapa}
                    </span>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0.25rem 0 0 0', color: 'var(--color-text-primary, #0f172a)' }}>
                        {establishment.nombre}
                    </h3>
                </div>
                <button
                    type="button"
                    className="crm-btn crm-btn-secondary crm-btn-icon crm-btn-sm"
                    onClick={onClose}
                    aria-label="Cerrar panel de punto"
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

            <div style={{ fontSize: '0.8125rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {establishment.direccion && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem' }}>
                        <i className="bi bi-geo-alt text-primary"></i>
                        <span>{establishment.direccion}</span>
                    </div>
                )}
                {establishment.telefono && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <i className="bi bi-telephone text-primary"></i>
                        <a href={`tel:${establishment.telefono}`} style={{ color: 'var(--color-primary, #3b82f6)', fontWeight: 600, textDecoration: 'none' }}>
                            {establishment.telefono}
                        </a>
                    </div>
                )}
                {establishment.responsable_nombre && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <i className="bi bi-person text-primary"></i>
                        <span>Responsable: <strong>{establishment.responsable_nombre}</strong></span>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                {establishment.telefono && (
                    <a href={`tel:${establishment.telefono}`} className="crm-btn crm-btn-secondary crm-btn-sm" style={{ flex: 1 }}>
                        <i className="bi bi-telephone-fill text-primary"></i> Llamar
                    </a>
                )}
                <button
                    type="button"
                    className="crm-btn crm-btn-secondary crm-btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => onScheduleVisit && onScheduleVisit(establishment)}
                >
                    <i className="bi bi-calendar-plus"></i> Visitar
                </button>
                {establishment.etapa !== 'convertido' && (
                    <button
                        type="button"
                        className="crm-btn crm-btn-success crm-btn-sm"
                        style={{ flex: 1 }}
                        onClick={() => onConvert && onConvert(establishment)}
                    >
                        <i className="bi bi-arrow-repeat"></i> Convertir
                    </button>
                )}
                <button
                    type="button"
                    className="crm-btn crm-btn-primary crm-btn-sm"
                    style={{ width: '100%' }}
                    onClick={() => onViewDetail && onViewDetail(establishment.id)}
                >
                    <i className="bi bi-card-text"></i> Ver Ficha Integral
                </button>
            </div>
        </div>
    );
};

export default CrmMapBottomSheet;
