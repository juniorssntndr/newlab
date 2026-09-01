import { calculateCommercialHealth, limaDate, suggestNextVisitDate } from '../../domain/commercialHealth.js';
import { crmRepositoryHelpers } from '../../infrastructure/repositories/crmPgRepository.js';

const { normalizeName, normalizePhone } = crmRepositoryHelpers;
const STAFF_ROLES = new Set(['admin', 'tecnico', 'visitador']);
const ADMIN_ROLES = new Set(['admin']);
const MANAGER_ROLES = new Set(['admin', 'tecnico']);
const TYPES = new Set(['clinica', 'consultorio', 'odontologo', 'otro']);
const STAGES = new Set(['nuevo', 'contactado', 'visita_programada', 'visitado', 'convertido', 'descartado']);
const VISIT_STATES = new Set(['programada', 'en_curso', 'completada', 'sin_contacto', 'reprogramada', 'cancelada']);

const failure = (type, error, status = 400) => ({ ok: false, type, error, status });
const success = (data, status = 200, meta) => ({ ok: true, data, status, ...(meta ? { meta } : {}) });
const can = (user, roles) => Boolean(user && roles.has(user.tipo));

const nullableText = (value) => {
    if (value === undefined) return undefined;
    const normalized = value == null ? '' : String(value).trim();
    return normalized || null;
};

const nullableNumber = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : NaN;
};

const parseCsv = (text) => {
    const firstLine = String(text).split(/\r?\n/, 1)[0] || '';
    const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
    const rows = [];
    let row = []; let value = ''; let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        if (char === '"') {
            if (quoted && text[i + 1] === '"') { value += '"'; i += 1; }
            else quoted = !quoted;
        } else if (char === delimiter && !quoted) {
            row.push(value); value = '';
        } else if ((char === '\n' || char === '\r') && !quoted) {
            if (char === '\r' && text[i + 1] === '\n') i += 1;
            row.push(value); value = '';
            if (row.some((cell) => String(cell).trim())) rows.push(row);
            row = [];
        } else value += char;
    }
    row.push(value);
    if (row.some((cell) => String(cell).trim())) rows.push(row);
    return rows;
};

const sheetRows = async (file, format) => {
    if (format === 'csv') return parseCsv(file.buffer.toString('utf8').replace(/^\uFEFF/, ''));
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [];
    const rows = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
        rows.push(row.values.slice(1).map((cell) => {
            if (cell == null) return '';
            if (cell instanceof Date) return cell.toISOString();
            if (typeof cell === 'object' && Object.prototype.hasOwnProperty.call(cell, 'text')) return cell.text;
            if (typeof cell === 'object' && Object.prototype.hasOwnProperty.call(cell, 'result')) return cell.result;
            return String(cell);
        }));
    });
    return rows;
};

const valueFromMapping = (record, headers, mapping, field) => {
    const configured = mapping?.[field];
    if (configured === undefined || configured === null || configured === '') return record[field];
    if (Number.isInteger(configured)) return record[headers[configured]];
    return record[String(configured)];
};

const normalizeImportRows = (matrix, mapping, actorUserId) => {
    if (!matrix.length) return [];
    const headers = matrix[0].map((value, index) => String(value || `columna_${index + 1}`).trim());
    return matrix.slice(1).map((cells, index) => {
        const original = Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] ?? '']));
        const get = (field) => valueFromMapping(original, headers, mapping, field);
        const nombre = nullableText(get('nombre'));
        const telefono = nullableText(get('telefono'));
        const latitud = nullableNumber(get('latitud'));
        const longitud = nullableNumber(get('longitud'));
        const tipoInput = nullableText(get('tipo')) || 'odontologo';
        const etapaInput = nullableText(get('etapa')) || 'nuevo';
        const errors = [];
        if (!nombre) errors.push({ field: 'nombre', message: 'Nombre requerido' });
        if (!TYPES.has(tipoInput)) errors.push({ field: 'tipo', message: 'Tipo no válido' });
        if (!STAGES.has(etapaInput)) errors.push({ field: 'etapa', message: 'Etapa no válida' });
        if (Number.isNaN(latitud) || (latitud != null && (latitud < -90 || latitud > 90))) errors.push({ field: 'latitud', message: 'Latitud no válida' });
        if (Number.isNaN(longitud) || (longitud != null && (longitud < -180 || longitud > 180))) errors.push({ field: 'longitud', message: 'Longitud no válida' });
        if ((latitud == null) !== (longitud == null)) errors.push({ field: 'coordenadas', message: 'Latitud y longitud deben informarse juntas' });
        const origen = nullableText(get('origen')) || 'importacion';
        return {
            rowNumber: index + 2,
            original,
            errors,
            normalized: {
                nombre,
                nombre_normalizado: normalizeName(nombre),
                tipo: tipoInput,
                telefono,
                telefono_normalizado: normalizePhone(telefono) || null,
                email: nullableText(get('email')),
                direccion: nullableText(get('direccion')),
                latitud: Number.isNaN(latitud) ? null : latitud,
                longitud: Number.isNaN(longitud) ? null : longitud,
                origen,
                origen_id: nullableText(get('origen_id')),
                responsable_id: nullableNumber(get('responsable_id')) || actorUserId,
                etapa: etapaInput,
                notas: nullableText(get('notas'))
            }
        };
    });
};

