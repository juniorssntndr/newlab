import multer from 'multer';
import path from 'path';
import zlib from 'zlib';

const approvalMulter = multer({
    storage: multer.memoryStorage(),
    limits: { files: 1, fileSize: 50 * 1024 * 1024 }, // 50 MB
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (
            ext === '.html' ||
            ext === '.htm' ||
            ext === '.gz' ||
            file.mimetype === 'text/html' ||
            file.mimetype === 'application/gzip' ||
            file.mimetype === 'application/x-gzip'
        ) {
            return cb(null, true);
        }
        return cb(new Error('Formato no permitido. Para el visor 3D se requiere un archivo exportado HTML (.html).'));
    }
}).single('file');

export const handleOptionalApprovalUpload = (req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
        return approvalMulter(req, res, (error) => {
            if (error) {
                return res.status(400).json({ error: error.message || 'Error al procesar el archivo HTML' });
            }
            if (req.file?.buffer && req.file.buffer.length >= 2 && req.file.buffer[0] === 0x1f && req.file.buffer[1] === 0x8b) {
                try {
                    const decompressed = zlib.gunzipSync(req.file.buffer);
                    req.file.buffer = decompressed;
                    req.file.size = decompressed.length;
                    req.file.mimetype = 'text/html';
                    if (req.file.originalname?.toLowerCase().endsWith('.gz')) {
                        req.file.originalname = req.file.originalname.slice(0, -3);
                    }
                } catch (decompErr) {
                    return res.status(400).json({ error: 'El archivo comprimido está dañado o no es un gzip válido.' });
                }
            }
            next();
        });
    }
    next();
};
