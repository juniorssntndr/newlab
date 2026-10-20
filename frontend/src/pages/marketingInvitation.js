import { CANONICAL_SITE_ORIGIN } from '../config/seoConstants.js';
import { buildRegistrationPrefill, invitationEmail, parseRegistrationPrefill } from './registrationPrefill.js';

export function invitationOrigin(configuredOrigin) {
    try {
        const url = new URL(configuredOrigin);
        const host = url.hostname.toLowerCase();
        const privateHost = host === 'localhost' || !host.includes('.') || host.endsWith('.local') || host.endsWith('.localhost') || host.includes(':') || /^\d+(\.\d+){3}$/.test(host);
        if (url.protocol !== 'https:' || privateHost || url.username || url.password) return CANONICAL_SITE_ORIGIN;
        return url.origin;
    } catch {
        return CANONICAL_SITE_ORIGIN;
    }
}

export function invitationPhone(value = '') {
    const input = value.trim();
    if (!input) return { number: '', error: '' };
    const error = 'Usa 9 dígitos para Perú o + y el código de país para otro país.';
    if (!/^(\+|00)?[\d\s()-]+$/.test(input)) return { number: '', error };
    const digits = input.replace(/\D/g, '');
    if (/^9\d{8}$/.test(digits) && !input.startsWith('+') && !input.startsWith('00')) return { number: `51${digits}`, error: '' };
    if (input.startsWith('+') || input.startsWith('00')) {
        const number = input.startsWith('00') ? digits.slice(2) : digits;
        if (/^[1-9]\d{7,14}$/.test(number) && (!number.startsWith('51') || /^519\d{8}$/.test(number))) return { number, error: '' };
    }
    return { number: '', error };
}

export function eligibleInvitationCoupon(coupon, now = new Date()) {
    if (!coupon || !(coupon.activo === true || coupon.activo === 1) || coupon.clinica_id || !coupon.codigo) return false;
    const time = new Date(now).getTime();
    if (coupon.fecha_inicio && !(new Date(coupon.fecha_inicio).getTime() <= time)) return false;
    if (coupon.fecha_fin && !(new Date(coupon.fecha_fin).getTime() >= time)) return false;
    if (coupon.limite_usos_total != null && !(Number(coupon.usos_actuales ?? 0) < Number(coupon.limite_usos_total))) return false;
    return true;
}

export const DEFAULT_INVITATION_TEMPLATE = `👋 ¡Hola [doctor]!

Le damos una cordial bienvenida desde *AFINIX Dental Lab*. [bienvenida_clinica]

[seccion_cupon]
🔗 Complete su registro y elija su contraseña en un solo clic aquí:
[enlace_registro]

¡Será un gusto trabajar juntos y potenciar sus casos clínicos!`;

export function compileInvitationTemplate(template, { doctor = '', clinic = '', phone = '', coupon = null, couponText = '', registrationUrl = '' } = {}) {
    const docLabel = doctor ? `Dr(a). ${doctor}` : 'doctor(a)';
    const clinicSentence = clinic
        ? `Creamos este acceso exclusivo para ${clinic} para que pueda enviar y hacer seguimiento en tiempo real a todos sus trabajos y diseños 3D.`
        : 'Queremos facilitarle el envío y seguimiento en tiempo real de todos sus trabajos odontológicos y diseños 3D.';

    const rawCouponText = couponText || (coupon?.codigo ? `cupón ${coupon.codigo}` : '');

    let compiled = template
        .replace(/\[doctor\]/gi, docLabel)
        .replace(/\[nombre\]/gi, doctor || 'Doctor(a)')
        .replace(/\[clinica\]/gi, clinic || 'su consultorio')
        .replace(/\[consultorio\]/gi, clinic || 'su consultorio')
        .replace(/\[telefono\]/gi, phone || '')
        .replace(/\[bienvenida_clinica\]/gi, clinicSentence)
        .replace(/\[enlace_registro\]/gi, registrationUrl)
        .replace(/\[enlace\]/gi, registrationUrl)
        .replace(/\[link\]/gi, registrationUrl)
        .replace(/\[seccion_cupon\]/gi, rawCouponText ? `${rawCouponText}\n\n` : '')
        .replace(/\[cupon\]/gi, coupon?.codigo || '');

    // Cleanup excessive newlines if coupon section was empty
    return compiled.replace(/\n{3,}/g, '\n\n').trim();
}

export function buildInvitation({ name = '', clinic = '', phone = '', email = '', address = '', district = '', coupon = null, origin = '', now = new Date(), customMessage = null, customTemplate = null } = {}) {
    const telephone = invitationPhone(phone);
    const emailError = invitationEmail(email);
    const params = buildRegistrationPrefill({ name, clinic, phone: telephone.number ? `+${telephone.number}` : '', email: emailError ? '' : email, address, district });
    const prefill = parseRegistrationPrefill(params);
    const registrationUrl = `${invitationOrigin(origin)}/registro${params.size ? `?${params}` : ''}`;
    const validCoupon = eligibleInvitationCoupon(coupon, now) ? coupon : null;

    const couponText = validCoupon
        ? `🎁 Como bienvenida especial, le obsequiamos el cupón *${validCoupon.codigo}* con *${validCoupon.tipo === 'porcentaje' ? `${Number(validCoupon.valor)}% de descuento` : `S/ ${Number(validCoupon.valor).toFixed(2)} de descuento`}* para su próximo pedido.`
        : '';

    let message = '';
    if (typeof customMessage === 'string' && customMessage.trim()) {
        message = compileInvitationTemplate(customMessage.trim(), {
            doctor: prefill.nombre,
            clinic: prefill.clinica_nombre,
            phone: telephone.number ? `+${telephone.number}` : '',
            coupon: validCoupon,
            couponText,
            registrationUrl
        });
    } else if (typeof customTemplate === 'string' && customTemplate.trim()) {
        message = compileInvitationTemplate(customTemplate, {
            doctor: prefill.nombre,
            clinic: prefill.clinica_nombre,
            phone: telephone.number ? `+${telephone.number}` : '',
            coupon: validCoupon,
            couponText,
            registrationUrl
        });
    } else {
        message = compileInvitationTemplate(DEFAULT_INVITATION_TEMPLATE, {
            doctor: prefill.nombre,
            clinic: prefill.clinica_nombre,
            phone: telephone.number ? `+${telephone.number}` : '',
            coupon: validCoupon,
            couponText,
            registrationUrl
        });
    }

    const encodedText = encodeURIComponent(message);
    const phoneDirect = telephone.number || '';
    const hasError = Boolean(telephone.error || emailError);

    // Desktop app protocol (whatsapp://send?...)
    const whatsappDesktopUrl = hasError ? null : (phoneDirect ? `whatsapp://send?phone=${phoneDirect}&text=${encodedText}` : `whatsapp://send?text=${encodedText}`);
    // Web / Universal fallback (https://web.whatsapp.com o https://wa.me)
    const whatsappWebUrl = hasError ? null : (phoneDirect ? `https://web.whatsapp.com/send?phone=${phoneDirect}&text=${encodedText}` : `https://web.whatsapp.com/send?text=${encodedText}`);
    const whatsappMobileUrl = hasError ? null : (phoneDirect ? `https://wa.me/${phoneDirect}?text=${encodedText}` : `https://wa.me/?text=${encodedText}`);

    return {
        registrationUrl,
        message,
        phoneError: telephone.error,
        emailError,
        whatsappUrl: whatsappDesktopUrl,
        whatsappDesktopUrl,
        whatsappWebUrl,
        whatsappMobileUrl
    };
}
