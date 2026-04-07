const parseBooleanEnv = (value, defaultValue) => {
    if (value === undefined) {
        return defaultValue;
    }

    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
        return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
        return false;
    }

    return defaultValue;
};

export const API_URL = import.meta.env.VITE_API_URL || '/api';
export const FINANCE_QUERY_ROLLOUT_ENABLED = parseBooleanEnv(import.meta.env.VITE_FINANCE_QUERY_ROLLOUT, true);
export const FINANCE_READ_FALLBACK_ENABLED = parseBooleanEnv(import.meta.env.VITE_FINANCE_READ_FALLBACK, true);
