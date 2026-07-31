import React from 'react';
import Modal from './Modal.jsx';

/**
 * Diálogo de confirmación in-app (reemplaza window.confirm nativo).
 */
const ConfirmDialog = ({
    open,
    onClose,
    onConfirm,
    title = 'Confirmar',
    message = '',
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    variant = 'danger',
    confirming = false,
    icon = 'bi-exclamation-triangle',
}) => {
    const confirmClass = variant === 'danger' ? 'btn btn-danger' : 'btn btn-primary';

    return (
        <Modal
            open={open}
            onClose={confirming ? undefined : onClose}
            title={title}
            className="confirm-dialog-modal"
            footer={(
                <>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={onClose}
                        disabled={confirming}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={confirmClass}
                        onClick={onConfirm}
                        disabled={confirming}
                    >
                        {confirming ? (
                            <>
                                <span className="spinner confirm-dialog-spinner" aria-hidden="true" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <i className={`bi ${variant === 'danger' ? 'bi-trash' : 'bi-check-lg'}`} aria-hidden="true" />
                                {confirmLabel}
                            </>
                        )}
                    </button>
                </>
            )}
        >
            <div className={`confirm-dialog-body confirm-dialog-body--${variant}`}>
                <div className="confirm-dialog-icon" aria-hidden="true">
                    <i className={`bi ${icon}`} />
                </div>
                <div className="confirm-dialog-copy">
                    {typeof message === 'string' ? <p>{message}</p> : message}
                </div>
            </div>
        </Modal>
    );
};

export default ConfirmDialog;