const upcomingBirthday = (birthDate, todayIso) => {
    const match = String(birthDate || '').match(/^\d{4}-(\d{2})-(\d{2})/);
    if (!match) return null;
    const today = new Date(`${todayIso}T00:00:00Z`);
    const year = today.getUTCFullYear();
    const month = Number(match[1]); const day = Number(match[2]);
    const safeDate = (targetYear) => {
        const last = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
        return new Date(Date.UTC(targetYear, month - 1, Math.min(day, last)));
    };
    let next = safeDate(year);
    if (next < today) next = safeDate(year + 1);
    const days = Math.floor((next - today) / 86400000);
    return { fecha: next.toISOString().slice(0, 10), dias: days };
};

const validateEstablishment = (input, partial = false) => {
    if (!partial && !nullableText(input.nombre)) return 'Nombre es requerido';
    if (input.nombre !== undefined && !nullableText(input.nombre)) return 'Nombre es requerido';
    if (input.tipo !== undefined && !TYPES.has(input.tipo)) return 'Tipo no válido';
    if (input.etapa !== undefined && !STAGES.has(input.etapa)) return 'Etapa no válida';
    const lat = nullableNumber(input.latitud); const lng = nullableNumber(input.longitud);
    if (Number.isNaN(lat) || (lat != null && (lat < -90 || lat > 90))) return 'Latitud no válida';
    if (Number.isNaN(lng) || (lng != null && (lng < -180 || lng > 180))) return 'Longitud no válida';
    if (!partial && (lat == null) !== (lng == null)) return 'Latitud y longitud deben informarse juntas';
    return null;
};

