import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCrmPgRepository } from './crmPgRepository.js';

test('createImportPreview marks duplicates within the same batch before commit', async () => {
    const insertedRows = [];
    const client = {
        async query(sql, params) {
            if (sql.includes('INSERT INTO nl_crm_importaciones (nombre_archivo')) {
                return { rows: [{ id: 101 }] };
            }
            if (sql.includes("SELECT id, nombre, 'origen_id' AS criterio")) {
                return { rows: [] };
            }
            if (sql.includes("SELECT e.id, e.nombre, 'nombre_telefono_ubicacion' AS criterio")) {
                return { rows: [] };
            }
            if (sql.includes('INSERT INTO nl_crm_importacion_filas')) {
                const row = {
                    id: insertedRows.length + 1,
                    numero_fila: params[1],
                    estado: params[5],
                    duplicado_establecimiento_id: params[6],
                    aprobada: params[7],
                };
                insertedRows.push(row);
                return { rows: [row] };
            }
            if (sql.includes('UPDATE nl_crm_importaciones SET total_filas')) {
                return { rows: [{ id: 101, total_filas: params[0], filas_validas: params[1], filas_error: params[2], filas_duplicadas: params[3] }] };
            }
            return { rows: [] };
        },
        release() {}
    };
    const pool = {
        async connect() { return client; }
    };

    const repo = makeCrmPgRepository({ pool });
    const rows = [
        {
            rowNumber: 1,
            original: { nombre: 'Dental Lima 1', telefono: '999888777' },
            normalized: {
                nombre: 'Dental Lima 1',
                nombre_normalizado: 'dental lima 1',
                tipo: 'clinica',
                telefono: '999888777',
                telefono_normalizado: '999888777',
                email: null,
                direccion: 'Av Principal 123',
                latitud: -12.046374,
                longitud: -77.042793,
                origen: 'csv',
                origen_id: 'item-1',
                etapa: 'nuevo',
                notas: null
            },
            errors: []
        },
        {
            rowNumber: 2,
            original: { nombre: 'Dental Lima 1 Repetido', telefono: '999888777' },
            normalized: {
                nombre: 'Dental Lima 1 Repetido',
                nombre_normalizado: 'dental lima 1 repetido',
                tipo: 'clinica',
                telefono: '999888777',
                telefono_normalizado: '999888777',
                email: null,
                direccion: 'Av Principal 123',
                latitud: -12.046374,
                longitud: -77.042793,
                origen: 'csv',
                origen_id: 'item-1', // Same origen + origen_id
                etapa: 'nuevo',
                notas: null
            },
            errors: []
        },
        {
            rowNumber: 3,
            original: { nombre: 'Dental Lima 2', telefono: '999111222' },
            normalized: {
                nombre: 'Dental Lima 2',
                nombre_normalizado: 'dental lima 2',
                tipo: 'clinica',
                telefono: '999111222',
                telefono_normalizado: '999111222',
                email: null,
                direccion: 'Calle 2',
                latitud: -12.050000,
                longitud: -77.050000,
                origen: 'csv',
                origen_id: null,
                etapa: 'nuevo',
                notas: null
            },
            errors: []
        },
        {
            rowNumber: 4,
            original: { nombre: 'Dental Lima 2', telefono: '999111222' },
            normalized: {
                nombre: 'Dental Lima 2',
                nombre_normalizado: 'dental lima 2', // Same name + phone + location <=150m
                tipo: 'clinica',
                telefono: '999111222',
                telefono_normalizado: '999111222',
                email: null,
                direccion: 'Calle 2 B',
                latitud: -12.050010,
                longitud: -77.050010,
                origen: 'csv',
                origen_id: null,
                etapa: 'nuevo',
                notas: null
            },
            errors: []
        }
    ];

    const result = await repo.createImportPreview({
        fileName: 'test.csv',
        format: 'csv',
        mapping: {},
        rows,
        actorUserId: 1
    });

    assert.equal(result.importacion.total_filas, 4);
    assert.equal(result.importacion.filas_validas, 2);
    assert.equal(result.importacion.filas_duplicadas, 2);
    assert.equal(result.filas[0].estado, 'valida');
    assert.equal(result.filas[1].estado, 'duplicada');
    assert.equal(result.filas[2].estado, 'valida');
    assert.equal(result.filas[3].estado, 'duplicada');
});
