/**
 * Panel lateral tipo “Caso rápido”: guía visual del flujo (no segundo stepper).
 * items: [{ id, label, description?, detail?, status: 'done'|'current'|'pending' }]
 */
const OrderWizardTimeline = ({
    items = [],
    title = 'Caso rápido',
    subtitle = 'Crea tu pedido en 3 pasos claros.',
}) => {
    return (
        <aside className="order-wizard-guide" aria-label={title}>
            <header className="order-wizard-guide-header">
                <span className="order-wizard-guide-badge" aria-hidden="true">
                    <i className="bi bi-lightning-charge-fill"></i>
                </span>
                <div className="order-wizard-guide-heading">
                    <strong>{title}</strong>
                    {subtitle ? <p>{subtitle}</p> : null}
                </div>
            </header>

            <ol className="order-wizard-guide-list">
                {items.map((item, index) => {
                    const status = item.status || 'pending';
                    const stepNumber = index + 1;
                    return (
                        <li
                            key={item.id}
                            className={`order-wizard-guide-item is-${status}`}
                        >
                            <div className="order-wizard-guide-rail" aria-hidden="true">
                                <span className="order-wizard-guide-index">
                                    {status === 'done' ? (
                                        <i className="bi bi-check-lg"></i>
                                    ) : (
                                        stepNumber
                                    )}
                                </span>
                            </div>
                            <div className="order-wizard-guide-body">
                                <div className="order-wizard-guide-copy">
                                    <strong>{item.label}</strong>
                                    {item.description ? <span>{item.description}</span> : null}
                                    {item.detail && item.detail !== item.description ? (
                                        <em>{item.detail}</em>
                                    ) : null}
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ol>
        </aside>
    );
};

export default OrderWizardTimeline;
