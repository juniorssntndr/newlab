const safeSerialize = (value) => {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return { unserializable: true };
    }
};

const write = (level, message, meta = {}) => {
    const entry = {
        ts: new Date().toISOString(),
        level,
        message,
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
