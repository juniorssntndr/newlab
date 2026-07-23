const TOKEN_PATTERNS = [
    /token=[^&\s"']+/gi,
    /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
    /Authorization:\s*[^\s,;]+/gi,
    /EXTERNAL_API_TOKEN=[^\s"']+/gi,
];

function redactString(str) {
    let out = str;
    for (const pattern of TOKEN_PATTERNS) {
        out = out.replace(pattern, '[REDACTED]');
    }
    return out;
}

function redactDeep(value) {
    if (typeof value === 'string') return redactString(value);
    if (Array.isArray(value)) return value.map(redactDeep);
    if (value !== null && typeof value === 'object') {
        const result = {};
        for (const [k, v] of Object.entries(value)) {
            const keyLower = k.toLowerCase();
            if (keyLower === 'token' || keyLower === 'authorization' || keyLower === 'external_api_token') {
                result[k] = '[REDACTED]';
            } else {
                result[k] = redactDeep(v);
            }
        }
        return result;
    }
    return value;
}

const safeSerialize = (value) => {
    try {
        return JSON.parse(JSON.stringify(redactDeep(value)));
    } catch {
        return { unserializable: true };
    }
};

const write = (level, message, meta = {}) => {
    const entry = {
        ts: new Date().toISOString(),
        level,
        message: typeof message === 'string' ? redactString(message) : message,
        ...safeSerialize(meta)
    };
    const payload = JSON.stringify(entry);
    if (level === 'error') {
        console.error(payload);
        return;
    }
    console.log(payload);
};

export const logger = {
    info: (message, meta) => write('info', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    error: (message, meta) => write('error', message, meta)
};
