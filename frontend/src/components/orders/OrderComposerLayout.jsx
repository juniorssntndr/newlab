import React from 'react';

const MOBILE_STEPS = {
    catalog: 1,
    clinical: 2
};

const OrderComposerLayout = ({
    leftPane,
    rightPane,
    mobileStep,
    onMobileStepChange,
    disableClinicalStep = false
}) => {
    return (
        <section className="order-composer-shell">
            <div className="order-composer-mobile-switcher">
                <button
                    type="button"
                    className={`btn btn-sm ${mobileStep === MOBILE_STEPS.catalog ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => onMobileStepChange(MOBILE_STEPS.catalog)}
                >
                    1. Catalogo
                </button>
                <button
                    type="button"
                    className={`btn btn-sm ${mobileStep === MOBILE_STEPS.clinical ? 'btn-primary' : 'btn-ghost'}`}
                    disabled={disableClinicalStep}
                    onClick={() => onMobileStepChange(MOBILE_STEPS.clinical)}
                >
                    2. Clinico
                </button>
            </div>

            <div className="order-composer-desktop-grid">
                <div className={`order-composer-pane order-composer-pane-left ${mobileStep === MOBILE_STEPS.catalog ? '' : 'order-composer-mobile-hidden'}`}>
                    {leftPane}
                </div>
                <div className={`order-composer-pane order-composer-pane-right ${mobileStep === MOBILE_STEPS.clinical ? '' : 'order-composer-mobile-hidden'}`}>
                    {rightPane}
                </div>
            </div>
        </section>
    );
};

export default OrderComposerLayout;
