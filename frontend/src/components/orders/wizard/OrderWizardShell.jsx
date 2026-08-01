import React from 'react';
import { ORDER_WIZARD_MACRO_STEPS } from '../../../modules/orders/wizard/orderWizardConstants.js';

/**
 * Shell del wizard de pedido AFINIX: stepper macro + Volver / Guardar y cerrar.
 */
const OrderWizardShell = ({
    macroStep,
    title,
    subtitle,
    onBack,
    onClose,
    children,
    footer = null,
}) => {
    const currentIdx = ORDER_WIZARD_MACRO_STEPS.findIndex((step) => step.id === macroStep);

    return (
        <div className="order-wizard animate-fade-in">
            <header className="order-wizard-topbar">
                <button type="button" className="btn btn-ghost btn-sm order-wizard-topbar-nav" onClick={onBack}>
                    <i className="bi bi-chevron-left" aria-hidden="true"></i>
                    <span className="order-wizard-topbar-label">Volver</span>
                </button>

                <nav className="order-wizard-macro" aria-label="Pasos del pedido">
                    {ORDER_WIZARD_MACRO_STEPS.map((step, idx) => {
                        const done = idx < currentIdx;
                        const active = idx === currentIdx;
                        return (
                            <div
                                key={step.id}
                                className={`order-wizard-macro-step${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
                                aria-current={active ? 'step' : undefined}
                            >
                                <span className="order-wizard-macro-index" aria-hidden="true">
                                    {done ? <i className="bi bi-check-lg"></i> : step.index}
                                </span>
                                <span className="order-wizard-macro-label">{step.label}</span>
                            </div>
                        );
                    })}
                </nav>

                <button
                    type="button"
                    className="btn btn-ghost btn-sm order-wizard-topbar-nav"
                    onClick={onClose}
                    aria-label="Guardar y cerrar"
                >
                    <i className="bi bi-x-lg" aria-hidden="true"></i>
                    <span className="order-wizard-topbar-label">Guardar y cerrar</span>
                </button>
            </header>

            {title ? (
                <div className="order-wizard-heading">
                    <h1>{title}</h1>
                    {subtitle ? <p className="order-wizard-subtitle">{subtitle}</p> : null}
                </div>
            ) : null}

            <div className="order-wizard-body">{children}</div>
            {footer ? <footer className="order-wizard-footer">{footer}</footer> : null}
        </div>
    );
};

export default OrderWizardShell;