export const makeCrmService = ({ crmRepository }) => ({
    getSummary: async ({ user }) => {
        if (!can(user, STAFF_ROLES)) return failure('FORBIDDEN', 'No autorizado', 403);
        const [summary, alerts] = await Promise.all([
            crmRepository.getSummary({ user }),
            crmRepository.getAlerts({ user })
        ]);
        const today = limaDate();
        const birthdayCount = alerts.birthdays
            .map((row) => upcomingBirthday(row.fecha_nacimiento, today))
            .filter((value) => value && value.dias <= 30).length;
        return success({ ...summary, cumpleanos_proximos: birthdayCount });
    },

    listEstablishments: async ({ user, filters }) => can(user, STAFF_ROLES)
        ? success(await crmRepository.listEstablishments({ user, filters }))
        : failure('FORBIDDEN', 'No autorizado', 403),

    getEstablishment: async ({ user, id }) => {
        if (!can(user, STAFF_ROLES)) return failure('FORBIDDEN', 'No autorizado', 403);
        const value = await crmRepository.getEstablishment({ id, user });
        if (!value) return failure('NOT_FOUND', 'Establecimiento no encontrado', 404);
        if (user.tipo === 'visitador') {
            delete value.ruc;
            delete value.dni;
        }
        return success(value);
    },

    createEstablishment: async ({ user, body }) => {
        if (!can(user, STAFF_ROLES)) return failure('FORBIDDEN', 'No autorizado', 403);
        const error = validateEstablishment(body);
        if (error) return failure('BAD_REQUEST', error);
        const input = {
            ...body,
            nombre: nullableText(body.nombre), tipo: body.tipo || 'odontologo', etapa: body.etapa || 'nuevo',
            telefono: nullableText(body.telefono), email: nullableText(body.email), direccion: nullableText(body.direccion),
            latitud: nullableNumber(body.latitud), longitud: nullableNumber(body.longitud), origen_id: nullableText(body.origen_id),
            responsable_id: user.tipo === 'visitador' ? user.id : (body.responsable_id || user.id), notas: nullableText(body.notas)
        };
        return success(await crmRepository.createEstablishment({ input, actorUserId: user.id }), 201);
    },

    updateEstablishment: async ({ user, id, body }) => {
        if (!can(user, STAFF_ROLES)) return failure('FORBIDDEN', 'No autorizado', 403);
        if (user.tipo === 'visitador') {
            delete body.responsable_id;
            delete body.activo;
            delete body.origen_id;
        }
        const error = validateEstablishment(body, true);
        if (error) return failure('BAD_REQUEST', error);
        const value = await crmRepository.updateEstablishment({ id, input: body, user });
        return value ? success(value) : failure('NOT_FOUND', 'Establecimiento no encontrado o sin cambios', 404);
    },

    deleteEstablishment: async ({ user, id }) => {
        if (!can(user, ADMIN_ROLES)) return failure('FORBIDDEN', 'Solo administradores pueden dar de baja', 403);
        const value = await crmRepository.updateEstablishment({ id, input: { activo: false }, user });
        return value ? success(value) : failure('NOT_FOUND', 'Establecimiento no encontrado', 404);
    },

    assignEstablishment: async ({ user, id, body }) => {
        if (!can(user, MANAGER_ROLES)) return failure('FORBIDDEN', 'No autorizado', 403);
        const responsableId = Number(body.responsable_id);
        if (!Number.isInteger(responsableId) || responsableId <= 0) return failure('BAD_REQUEST', 'responsable_id inválido');
        const value = await crmRepository.assignEstablishment({ id, responsableId });
        if (value?.invalidResponsible) return failure('BAD_REQUEST', 'Responsable inválido');
        return value ? success(value) : failure('NOT_FOUND', 'Establecimiento no encontrado', 404);
    },

    convertEstablishment: async ({ user, id, body }) => {
        if (!can(user, STAFF_ROLES)) return failure('FORBIDDEN', 'No autorizado', 403);
        const input = { ...body };
        if (user.tipo === 'visitador') {
            delete input.ruc;
            delete input.dni;
            delete input.razon_social;
        }
        const converted = await crmRepository.convertEstablishment({ id, input, user });
        if (converted.notFound) return failure('NOT_FOUND', 'Establecimiento no encontrado', 404);
        if (converted.invalidPrincipal) return failure('BAD_REQUEST', 'El doctor principal no existe o está inactivo');
        if (converted.missingContact) return failure('BAD_REQUEST', 'Se requiere teléfono de clínica o doctor principal con teléfono');
        if (user.tipo === 'visitador' && converted.clinic) {
            delete converted.clinic.ruc;
            delete converted.clinic.dni;
            delete converted.clinic.razon_social;
        }
        return success(converted, converted.created ? 201 : 200);
    },

    listComplaints: async ({ user, filters }) => can(user, STAFF_ROLES)
        ? success(await crmRepository.listComplaints({ user, filters }))
        : failure('FORBIDDEN', 'No autorizado', 403),

    createComplaint: async ({ user, body }) => {
        if (!can(user, STAFF_ROLES)) return failure('FORBIDDEN', 'No autorizado', 403);
        if (!body.establecimiento_id || !nullableText(body.motivo)) return failure('BAD_REQUEST', 'Establecimiento y motivo son requeridos');
        const value = await crmRepository.createComplaint({ input: { ...body, motivo: nullableText(body.motivo), detalle: nullableText(body.detalle) }, actorUserId: user.id, user });
        return value ? success(value, 201) : failure('NOT_FOUND', 'Establecimiento no encontrado', 404);
    },

    updateComplaint: async ({ user, id, body }) => {
        if (!can(user, STAFF_ROLES)) return failure('FORBIDDEN', 'No autorizado', 403);
        if (body.estado !== undefined && body.estado !== 'resuelto') return failure('BAD_REQUEST', 'Solo se permite cerrar un reclamo como resuelto');
        const value = await crmRepository.updateComplaint({ id, input: body, actorUserId: user.id, user });
        return value ? success(value) : failure('NOT_FOUND', 'Reclamo no encontrado o sin cambios', 404);
    },

    listVisits: async ({ user, filters }) => can(user, STAFF_ROLES)
        ? success(await crmRepository.listVisits({ user, filters }))
        : failure('FORBIDDEN', 'No autorizado', 403),

    createVisit: async ({ user, body }) => {
        if (!can(user, STAFF_ROLES)) return failure('FORBIDDEN', 'No autorizado', 403);
        if (!body.establecimiento_id) return failure('BAD_REQUEST', 'establecimiento_id es requerido');
        if (body.estado && !VISIT_STATES.has(body.estado)) return failure('BAD_REQUEST', 'Estado de visita no válido');
        if (!body.programada_para && ['programada','reprogramada'].includes(body.estado || 'programada')) return failure('BAD_REQUEST', 'programada_para es requerida');
        const value = await crmRepository.createVisit({ input: body, actorUserId: user.id, user });
        if (value?.invalidResponsible) return failure('BAD_REQUEST', 'Responsable inválido');
        return value ? success(value, 201) : failure('NOT_FOUND', 'Establecimiento no encontrado', 404);
    },

    updateVisit: async ({ user, id, body }) => {
        if (!can(user, STAFF_ROLES)) return failure('FORBIDDEN', 'No autorizado', 403);
        if (body.estado && !VISIT_STATES.has(body.estado)) return failure('BAD_REQUEST', 'Estado de visita no válido');
        const input = { ...body };
        const currentVisit = await crmRepository.getVisit({ id, user });
        if (!currentVisit) return failure('NOT_FOUND', 'Visita no encontrada', 404);
        if (body.estado === 'en_curso' && !body.iniciada_at) input.iniciada_at = new Date().toISOString();
        if (['completada','sin_contacto'].includes(body.estado)) {
            if (!body.completada_at) input.completada_at = new Date().toISOString();
            if (!body.proxima_visita_at) {
                const current = await crmRepository.getEstablishment({ id: currentVisit.establecimiento_id, user });
                if (current) {
                    const health = calculateCommercialHealth({ lastOrderDate: current.last_order_date, openComplaint: current.open_complaints > 0 });
                    const suggested = suggestNextVisitDate({ health: health.health, openComplaint: current.open_complaints > 0 });
                    if (suggested) input.proxima_visita_at = `${suggested}T09:00:00-05:00`;
                }
            }
        }
        const value = await crmRepository.updateVisit({ id, input, user });
        if (value?.invalidResponsible) return failure('BAD_REQUEST', 'Responsable inválido');
        return value ? success(value) : failure('NOT_FOUND', 'Visita no encontrada o sin cambios', 404);
    },

    getAlerts: async ({ user }) => {
        if (!can(user, STAFF_ROLES)) return failure('FORBIDDEN', 'No autorizado', 403);
        const raw = await crmRepository.getAlerts({ user });
        const today = limaDate();
        const birthdays = raw.birthdays.map((row) => ({ ...row, proximo_cumpleanos: upcomingBirthday(row.fecha_nacimiento, today) }))
            .filter((row) => row.proximo_cumpleanos && row.proximo_cumpleanos.dias <= 30)
            .sort((a, b) => a.proximo_cumpleanos.dias - b.proximo_cumpleanos.dias);
        return success({
            vencidas: raw.visits.filter((v) => v.grupo === 'vencida'),
            hoy: raw.visits.filter((v) => v.grupo === 'hoy'),
            proximas: raw.visits.filter((v) => v.grupo === 'proxima'),
            cumpleanos: birthdays
        });
    },

    previewImport: async ({ user, file, mapping }) => {
        if (!can(user, ADMIN_ROLES)) return failure('FORBIDDEN', 'Solo administradores pueden importar', 403);
        if (!file) return failure('BAD_REQUEST', 'Archivo requerido');
        const extension = file.originalname.toLowerCase().split('.').pop();
        const format = extension === 'csv' ? 'csv' : extension === 'xlsx' ? 'xlsx' : null;
        if (!format) return failure('BAD_REQUEST', 'Solo se admiten archivos CSV o XLSX');
        let matrix;
        try { matrix = await sheetRows(file, format); }
        catch { return failure('BAD_REQUEST', 'No se pudo leer el archivo'); }
        if (matrix.length < 2) return failure('BAD_REQUEST', 'El archivo no contiene filas de datos');
        if (matrix.length > 10001) return failure('BAD_REQUEST', 'El archivo supera el límite de 10,000 filas');
        const rows = normalizeImportRows(matrix, mapping || {}, user.id);
        return success(await crmRepository.createImportPreview({ fileName: file.originalname, format, mapping: mapping || {}, rows, actorUserId: user.id }), 201);
    },

    getImport: async ({ user, id }) => {
        if (!can(user, ADMIN_ROLES)) return failure('FORBIDDEN', 'Solo administradores pueden importar', 403);
        const value = await crmRepository.getImport({ id, user });
        return value ? success(value) : failure('NOT_FOUND', 'Importación no encontrada', 404);
    },

    commitImport: async ({ user, id, body }) => {
        if (!can(user, ADMIN_ROLES)) return failure('FORBIDDEN', 'Solo administradores pueden importar', 403);
        const ids = body.approved_row_ids;
        if (ids !== undefined && (!Array.isArray(ids) || ids.some((value) => !Number.isInteger(Number(value))))) return failure('BAD_REQUEST', 'approved_row_ids debe ser un arreglo de IDs');
        const value = await crmRepository.commitImport({ id, approvedRowIds: ids?.map(Number), actorUserId: user.id });
        return value.notFound ? failure('NOT_FOUND', 'Importación no encontrada', 404) : success(value);
    }
});

export const crmServiceTesting = { parseCsv, normalizeImportRows, upcomingBirthday, validateEstablishment };
