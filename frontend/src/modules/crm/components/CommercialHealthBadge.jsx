import React from 'react';

export const CommercialHealthBadge = ({
    salud,
    etapa,
    tieneReclamoAbierto,
    diasSinPedido,
    causa,
    showCause = false
}) => {
    // If not a client/converted, show prospect stage
    if (etapa && etapa !== 'convertido' && !salud) {
        const stageLabels = {
            nuevo: 'Nuevo Prospecto',
            contactado: 'Contactado',
            visita_programada: 'Visita Agendada',
            visitado: 'Visitado',
            descartado: 'Descartado',
        };
        return (
            <span className="crm-badge salud-prospecto" title="Prospecto en prospección">
                <i className="bi bi-funnel"></i>
                <span>{stageLabels[etapa] || 'Prospecto'}</span>
            </span>
        );
    }

    const healthConfig = {
        verde: {
            className: 'salud-verde',
            icon: 'bi-check-circle-fill',
            label: 'Verde',
            defaultCause: 'Activo (<30 días)',
        },
        amarillo: {
            className: 'salud-amarillo',
            icon: 'bi-exclamation-triangle-fill',
            label: 'Amarillo',
            defaultCause: 'En riesgo (30-59 días)',
        },
        rojo: {
            className: 'salud-rojo',
            icon: 'bi-x-circle-fill',
            label: 'Rojo',
            defaultCause: 'Inactivo (60+ días)',
        },
    };

    const config = healthConfig[salud] || {
        className: 'salud-prospecto',
        icon: 'bi-dot',
        label: 'Sin pedidos',
        defaultCause: 'Sin historial reciente',
    };

    const computedCause =
        causa ||
        (diasSinPedido != null ? `${diasSinPedido} días sin pedido` : config.defaultCause);

    return (
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                <span className={`crm-badge ${config.className}`} title={computedCause}>
                    <i className={`bi ${config.icon}`}></i>
                    <span>{config.label}</span>
                </span>

                {tieneReclamoAbierto && (
                    <span className="crm-badge reclamo-alerta" title="Prioridad alta por reclamo abierto">
                        <i className="bi bi-bell-fill"></i>
                        <span>Reclamo Abierto</span>
                    </span>
                )}
            </div>

            {showCause && (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary, #64748b)' }}>
                    {computedCause}
                </span>
            )}
        </div>
    );
};

export default CommercialHealthBadge;
