/**
 * Optimizes an image File for web upload using Canvas.
 * Reduces 5MB+ camera photos or uncompressed PNGs down to ~100-250KB WebP,
 * making upload virtually instantaneous even on slow residential upstream internet.
 *
 * @param {File} file 
 * @param {object} [options]
 * @param {number} [options.maxWidth=1200]
 * @param {number} [options.maxHeight=1200]
 * @param {number} [options.quality=0.85]
 * @returns {Promise<File>}
 */
export async function optimizeImageForUpload(file, { maxWidth = 1200, maxHeight = 1200, quality = 0.85 } = {}) {
    if (!file || !file.type || !file.type.startsWith('image/')) return file;
    // Don't resize SVGs, GIFs or small files (< 150KB)
    if (file.type === 'image/svg+xml' || file.type === 'image/gif' || file.size < 150 * 1024) {
        return file;
    }

    return new Promise((resolve) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            let { width, height } = img;

            // If already within bounds and under 400KB, keep as-is
            if (width <= maxWidth && height <= maxHeight && file.size < 400 * 1024) {
                return resolve(file);
            }

            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(file);

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            const targetMime = 'image/webp';
            canvas.toBlob((blob) => {
                if (!blob || blob.size >= file.size) {
                    return resolve(file);
                }
                const newName = file.name.replace(/\.[^.]+$/, '.webp');
                const optimizedFile = new File([blob], newName, {
                    type: targetMime,
                    lastModified: Date.now()
                });
                resolve(optimizedFile);
            }, targetMime, quality);
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(file);
        };

        img.src = objectUrl;
    });
}
