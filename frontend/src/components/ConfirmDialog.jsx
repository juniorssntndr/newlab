import React from 'react';
import Modal from './Modal.jsx';

/**
 * Diálogo de confirmación in-app (reemplaza window.confirm nativo).
 */
const ConfirmDialog = ({
    open,
    isOpen,
    onClose,
    onCancel,
    onConfirm,
    title = 'Confirmar',
    message = '',
    description,
    confirmLabel,
    confirmText,
    cancelLabel = 'Cancelar',
    variant,
    confirmVariant,
    confirming = false,
    isLoading = false,
    icon = 'bi-exclamation-triangle',
    confirmIcon,
}) => {
    const isDialogOpen = open !== undefined ? open : Boolean(isOpen);
    const handleClose = onClose || onCancel;
    const isConfirming = confirming || isLoading;
    const finalVariant = variant || confirmVariant || 'danger';
    const finalConfirmLabel = confirmLabel || confirmText || 'Confirmar';

    const confirmClass = finalVariant === 'danger' ? 'btn btn-danger' : 'btn btn-primary';
    const actionIcon = confirmIcon || (finalVariant === 'danger' ? 'bi-trash' : 'bi-check-lg');

    return (
        <Modal
            open={isDialogOpen}
            onClose={isConfirming ? undefined : handleClose}
            title={title}
            kicker="Seguridad • Confirmación requerida"
            icon={icon}
            size="sm"
            className="confirm-dialog-modal"
            footer={(
                <>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleClose}
                        disabled={isConfirming}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={confirmClass}
                        onClick={onConfirm}
                        disabled={isConfirming}
                    >
                        {isConfirming ? (
                            <>
                                <span className="spinner confirm-dialog-spinner" aria-hidden="true" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <i className={`bi ${actionIcon}`} aria-hidden="true" />
                                {finalConfirmLabel}
                            </>
                        )}
                    </button>
                </>
            )}
        >
            <div className={`confirm-dialog-body confirm-dialog-body--${finalVariant}`}>
                <div className="confirm-dialog-icon" aria-hidden="true">
                    <i className={`bi ${icon}`} />
                </div>
                <div className="confirm-dialog-copy">
                    {typeof message === 'string' ? <p>{message}</p> : message}
                    {description && (
                        <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: '#64748b' }}>
                            {description}
                        </p>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default ConfirmDialog;
