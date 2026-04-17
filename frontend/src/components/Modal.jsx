import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

const Modal = ({ open, onClose, title, children, footer, size = '', className = '', bodyClassName = '' }) => {
    const [mounted, setMounted] = useState(false);
    const modalRef = useRef(null);
    const onCloseRef = useRef(onClose);
    const previousFocusRef = useRef(null);
    const titleId = useId();

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!open || !mounted) return undefined;

        previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const focusModal = () => {
            const modalNode = modalRef.current;
            if (!modalNode) return;

            const firstFocusable = modalNode.querySelector(FOCUSABLE_SELECTOR);
            if (firstFocusable instanceof HTMLElement) {
                firstFocusable.focus();
                return;
            }

            modalNode.focus();
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                onCloseRef.current?.();
                return;
            }

            if (event.key !== 'Tab') return;

            const modalNode = modalRef.current;
            if (!modalNode) return;

            const focusableElements = Array.from(modalNode.querySelectorAll(FOCUSABLE_SELECTOR))
                .filter((element) => element instanceof HTMLElement && element.offsetParent !== null);

            if (focusableElements.length === 0) {
                event.preventDefault();
                modalNode.focus();
                return;
            }

            const firstFocusable = focusableElements[0];
            const lastFocusable = focusableElements[focusableElements.length - 1];

            if (event.shiftKey && document.activeElement === firstFocusable) {
                event.preventDefault();
                lastFocusable.focus();
                return;
            }

            if (!event.shiftKey && document.activeElement === lastFocusable) {
                event.preventDefault();
                firstFocusable.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        window.setTimeout(focusModal, 0);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = previousOverflow;
            previousFocusRef.current?.focus?.();
        };
    }, [open, mounted]);

    if (!open || !mounted) return null;

    const modalContent = (
        <div className="modal-backdrop" onClick={onClose}>
            <div className={`modal ${size === 'lg' ? 'modal-lg' : size === 'xl' ? 'modal-xl' : size === '2xl' ? 'modal-2xl' : ''} ${className}`.trim()}
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title" id={titleId}>{title}</h3>
                    <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar modal">
                        <i className="bi bi-x-lg" aria-hidden="true"></i>
                    </button>
                </div>
                <div className={`modal-body ${bodyClassName}`.trim()}>{children}</div>
                {footer && <div className="modal-footer">{footer}</div>}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default Modal;
