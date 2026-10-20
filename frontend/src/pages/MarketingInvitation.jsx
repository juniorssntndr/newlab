import React, { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import CustomSelect from '../components/CustomSelect.jsx';
import { PREFILL_LIMITS, REGISTRATION_DISTRICT_OPTIONS } from './registrationPrefill.js';
import { getConfiguredSiteOrigin } from '../config/siteSeo.js';
import { buildInvitation, eligibleInvitationCoupon, DEFAULT_INVITATION_TEMPLATE } from './marketingInvitation.js';

export default function MarketingInvitation({ coupons, couponsError, onCreateCoupon }) {
    const [recipient, setRecipient] = useState({ name: '', clinic: '', phone: '', email: '', address: '', district: '' });
    const [couponCode, setCouponCode] = useState('');
    const [isEditingMessage, setIsEditingMessage] = useState(false);
    const [customMessage, setCustomMessage] = useState('');
    const textareaRef = useRef(null);

    const eligibleCoupons = couponsError ? [] : coupons.filter((coupon) => eligibleInvitationCoupon(coupon));
    const coupon = eligibleCoupons.find((item) => item.codigo === couponCode);
    const unavailableCoupon = Boolean(couponCode && !coupon);
    const invitation = buildInvitation({
        ...recipient,
        coupon,
        origin: getConfiguredSiteOrigin(),
        customMessage: isEditingMessage || customMessage ? customMessage : null
    });
    const shareError = Boolean(invitation.phoneError || invitation.emailError);
    const updateRecipient = (event) => setRecipient((previous) => ({ ...previous, [event.target.name]: event.target.value }));
    const copy = async (value, label) => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success(`${label} copiado`);
        } catch {
            toast.error('No se pudo copiar. Puedes seleccionar el texto de la vista previa.');
        }
    };

    const handleStartEditing = () => {
        if (!customMessage) {
            setCustomMessage(invitation.message);
        }
        setIsEditingMessage(true);
    };

    const handleResetDefault = () => {
        setCustomMessage('');
        setIsEditingMessage(false);
        toast.success('Mensaje restaurado al formato estándar');
    };

    const handleLoadTemplate = () => {
        setCustomMessage(DEFAULT_INVITATION_TEMPLATE);
        setIsEditingMessage(true);
        toast.success('Plantilla con etiquetas [doctor], [clinica], etc. cargada');
    };

    const insertVariable = (tag) => {
        const textarea = textareaRef.current;
        if (!textarea) {
            setCustomMessage((prev) => {
                const current = prev || invitation.message;
                return `${current} ${tag}`;
            });
            return;
        }

        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? textarea.value.length;
        const currentText = customMessage || invitation.message;
        const before = currentText.substring(0, start);
        const after = currentText.substring(end);
        const updated = `${before}${tag}${after}`;

        setCustomMessage(updated);

        // Reposicionar el cursor inmediatamente tras el texto insertado
        setTimeout(() => {
            textarea.focus();
            const newCursorPos = start + tag.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 10);
    };

    return (
        <section className="marketing-invitation" aria-label="Invitación para clientes nuevos">
            <div className="card dashboard-ops-panel marketing-invitation-form">
                <header>
                    <h3>Invitar a un cliente nuevo</h3>
                    <p>Completa los datos que conozcas. El cliente confirma o completa lo que falte y elige su contraseña.</p>
                </header>
                <div className="form-group">
                    <label className="form-label" htmlFor="invitation-name">Nombres y apellidos del doctor o doctora (opcional)</label>
                    <input id="invitation-name" name="name" maxLength={PREFILL_LIMITS.nombre} className="form-input" autoComplete="name" placeholder="Ej. Carlos Mendoza" value={recipient.name} onChange={updateRecipient} />
                </div>
                <div className="form-group">
                    <label className="form-label" htmlFor="invitation-clinic">Clínica o consultorio (opcional)</label>
                    <input id="invitation-clinic" name="clinic" maxLength={PREFILL_LIMITS.clinica_nombre} className="form-input" autoComplete="organization" placeholder="Ej. Clínica Dental Sonrisas" value={recipient.clinic} onChange={updateRecipient} />
                </div>
                <div className="form-group">
                    <label className="form-label" htmlFor="invitation-phone">WhatsApp (opcional)</label>
                    <input id="invitation-phone" name="phone" maxLength={PREFILL_LIMITS.telefono} type="tel" className="form-input" autoComplete="tel" placeholder="958 123 456 o +51 958 123 456" aria-invalid={Boolean(invitation.phoneError)} aria-describedby="invitation-phone-help" value={recipient.phone} onChange={updateRecipient} />
                    <small id="invitation-phone-help" className={invitation.phoneError ? 'marketing-form-note' : 'marketing-invitation-note'}>{invitation.phoneError || 'Sin número, eliges el destinatario en WhatsApp.'}</small>
                </div>
                <div className="form-group">
                    <label className="form-label" htmlFor="invitation-email">Correo electrónico (opcional)</label>
                    <input id="invitation-email" name="email" type="email" maxLength={PREFILL_LIMITS.email} className="form-input" autoComplete="email" placeholder="doctor@consultorio.pe" aria-invalid={Boolean(invitation.emailError)} aria-describedby={invitation.emailError ? 'invitation-email-error' : undefined} value={recipient.email} onChange={updateRecipient} />
                    {invitation.emailError && <small id="invitation-email-error" className="marketing-form-note">{invitation.emailError}</small>}
                </div>
                <details className="marketing-invitation-location">
                    <summary>Dirección del consultorio (opcional)</summary>
                    <div className="form-group">
                        <label className="form-label" htmlFor="invitation-address">Dirección</label>
                        <input id="invitation-address" name="address" maxLength={PREFILL_LIMITS.direccion} className="form-input" autoComplete="street-address" placeholder="Ej. Av. Cayma 402, Of. 301" value={recipient.address} onChange={updateRecipient} />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="invitation-district">Distrito en Arequipa</label>
                        <CustomSelect id="invitation-district" aria-label="Distrito en Arequipa" value={recipient.district} options={[{ value: '', label: 'Sin especificar' }, ...REGISTRATION_DISTRICT_OPTIONS]} searchable onChange={(_, value) => setRecipient((previous) => ({ ...previous, district: value }))} />
                    </div>
                </details>
                <div className="form-group">
                    <div className="marketing-invitation-coupon-heading">
                        <label className="form-label" htmlFor="invitation-coupon">Cupón de bienvenida (opcional)</label>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onCreateCoupon(setCouponCode)}><i className="bi bi-plus-lg" aria-hidden="true" /> Crear cupón</button>
                    </div>
                    <CustomSelect id="invitation-coupon" aria-label="Cupón de bienvenida" value={coupon?.codigo || ''} disabled={Boolean(couponsError)} options={[{ value: '', label: 'Sin cupón' }, ...eligibleCoupons.map((item) => ({ value: item.codigo, label: `${item.codigo} · ${item.tipo === 'porcentaje' ? `${item.valor}%` : `S/ ${item.valor}`}` }))]} onChange={(_, value) => setCouponCode(value)} />
                    {unavailableCoupon && <small className="marketing-form-note" role="status">El cupón seleccionado ya no está disponible. Se retiró del mensaje.</small>}
                </div>
            </div>
            <div className="card dashboard-ops-panel marketing-invitation-preview">
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Mensaje para compartir</h3>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                            {isEditingMessage ? 'Edita y personaliza el texto antes de enviarlo.' : 'El mismo texto que se abrirá en WhatsApp con formato enriquecido.'}
                        </p>
                    </div>
                    <div>
                        {isEditingMessage ? (
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-secondary"
                                    onClick={handleResetDefault}
                                    title="Restaurar formato estándar"
                                >
                                    <i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Restaurar
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    onClick={() => setIsEditingMessage(false)}
                                    title="Ver vista previa final"
                                >
                                    <i className="bi bi-check-lg" aria-hidden="true" /> Listo
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={handleStartEditing}
                                title="Personalizar mensaje"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                            >
                                <i className="bi bi-pencil-square" aria-hidden="true" />
                                {customMessage ? 'Modificar texto' : 'Personalizar mensaje'}
                            </button>
                        )}
                    </div>
                </header>

                {isEditingMessage ? (
                    <div className="marketing-invitation-editor-box" style={{ marginTop: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Insertar en cursor:</span>
                                <button
                                    type="button"
                                    className="badge badge-inactive"
                                    style={{ cursor: 'pointer', border: '1px solid var(--color-border)', background: 'var(--color-bg-alt)' }}
                                    onClick={() => insertVariable(recipient.name ? `Dr(a). ${recipient.name}` : '[doctor]')}
                                    title="Inserta el nombre del doctor en la posición actual del cursor"
                                >
                                    + {recipient.name ? `Dr(a). ${recipient.name}` : '[doctor]'}
                                </button>
                                <button
                                    type="button"
                                    className="badge badge-inactive"
                                    style={{ cursor: 'pointer', border: '1px solid var(--color-border)', background: 'var(--color-bg-alt)' }}
                                    onClick={() => insertVariable(recipient.clinic || '[clinica]')}
                                    title="Inserta la clínica o consultorio en la posición actual del cursor"
                                >
                                    + {recipient.clinic || '[clinica]'}
                                </button>
                                {coupon && (
                                    <button
                                        type="button"
                                        className="badge badge-inactive"
                                        style={{ cursor: 'pointer', border: '1px solid var(--color-border)', background: 'var(--color-bg-alt)' }}
                                        onClick={() => insertVariable(coupon.codigo)}
                                        title="Inserta el código de cupón en la posición actual del cursor"
                                    >
                                        + {coupon.codigo}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="badge badge-inactive"
                                    style={{ cursor: 'pointer', border: '1px solid var(--color-border)', background: 'var(--color-bg-alt)' }}
                                    onClick={() => insertVariable('[enlace_registro]')}
                                    title="Inserta la etiqueta de enlace de registro"
                                >
                                    + [enlace_registro]
                                </button>
                            </div>
                            <button
                                type="button"
                                className="btn btn-sm btn-ghost"
                                onClick={handleLoadTemplate}
                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                title="Cargar plantilla con etiquetas automáticas"
                            >
                                <i className="bi bi-file-earmark-code" aria-hidden="true" /> Ver plantilla base
                            </button>
                        </div>
                        <textarea
                            ref={textareaRef}
                            className="form-input marketing-invitation-textarea"
                            rows={9}
                            style={{ width: '100%', lineHeight: '1.6', fontSize: '0.88rem', resize: 'vertical' }}
                            value={customMessage || invitation.message}
                            onChange={(e) => setCustomMessage(e.target.value)}
                            placeholder="Escribe el mensaje o usa etiquetas como [doctor], [clinica], [enlace_registro]..."
                        />
                        <small style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block', marginTop: '0.35rem' }}>
                            Las etiquetas como <code>[doctor]</code>, <code>[clinica]</code> y <code>[enlace_registro]</code> se rellenan automáticamente con los datos del formulario de la izquierda.
                        </small>
                    </div>
                ) : (
                    <div className="marketing-invitation-message">{invitation.message}</div>
                )}

                <div className="marketing-invitation-actions">
                    <button
                        type="button"
                        className="btn marketing-invitation-whatsapp"
                        disabled={shareError}
                        onClick={() => {
                            if (shareError) return;
                            const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
                            if (isMobile) {
                                window.open(invitation.whatsappMobileUrl, '_blank', 'noopener,noreferrer');
                            } else {
                                // En escritorio: primero intentamos invocar el protocolo nativo de WhatsApp Desktop
                                if (invitation.whatsappDesktopUrl) {
                                    window.location.href = invitation.whatsappDesktopUrl;
                                } else {
                                    window.open(invitation.whatsappWebUrl, '_blank', 'noopener,noreferrer');
                                }
                            }
                        }}
                    >
                        <i className="bi bi-whatsapp" aria-hidden="true" /> Abrir WhatsApp
                    </button>
                    <button type="button" className="btn btn-secondary" disabled={shareError} onClick={() => copy(invitation.message, 'Mensaje')}>
                        <i className="bi bi-clipboard" aria-hidden="true" /> Copiar mensaje
                    </button>
                    <button type="button" className="btn btn-ghost" disabled={shareError} onClick={() => copy(invitation.registrationUrl, 'Enlace')}>
                        <i className="bi bi-link-45deg" aria-hidden="true" /> Copiar enlace
                    </button>
                </div>
                <p className="marketing-invitation-note">
                    En computadora abre <strong>WhatsApp Desktop</strong> (o puedes usar WhatsApp Web); en móvil redirige a la app de WhatsApp. El mensaje va listo para que solo confirmes el envío.
                </p>
            </div>
        </section>
    );
}
