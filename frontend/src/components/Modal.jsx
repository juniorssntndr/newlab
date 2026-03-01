import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const Modal = ({ open, onClose, title, children, footer, size = '' }) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!open || !mounted) return null;

    const modalContent = (
        <div className="modal-backdrop" onClick={onClose}>
            <div className={`modal ${size === 'lg' ? 'modal-lg' : size === 'xl' ? 'modal-xl' : size === '2xl' ? 'modal-2xl' : ''}`}
                onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">{title}</h3>
                    <button className="modal-close" onClick={onClose}><i className="bi bi-x-lg"></i></button>
                </div>
                <div className="modal-body">{children}</div>
                {footer && <div className="modal-footer">{footer}</div>}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default Modal;
