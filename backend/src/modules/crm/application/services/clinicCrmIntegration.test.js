import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAndPersistClinicContact, ensureClinicEstablishment } from './clinicCrmIntegration.js';

const fakeClient = ({ principal, linkedPhone } = {}) => ({
    calls: [],
    async query(sql, params) {
        this.calls.push({ sql, params });
        if (sql.includes("SELECT id FROM nl_doctores")) return { rows: principal ? [{ id: params[0] }] : [] };
        if (sql.includes('SELECT d.id,d.telefono')) return { rows: principal ? [{ id: params[1], telefono: principal.telefono }] : [] };
        if (sql.includes('NULLIF(BTRIM(d.telefono)')) return { rows: linkedPhone ? [{ id: 3 }] : [] };
        return { rows: [], rowCount: 1 };
    }
});

test('clinic requires own phone or a linked doctor phone', async () => {
    const client = fakeClient({ linkedPhone: false });
    await assert.rejects(
        validateAndPersistClinicContact(client, { clinicId: 1, phone: null }),
        (error) => error.code === 'CONTACT_REQUIRED'
    );
});

test('principal doctor is linked and accepted as clinic contact', async () => {
    const client = fakeClient({ principal: { telefono: '999111222' }, linkedPhone: true });
    await validateAndPersistClinicContact(client, { clinicId: 1, phone: null, principalDoctorId: 9, doctorIds: [9] });
    assert.ok(client.calls.some(({ sql }) => sql.includes('INSERT INTO nl_clinica_doctores')));
    assert.ok(client.calls.some(({ sql }) => sql.includes('doctor_contacto_principal_id')));
});

test('ensureClinicEstablishment does not overwrite existing responsable_id with actorUserId on clinic update', async () => {
    let capturedParams = null;
    let capturedSql = null;
    const client = {
        async query(sql, params) {
            capturedSql = sql;
            capturedParams = params;
            return { rows: [{ id: 42, responsable_id: 10 }] };
        }
    };
    const clinic = { id: 1, nombre: 'Clínica Dental San Juan', establecimiento_id: 42, telefono: '987654321', estado: 'activo' };
    const res = await ensureClinicEstablishment(client, clinic, {}, 99);
    assert.strictEqual(res.id, 42);
    assert.ok(capturedSql.includes('responsable_id=COALESCE(responsable_id, $10)'));
    assert.strictEqual(capturedParams[9], null);
});
