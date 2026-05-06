const isProduction = process.env.NODE_ENV === 'production';

const requireEnv = (key) => {
    const value = process.env[key];
    if (!value || !value.trim()) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
};

export const getJwtSecret = () => {
    return requireEnv('JWT_SECRET');
};

export const getDatabaseUrl = () => requireEnv('DATABASE_URL');

export const getAllowedOrigins = () => {
    const raw = process.env.FRONTEND_ORIGIN || process.env.CORS_ORIGIN || '';
    return raw
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
};

export const getPort = () => parseInt(process.env.PORT || '3001', 10);

export const getRateLimitConfig = () => ({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || (isProduction ? '900000' : '60000'), 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || (isProduction ? '300' : '1000'), 10)
});

export const getSupabaseStorageConfig = () => ({
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    bucket: process.env.SUPABASE_STORAGE_BUCKET || 'product-images'
});

export const getSentryConfig = () => ({
    dsn: process.env.SENTRY_DSN || '',
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development'
});

const parseBooleanEnv = (rawValue, variableName, defaultValue = false) => {
    if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
        return defaultValue;
    }

    const normalized = String(rawValue).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;

    throw new Error(`Invalid boolean environment variable ${variableName}: ${rawValue}. Use true|false.`);
};

export const getUseNewBillingAcl = () => parseBooleanEnv(process.env.USE_NEW_BILLING_ACL, 'USE_NEW_BILLING_ACL', false);

export const getIgvFactor = () => parseFloat(process.env.IGV_FACTOR || '1.18');

export const isProd = () => isProduction;
