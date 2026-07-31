import {
    formatObservacionesWithIntake,
    parseIntakeFromObservaciones,
} from '../wizard/orderWizardConstants.js';

const formatted = formatObservacionesWithIntake('recoleccion', 'Llamar a recepción');
if (!formatted.startsWith('[INGRESO:recoleccion]')) {
    throw new Error('intake prefix missing');
}
if (!formatted.includes('Llamar a recepción')) {
    throw new Error('note missing');
}

const parsed = parseIntakeFromObservaciones(formatted);
if (parsed.intakeMode !== 'recoleccion') {
    throw new Error(`expected recoleccion got ${parsed.intakeMode}`);
}
if (parsed.notes !== 'Llamar a recepción') {
    throw new Error(`unexpected notes: ${parsed.notes}`);
}

console.log('ok - order wizard intake helpers');
