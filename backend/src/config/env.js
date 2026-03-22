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

export const isProd = () => isProduction;
