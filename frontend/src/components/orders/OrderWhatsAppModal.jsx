import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../Modal.jsx';

/**
 * Normaliza número de teléfono para Perú (E.164 sin símbolos ni espacios).
 */
const cleanPhoneNumber = (rawPhone) => {
    if (!rawPhone) return '';
    let digits = String(rawPhone).replace(/\D/g, '');
    if (digits.startsWith('51') && digits.length === 11) {
        return digits;
    }
    if (digits.length === 9) {
        return `51${digits}`;
    }
    return digits;
};

export const OrderWhatsAppModal = ({
    isOpen,
    open,
    onClose,
    pedido,
    items = [],
    approvalLink = ''
}) => {
    const isModalOpen = Boolean(open ?? isOpen);

    const clinicaNombre = pedido?.clinica_nombre || pedido?.clinica_razon_social || 'su clínica';
    const pacienteNombre = pedido?.paciente_nombre || 'Paciente';

    // Nombres resumidos de los productos
    const productosTexto = useMemo(() => {
        if (!Array.isArray(items) || items.length === 0) return 'Trabajo dental';
        const nombres = items.map((it) => it.producto_nombre || it.nombre).filter(Boolean);
        return nombres.length > 0 ? nombres.join(' + ') : 'Trabajo dental';
    }, [items]);

    // Fecha formateada
    const fechaEntregaTexto = useMemo(() => {
        if (!pedido?.fecha_entrega) return '';
        const d = new Date(pedido.fecha_entrega);
        if (Number.isNaN(d.getTime())) return pedido.fecha_entrega;
        return d.toLocaleDateString('es-PE', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }, [pedido?.fecha_entrega]);

    // Enlace oficial 3D (prioridad 1: link de Exocad/3D cargado; prioridad 2: seguimiento)
    const currentApproval = (pedido?.aprobaciones || [])[0];
    const link3DReal = approvalLink || currentApproval?.link_exocad || currentApproval?.link_visor || pedido?.aprobacion?.link_exocad || '';
    const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://afinixlab.com';
    const linkSeguimiento = `${appOrigin}/pedidos/${pedido?.id}`;
    const linkParaAprobacion = link3DReal || linkSeguimiento;

    // Detectar entorno móvil vs escritorio
    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Estados locales
    const [telefono, setTelefono] = useState('');
    const [tipoPlantilla, setTipoPlantilla] = useState('aprobacion');
    const [mensajeCustom, setMensajeCustom] = useState('');
    const [copiado, setCopiado] = useState(false);

    // Inicializar teléfono y plantilla según fase actual
    useEffect(() => {
        if (!isModalOpen) return;

        const rawPhone = pedido?.clinica_telefono || pedido?.telefono || pedido?.doctor_telefono || '';
        const digits = String(rawPhone).replace(/\D/g, '');
        // Si viene con 51 y tiene 11 dígitos, dejamos los 9 últimos para el input con prefijo
        const phoneFormatted = digits.startsWith('51') && digits.length === 11 ? digits.slice(2) : digits;
        setTelefono(phoneFormatted);

        if (pedido?.estado === 'esperando_aprobacion' || link3DReal) {
            setTipoPlantilla('aprobacion');
        } else if (pedido?.estado === 'terminado' || pedido?.estado === 'enviado') {
            setTipoPlantilla('terminado');
        } else if (pedido?.estado === 'en_produccion') {
            setTipoPlantilla('produccion');
        } else {
            setTipoPlantilla('aprobacion');
        }
        setCopiado(false);
    }, [isModalOpen, pedido, link3DReal]);

    // Generar el mensaje conciso, cálido y directo (estándar AFINIX)
    useEffect(() => {
        let msg = '';
        if (tipoPlantilla === 'aprobacion') {
            msg = `¡Hola equipo de *${clinicaNombre}*! 👋\n\nEl diseño 3D de *${productosTexto}* para el paciente *${pacienteNombre}* ya está listo para su aprobación.\n\nPueden revisarlo aquí:\n${linkParaAprobacion}\n\n¡Quedamos atentos a sus comentarios!\n*AFINIX Dental Lab*`;
        } else if (tipoPlantilla === 'terminado') {
            msg = `¡Hola equipo de *${clinicaNombre}*! 🚀\n\nEl trabajo de *${productosTexto}* para el paciente *${pacienteNombre}* ya está terminado y listo para entrega.\n\n¡Muchas gracias por su preferencia!\n*AFINIX Dental Lab*`;
        } else if (tipoPlantilla === 'produccion') {
            const extraFecha = fechaEntregaTexto ? ` Entrega estimada: *${fechaEntregaTexto}*.` : '';
            msg = `¡Hola equipo de *${clinicaNombre}*! ⚙️\n\nEl trabajo de *${productosTexto}* para el paciente *${pacienteNombre}* ya ingresó a fase de producción.${extraFecha}\n\n*AFINIX Dental Lab*`;
        }
        setMensajeCustom(msg);
    }, [tipoPlantilla, clinicaNombre, productosTexto, pacienteNombre, linkParaAprobacion, fechaEntregaTexto]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(mensajeCustom);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2200);
        } catch {
            // fallback
        }
    };

    // Abrir WhatsApp Web directamente (PC) o App (Móvil)
    const handleOpenWhatsApp = (mode = 'smart') => {
        const phone = cleanPhoneNumber(telefono);
        const encodedText = encodeURIComponent(mensajeCustom);

        if (mode === 'web') {
            // WhatsApp Web directo en navegador (bypassa la pantalla intermedia de wa.me)
            const webUrl = phone
                ? `https://web.whatsapp.com/send?phone=${phone}&text=${encodedText}`
                : `https://web.whatsapp.com/send?text=${encodedText}`;
            window.open(webUrl, '_blank', 'noopener,noreferrer');
        } else if (mode === 'desktop_app') {
            // Protocolo nativo de la app de escritorio instalada en Windows/Mac
            const protocolUrl = phone
                ? `whatsapp://send?phone=${phone}&text=${encodedText}`
                : `whatsapp://send?text=${encodedText}`;
            window.location.href = protocolUrl;
        } else {
            // Smart: en celular abre app nativa; en PC abre WhatsApp Web directamente
            if (isMobile) {
                const mobileUrl = phone
                    ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodedText}`
                    : `https://api.whatsapp.com/send?text=${encodedText}`;
                window.open(mobileUrl, '_blank', 'noopener,noreferrer');
            } else {
                const webUrl = phone
                    ? `https://web.whatsapp.com/send?phone=${phone}&text=${encodedText}`
                    : `https://web.whatsapp.com/send?text=${encodedText}`;
                window.open(webUrl, '_blank', 'noopener,noreferrer');
            }
        }
        onClose();
    };

    if (!isModalOpen) return null;

    return (
        <Modal
            open={isModalOpen}
            isOpen={isModalOpen}
            onClose={onClose}
            title={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                    <i className="bi bi-whatsapp" style={{ color: '#25D366', fontSize: '1.25rem' }} />
                    Notificar a la Clínica por WhatsApp
                </span>
            }
        >
            <div className="order-wa-modal-body">
                {/* Selector de plantilla */}
                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" htmlFor="wa-modal-plantilla" style={{ fontWeight: 650, fontSize: '0.82rem' }}>
                        <i className="bi bi-chat-left-dots" style={{ marginRight: '0.35rem', color: 'var(--color-primary)' }} />
                        Tipo de notificación
                    </label>
                    <select
                        id="wa-modal-plantilla"
                        className="form-select"
                        value={tipoPlantilla}
                        onChange={(e) => setTipoPlantilla(e.target.value)}
                        style={{ height: '42px', minHeight: '42px', fontWeight: 600 }}
                    >
                        <option value="aprobacion">Diseño 3D listo para aprobación</option>
                        <option value="terminado">Trabajo terminado</option>
                        <option value="produccion">Caso en producción</option>
                    </select>
                </div>

                {/* Número de teléfono con prefijo Perú */}
                <div className="form-group" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                        <label className="form-label" htmlFor="wa-modal-telefono" style={{ margin: 0, fontWeight: 650, fontSize: '0.82rem' }}>
                            <i className="bi bi-telephone" style={{ marginRight: '0.35rem', color: 'var(--color-primary)' }} />
                            Teléfono de contacto
                        </label>
                        {!telefono && (
                            <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600 }}>
                                ⚠️ Sin número registrado
                            </span>
                        )}
                    </div>
                    <div className="order-wa-phone-group">
                        <span className="order-wa-phone-prefix" title="Código de país Perú">
                            🇵🇪 +51
                        </span>
                        <input
                            id="wa-modal-telefono"
                            type="tel"
                            className="form-input"
                            placeholder="Ej. 987654321"
                            value={telefono}
                            onChange={(e) => setTelefono(e.target.value)}
                            style={{ height: '42px', minHeight: '42px', fontSize: '0.92rem', fontWeight: 600 }}
                        />
                    </div>
                </div>

                {/* Mensaje previsualizado editable */}
                <div className="form-group" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <label className="form-label" htmlFor="wa-modal-mensaje" style={{ margin: 0, fontWeight: 650, fontSize: '0.82rem' }}>
                            <i className="bi bi-pencil-square" style={{ marginRight: '0.35rem', color: 'var(--color-primary)' }} />
                            Mensaje a enviar (directo y editable)
                        </label>
                        <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={handleCopy}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 600 }}
                        >
                            <i className={`bi ${copiado ? 'bi-check2 text-success' : 'bi-clipboard'}`} />
                            {copiado ? '¡Copiado!' : 'Copiar texto'}
                        </button>
                    </div>
                    <div className="order-wa-textarea-wrapper">
                        <textarea
                            id="wa-modal-mensaje"
                            className="form-textarea order-wa-textarea"
                            rows={6}
                            value={mensajeCustom}
                            onChange={(e) => setMensajeCustom(e.target.value)}
                        />
                    </div>
                </div>

                {/* Footer de acciones */}
                <div className="order-wa-footer">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
                        Cancelar
                    </button>

                    <div className="order-wa-footer-actions">
                        {!isMobile && (
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm btn-whatsapp-secondary"
                                onClick={() => handleOpenWhatsApp('desktop_app')}
                                title="Abrir en la aplicación de WhatsApp instalada en tu computadora"
                            >
                                <i className="bi bi-laptop" />
                                <span>App de PC</span>
                            </button>
                        )}

                        <button
                            type="button"
                            className="btn btn-whatsapp-primary"
                            onClick={() => handleOpenWhatsApp(isMobile ? 'smart' : 'web')}
                            title={isMobile ? 'Abrir chat en WhatsApp móvil' : 'Abrir chat directo en WhatsApp Web'}
                        >
                            <i className="bi bi-whatsapp" />
                            <span>{isMobile ? 'Abrir en WhatsApp' : 'Abrir WhatsApp Web'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default OrderWhatsAppModal;
