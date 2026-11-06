/**
 * Compresses an HTML file (e.g. 3D Exocad HTML viewer exports) using browser native gzip (CompressionStream).
 * Exocad 3D HTML exports consist of raw ASCII and base64 meshes, achieving ~75-85% compression ratio.
 * A 4.5 MB HTML compresses to ~800 KB, preventing upstream connection stalls and Cloudflare edge timeouts.
 *
 * @param {File} file
 * @returns {Promise<File>}
 */
export async function compressHtmlFile(file) {
    if (!file) return file;
    const isHtml = file.name.endsWith('.html') || file.name.endsWith('.htm') || file.type === 'text/html';
    if (!isHtml) return file;

    // Check if CompressionStream is supported by modern browsers
    if (typeof CompressionStream === 'undefined') {
        return file;
    }

    try {
        const stream = file.stream().pipeThrough(new CompressionStream('gzip'));
        const response = new Response(stream);
        const blob = await response.blob();

        // Only use compressed blob if it actually reduced the size
        if (blob.size >= file.size) {
            return file;
        }

        const compressedName = file.name.toLowerCase().endsWith('.gz') ? file.name : `${file.name}.gz`;
        return new File([blob], compressedName, {
            type: 'application/gzip',
            lastModified: file.lastModified || Date.now()
        });
    } catch (err) {
        console.warn('Error compressing HTML file, uploading uncompressed original:', err);
        return file;
    }
}
