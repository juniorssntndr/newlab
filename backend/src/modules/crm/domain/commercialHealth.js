const LIMA_TIME_ZONE = 'America/Lima';
const DAY_MS = 24 * 60 * 60 * 1000;

const toIsoDate = (value) => {
    if (value == null || value === '') return null;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
    return match?.[0] || null;
};

export const limaDate = (now = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: LIMA_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(now);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
};

export const differenceInCalendarDays = (laterDate, earlierDate) => {
    const later = toIsoDate(laterDate);
    const earlier = toIsoDate(earlierDate);
    if (!later || !earlier) return null;
    return Math.max(0, Math.floor((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / DAY_MS));
};

export const calculateCommercialHealth = ({ lastOrderDate, openComplaint = false, now = new Date() } = {}) => {
    const normalizedLastOrderDate = toIsoDate(lastOrderDate);
    if (!normalizedLastOrderDate) {
        return {
            health: null,
            visiblePriority: openComplaint ? 'rojo' : null,
            daysSinceLastOrder: null,
            reason: openComplaint ? 'reclamo abierto' : 'sin pedidos'
        };
    }

    const days = differenceInCalendarDays(limaDate(now), normalizedLastOrderDate);
    const health = days >= 60 ? 'rojo' : days >= 30 ? 'amarillo' : 'verde';
    return {
        health,
        visiblePriority: openComplaint ? 'rojo' : health,
        daysSinceLastOrder: days,
        reason: openComplaint ? 'reclamo abierto' : `${days} días sin pedido`
    };
};

export const visitCadenceDays = ({ health, openComplaint = false } = {}) => {
    if (openComplaint || health === 'rojo') return 7;
    if (health === 'amarillo') return 15;
    if (health === 'verde') return 45;
    return null;
};

export const suggestNextVisitDate = ({ health, openComplaint = false, from = new Date() } = {}) => {
    const cadence = visitCadenceDays({ health, openComplaint });
    if (!cadence) return null;
    const base = toIsoDate(from instanceof Date ? limaDate(from) : from);
    const next = new Date(`${base}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + cadence);
    return next.toISOString().slice(0, 10);
};

export const CRM_TIME_ZONE = LIMA_TIME_ZONE;
