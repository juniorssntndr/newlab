import multer from 'multer';
import { canManageOrderRepeats } from '../../domain/orderRepeat.js';

export const requireOrderRepeatStaff = (req, res, next) => {
    if (!canManageOrderRepeats(req.user)) return res.status(403).json({ error: 'No autorizado' });
    const validId = (value) => /^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 2147483647;
    if (!validId(req.params.id) || (req.params.photoId !== undefined && !validId(req.params.photoId))) {
        return res.status(400).json({ error: 'Identificador no válido' });
    }
    next();
};

const upload = multer({ storage: multer.memoryStorage(),
    limits: { files: 3, fileSize: 5 * 1024 * 1024, fields: 5, fieldSize: 4096, parts: 8 },
    fileFilter: (_req, file, cb) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
        ? cb(null, true) : cb(new Error('Formato no permitido'))
}).array('photos', 3);

export const uploadRepeatPhotos = (req, res, next) => upload(req, res, (error) => {
    if (error) return res.status(400).json({ error: 'Se admiten hasta 3 fotos JPG, PNG o WebP de 5 MB cada una.' });
    next();
});
