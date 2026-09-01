import { Router } from 'express';
import multer from 'multer';
import { authenticateToken } from '../../../../middleware/auth.js';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, callback) => {
        const valid = /\.(csv|xlsx)$/i.test(file.originalname);
        const error = valid ? null : Object.assign(new Error('Solo se admiten archivos CSV o XLSX'), { status: 400 });
        callback(error, valid);
    }
});

export const makeCrmRoutes = ({ crmController }) => {
    const router = Router();
    router.use(authenticateToken);

    router.get('/resumen', crmController.getSummary);
    router.get('/alertas', crmController.getAlerts);
    router.get('/establecimientos', crmController.listEstablishments);
    router.post('/establecimientos', crmController.createEstablishment);
    router.patch('/establecimientos/:id/asignacion', crmController.assignEstablishment);
    router.post('/establecimientos/:id/convertir', crmController.convertEstablishment);
    router.get('/establecimientos/:id', crmController.getEstablishment);
    router.patch('/establecimientos/:id', crmController.updateEstablishment);
    router.delete('/establecimientos/:id', crmController.deleteEstablishment);

    router.get('/reclamos', crmController.listComplaints);
    router.post('/reclamos', crmController.createComplaint);
    router.patch('/reclamos/:id', crmController.updateComplaint);

    router.get('/visitas', crmController.listVisits);
    router.post('/visitas', crmController.createVisit);
    router.patch('/visitas/:id', crmController.updateVisit);

    router.post('/importaciones/preview', upload.single('file'), crmController.previewImport);
    router.get('/importaciones/:id', crmController.getImport);
    router.post('/importaciones/:id/commit', crmController.commitImport);

    return router;
};
