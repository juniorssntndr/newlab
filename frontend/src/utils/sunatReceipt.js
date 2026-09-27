import QRCode from 'qrcode';

const UNIDADES_TEXT = [
    '', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
    'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE',
    'DIECIOCHO', 'DIECINUEVE', 'VEINTE'
];
const DECENAS_TEXT = ['', '', 'VEINTI', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS_TEXT = [
    '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
    'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'
];

const decenasToText = (n) => {
    if (n <= 20) return UNIDADES_TEXT[n];
    const d = Math.floor(n / 10);
    const u = n % 10;
    if (d === 2 && u > 0) return 'VEINTI' + UNIDADES_TEXT[u];
    return DECENAS_TEXT[d] + (u > 0 ? ' Y ' + UNIDADES_TEXT[u] : '');
};

const centenasToText = (n) => {
    if (n === 0) return '';
    if (n === 100) return 'CIEN';
    const c = Math.floor(n / 100);
    const resto = n % 100;
    let txt = c > 0 ? CENTENAS_TEXT[c] : '';
    if (resto > 0) txt += (txt ? ' ' : '') + decenasToText(resto);
    return txt;
};

const grupoToText = (n) => {
    if (n === 0) return '';
    if (n < 100) return decenasToText(n);
    return centenasToText(n);
};

export const numeroALetras = (monto, currency = { singular: 'SOL', plural: 'SOLES' }) => {
    const num = Math.abs(parseFloat(monto) || 0);
    const entero = Math.floor(num);
    const decimal = Math.round((num - entero) * 100);
    const decStr = String(decimal).padStart(2, '0');

    if (entero === 0) return `CERO CON ${decStr}/100 ${decimal === 1 ? currency.singular : currency.plural}`;

    const millones = Math.floor(entero / 1_000_000);
    const miles = Math.floor((entero % 1_000_000) / 1_000);
    const resto = entero % 1_000;

    let texto = '';
    if (millones > 0) {
        texto += (millones === 1 ? 'UN MILLÓN' : grupoToText(millones) + ' MILLONES') + ' ';
    }
    if (miles > 0) {
        texto += (miles === 1 ? 'UN MIL' : grupoToText(miles) + ' MIL') + ' ';
    }
    if (resto > 0) {
        texto += grupoToText(resto);
    }

    return `${texto.trim()} CON ${decStr}/100 ${entero === 1 ? currency.singular : currency.plural}`;
};

export const generateReceiptHash = (seed = '') => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${Date.now().toString(16).slice(-4)}`.toUpperCase();
};

export const buildSunatQRPayload = ({
    rucEmisor = '20616033973',
    tipoComprobante = '01',
    serie = 'TCK',
    correlativo = '000001',
    igv = 0,
    total = 0,
    fecha = new Date(),
    tipoDocReceptor = '1',
    numDocReceptor = '00000000',
    hash = 'AFINIX-DIGEST'
} = {}) => {
    const cleanFecha = fecha instanceof Date ? fecha.toISOString().split('T')[0] : String(fecha).split('T')[0];
    const cleanIgv = parseFloat(igv || 0).toFixed(2);
    const cleanTotal = parseFloat(total || 0).toFixed(2);
    const cleanTipoDoc = String(tipoDocReceptor || (numDocReceptor?.length === 11 ? '6' : '1'));

    return `${rucEmisor}|${tipoComprobante}|${serie}|${correlativo}|${cleanIgv}|${cleanTotal}|${cleanFecha}|${cleanTipoDoc}|${numDocReceptor || '-'}|${hash}|`;
};

export const generateQRCodeDataUrl = async (text, options = {}) => {
    if (!text) return '';
    try {
        return await QRCode.toDataURL(text, {
            width: options.width || 140,
            margin: options.margin !== undefined ? options.margin : 1,
            errorCorrectionLevel: options.errorCorrectionLevel || 'M',
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });
    } catch (err) {
        console.error('[sunatReceipt] Error al generar código QR:', err);
        return '';
    }
};
