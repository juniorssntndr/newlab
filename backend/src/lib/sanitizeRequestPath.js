export const sanitizeRequestPath = (requestPath = '') => {
    const value = String(requestPath);
    return value.replace(/(\/viewer\/(?:session|document)\/)[^/?#]+/i, '$1[redacted]');
};
