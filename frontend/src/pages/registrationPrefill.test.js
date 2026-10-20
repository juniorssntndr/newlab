import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRegistrationPrefill, parseRegistrationPrefill, PREFILL_LIMITS, REGISTRATION_DISTRICTS, REGISTRATION_PASSWORD_MAX_LENGTH, invitationEmail } from './registrationPrefill.js';
import { buildInvitation } from './marketingInvitation.js';

test('full invitation round-trips accents, plus signs and contact/location details', () => {
    const recipient = {
        name: 'José Pérez Ramírez', clinic: 'Clínica + Sonrisas & Salud', phone: '+51 958 123 456',
        email: 'jose+consultorio@example.pe', address: 'Av. Ejército 402, Of. 301', district: 'Cayma'
    };
    const invitation = buildInvitation(recipient);
    const url = new URL(invitation.registrationUrl);
    assert.equal(url.origin, 'https://afinixlab.com');
    assert.deepEqual(parseRegistrationPrefill(url.searchParams), {
        nombre: recipient.name, clinica_nombre: recipient.clinic, telefono: '+51958123456',
        email: recipient.email, direccion: recipient.address, distrito: recipient.district, password: ''
    });
    assert.equal(new URL(invitation.whatsappUrl).searchParams.get('text'), invitation.message);
    assert.ok(invitation.message.includes(invitation.registrationUrl));
});

test('partial and empty invitations leave unavailable fields blank', () => {
    assert.deepEqual(parseRegistrationPrefill(), {
        nombre: '', clinica_nombre: '', telefono: '', email: '', direccion: '', distrito: '', password: ''
    });
    const partial = parseRegistrationPrefill(buildRegistrationPrefill({ name: 'Ana García' }));
    assert.equal(partial.nombre, 'Ana García');
    for (const field of ['email', 'telefono', 'direccion', 'clinica_nombre', 'distrito', 'password']) assert.equal(partial[field], '');
    assert.equal(buildInvitation().registrationUrl, 'https://afinixlab.com/registro');
});

test('legacy aliases remain compatible but password and unapproved query fields are never accepted', () => {
    const current = parseRegistrationPrefill('?doc=Ana+García&clinica=Sonrisas&tel=%2B51958123456&password=unsafe&role=admin&promo=FREE');
    assert.equal(current.nombre, 'Ana García');
    assert.equal(current.telefono, '+51958123456');
    assert.equal(current.password, '');
    assert.equal('role' in current, false);
    assert.equal('promo' in current, false);
    const legacy = parseRegistrationPrefill('?nombre=Ana&telefono=958123456');
    assert.equal(legacy.nombre, 'Ana');
    assert.equal(legacy.telefono, '958123456');
    assert.equal(parseRegistrationPrefill('?nombre=&doc=Ana').nombre, 'Ana');
    const params = buildRegistrationPrefill({ name: 'Ana', password: 'unsafe', role: 'admin' });
    assert.deepEqual([...params.keys()], ['doc']);
});

test('query values are bounded, stripped of control characters and district must match existing options', () => {
    const params = new URLSearchParams({ nombre: `  Ana\nPérez ${'x'.repeat(200)}`, email: 'x'.repeat(400), direccion: 'x'.repeat(400), distrito: 'Unknown' });
    const parsed = parseRegistrationPrefill(params);
    assert.equal(parsed.nombre.length, PREFILL_LIMITS.nombre);
    assert.equal(parsed.email.length, PREFILL_LIMITS.email);
    assert.equal(parsed.direccion.length, PREFILL_LIMITS.direccion);
    assert.equal(parsed.nombre.includes('\n'), false);
    assert.equal(parsed.distrito, '');
    for (const district of REGISTRATION_DISTRICTS) assert.equal(parseRegistrationPrefill(buildRegistrationPrefill({ district })).distrito, district);
    assert.equal(buildRegistrationPrefill({ district: 'Unknown' }).has('distrito'), false);
});

test('every newly edited contact or address produces a current link, not a cached one', () => {
    const recipient = { email: 'first@example.pe', address: 'Av. 1', district: 'Cayma' };
    const first = buildInvitation(recipient);
    const next = buildInvitation({ ...recipient, email: 'next@example.pe', address: 'Av. 2', district: 'Yanahuara' });
    const parsed = parseRegistrationPrefill(new URL(next.registrationUrl).searchParams);
    assert.notEqual(first.registrationUrl, next.registrationUrl);
    assert.equal(parsed.email, 'next@example.pe');
    assert.equal(parsed.direccion, 'Av. 2');
    assert.equal(parsed.distrito, 'Yanahuara');
});

test('optional invalid email blocks all sharing and is omitted from the link', () => {
    assert.equal(invitationEmail(''), '');
    assert.equal(invitationEmail('ana+lab@example.pe'), '');
    for (const email of ['wrong', 'a @example.pe', 'a@example', 'a'.repeat(255) + '@example.pe']) {
        const invitation = buildInvitation({ email });
        assert.ok(invitation.emailError);
        assert.equal(invitation.whatsappUrl, null);
        assert.equal(new URL(invitation.registrationUrl).searchParams.has('email'), false);
    }
});

test('prefill maxima match registerClientSchema and the 180-character email sharing boundary', () => {
    assert.deepEqual(PREFILL_LIMITS, { nombre: 180, clinica_nombre: 180, telefono: 40, email: 180, direccion: 300, distrito: 100 });
    assert.equal(REGISTRATION_PASSWORD_MAX_LENGTH, 120);
    const emailAtLimit = `${'a'.repeat(60)}@${'b'.repeat(60)}.${'c'.repeat(55)}.pe`;
    assert.equal(emailAtLimit.length, 180);
    assert.equal(invitationEmail(emailAtLimit), '');
    assert.equal(new URL(buildInvitation({ email: emailAtLimit }).registrationUrl).searchParams.get('email'), emailAtLimit);
    const emailOverLimit = `${'a'.repeat(61)}@${'b'.repeat(60)}.${'c'.repeat(55)}.pe`;
    const invalid = buildInvitation({ email: emailOverLimit });
    assert.ok(invalid.emailError);
    assert.equal(invalid.whatsappUrl, null);
    assert.equal(new URL(invalid.registrationUrl).searchParams.has('email'), false);
});

test('builder and parser bound each accepted text field to the backend maximum', () => {
    const params = buildRegistrationPrefill({ name: 'n'.repeat(200), clinic: 'c'.repeat(200), phone: '9'.repeat(50), email: 'e'.repeat(200), address: 'a'.repeat(400) });
    for (const [key, field] of [['doc', 'nombre'], ['clinica', 'clinica_nombre'], ['tel', 'telefono'], ['email', 'email'], ['direccion', 'direccion']]) {
        assert.equal(params.get(key).length, PREFILL_LIMITS[field]);
    }
    const parsed = parseRegistrationPrefill('?doc=' + 'n'.repeat(200) + '&clinica=' + 'c'.repeat(200) + '&tel=' + '9'.repeat(50) + '&email=' + 'e'.repeat(200) + '&direccion=' + 'a'.repeat(400));
    for (const field of ['nombre', 'clinica_nombre', 'telefono', 'email', 'direccion']) assert.equal(parsed[field].length, PREFILL_LIMITS[field]);
    assert.equal(parsed.password, '');
});
