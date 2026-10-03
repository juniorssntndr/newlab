import multer from 'multer';
import path from 'path';

const approvalMulter = multer({
    storage: multer.memoryStorage(),
    limits: { files: 1, fileSize: 50 * 1024 * 1024 }, // 50 MB
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (ext === '.html' || ext === '.htm' || file.mimetype === 'text/html') {
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
            next();
        });
    }
    next();
};
