// Keep invitation links and registration initialization on the same allowlist.
export const REGISTRATION_DISTRICTS = [
    'Arequipa (Cercado)', 'Yanahuara', 'Cayma', 'Cerro Colorado',
    'José Luis Bustamante y Rivero', 'Mariano Melgar', 'Paucarpata',
    'Miraflores', 'Sachaca', 'Alto Selva Alegre', 'Socabaya', 'Tiabaya',
    'Jacobo Hunter', 'Characato', 'Otro distrito'
];

export const REGISTRATION_DISTRICT_OPTIONS = REGISTRATION_DISTRICTS.map((value) => ({ value, label: value }));
// Match backend registerClientSchema; password is never part of the URL allowlist.
export const PREFILL_LIMITS = { nombre: 180, clinica_nombre: 180, telefono: 40, email: 180, direccion: 300, distrito: 100 };
export const REGISTRATION_PASSWORD_MAX_LENGTH = 120;

const clean = (value, limit) => typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, limit)
    : '';

export function invitationEmail(value = '') {
    const email = typeof value === 'string' ? value.trim() : '';
    return !email || (email.length <= PREFILL_LIMITS.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        ? '' : 'Ingresa un correo electrónico válido o deja el campo vacío.';
}

export function parseRegistrationPrefill(query = '') {
    const params = query instanceof URLSearchParams ? query : new URLSearchParams(query);
    const read = (key, ...aliases) => clean([...aliases, key].map((name) => params.get(name)).find((value) => value?.trim()) || '', PREFILL_LIMITS[key]);
    const district = read('distrito');
    return {
        nombre: read('nombre', 'doc'),
        clinica_nombre: clean(params.get('clinica') || '', PREFILL_LIMITS.clinica_nombre),
        telefono: read('telefono', 'tel'),
        email: read('email'),
        direccion: read('direccion'),
        distrito: REGISTRATION_DISTRICTS.includes(district) ? district : '',
        password: ''
    };
}

export function buildRegistrationPrefill({ name = '', clinic = '', phone = '', email = '', address = '', district = '' } = {}) {
    const params = new URLSearchParams();
    for (const [key, value, limit] of [
        ['doc', name, PREFILL_LIMITS.nombre], ['clinica', clinic, PREFILL_LIMITS.clinica_nombre],
        ['tel', phone, PREFILL_LIMITS.telefono], ['email', email, PREFILL_LIMITS.email],
        ['direccion', address, PREFILL_LIMITS.direccion], ['distrito', district, PREFILL_LIMITS.distrito]
    ]) {
        const cleaned = clean(value, limit);
        if (cleaned && (key !== 'distrito' || REGISTRATION_DISTRICTS.includes(cleaned))) params.set(key, cleaned);
    }
    return params;
}
