import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * CrmActionMenu - Menú desplegable flotante de acciones para filas y cards CRM
 * 
 * @param {Array<{ label: string, icon?: string, onClick?: () => void, danger?: boolean, hidden?: boolean, divider?: boolean }>} props.items
 * @param {string} [props.triggerClassName]
 * @param {string} [props.triggerIcon='bi bi-three-dots-vertical']
 * @param {string} [props.triggerLabel]
 * @param {string} [props.title='Más acciones']
 */
export const CrmActionMenu = ({
    items = [],
    triggerClassName = 'crm-btn crm-btn-secondary crm-btn-sm crm-btn-icon',
    triggerIcon = 'bi bi-three-dots-vertical',
    triggerLabel,
    title = 'Más acciones',
}) => {
    const [open, setOpen] = useState(false);
    const [menuStyle, setMenuStyle] = useState(null);
    const triggerRef = useRef(null);
    const menuRef = useRef(null);

    const updatePosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const menuWidth = 190;
        const spaceBelow = window.innerHeight - rect.bottom - 8;
        const spaceAbove = rect.top - 8;
        const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;

        let left = rect.right - menuWidth;
        if (left < 10) left = 10;
        if (left + menuWidth > window.innerWidth - 10) {
            left = window.innerWidth - menuWidth - 10;
        }

        setMenuStyle({
            position: 'fixed',
            left: `${left}px`,
            top: openUp ? 'auto' : `${rect.bottom + 6}px`,
            bottom: openUp ? `${window.innerHeight - rect.top + 6}px` : 'auto',
            width: `${menuWidth}px`,
            zIndex: 9999,
        });
    }, []);

    const handleToggle = (e) => {
        e.stopPropagation();
        if (!open) {
            updatePosition();
            setOpen(true);
        } else {
            setOpen(false);
        }
    };

    // Cerrar al hacer click fuera o presionar Escape
    useEffect(() => {
        if (!open) return;

        const handleClickOutside = (e) => {
            if (
                menuRef.current && !menuRef.current.contains(e.target) &&
                triggerRef.current && !triggerRef.current.contains(e.target)
            ) {
                setOpen(false);
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };

        const handleScrollOrResize = () => {
            setOpen(false);
        };

        document.addEventListener('mousedown', handleClickOutside, true);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('scroll', handleScrollOrResize, true);
        window.addEventListener('resize', handleScrollOrResize);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('scroll', handleScrollOrResize, true);
            window.removeEventListener('resize', handleScrollOrResize);
        };
    }, [open]);

    const activeItems = items.filter((it) => !it.hidden);

    if (activeItems.length === 0) return null;

    return (
        <div style={{ position: 'relative', display: 'inline-flex' }}>
            <button
                ref={triggerRef}
                type="button"
                className={triggerClassName}
                onClick={handleToggle}
                title={title}
                aria-expanded={open}
                aria-haspopup="menu"
                style={{ cursor: 'pointer' }}
            >
                {triggerIcon && <i className={triggerIcon}></i>}
                {triggerLabel && <span style={{ marginLeft: '4px' }}>{triggerLabel}</span>}
            </button>

            {open && menuStyle && createPortal(
                <div
                    ref={menuRef}
                    className="crm-action-menu-dropdown animate-scale-in"
                    style={menuStyle}
                    role="menu"
                    onClick={(e) => e.stopPropagation()}
                >
                    {activeItems.map((item, index) => {
                        if (item.divider) {
                            return <div key={`div-${index}`} className="crm-action-menu-divider" role="separator" />;
                        }

                        return (
                            <button
                                key={index}
                                type="button"
                                className={`crm-action-menu-item ${item.danger ? 'is-danger' : ''}`}
                                role="menuitem"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setOpen(false);
                                    item.onClick && item.onClick();
                                }}
                            >
                                {item.icon && <i className={`crm-action-menu-icon ${item.icon}`} aria-hidden="true"></i>}
                                <span className="crm-action-menu-label">{item.label}</span>
                            </button>
                        );
                    })}
                </div>,
                document.body
            )}
        </div>
    );
};

export default CrmActionMenu;
