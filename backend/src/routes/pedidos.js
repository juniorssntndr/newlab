import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticateToken, forbidRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createPedidoSchema } from '../validation/schemas.js';

const router = Router();
router.use(authenticateToken);
router.use(forbidRole('visitador'));

const ALLOWED_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.stl', '.obj', '.ply', '.pdf', '.zip'];

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (
            file.mimetype?.startsWith('image/') ||
            ALLOWED_EXTS.includes(ext) ||
            file.mimetype === 'application/pdf' ||
            file.mimetype === 'application/sla' ||
            file.mimetype === 'application/octet-stream' ||
            file.mimetype === 'model/stl'
        ) {
            cb(null, true);
        } else {
            cb(new Error('Formato no permitido. Se admiten fotos (PNG, JPG, WebP), modelos 3D (STL, OBJ, PLY) y documentos (PDF).'));
        }
    }
});

const getOrderController = (req) => req.app?.locals?.modules?.orders?.orderController;

const delegateToOrders = (controllerMethod) => async (req, res, next) => {
    const orderController = getOrderController(req);
    if (!orderController?.[controllerMethod]) {
        return res.status(503).json({ error: 'Orders module not available' });
    }

    return orderController[controllerMethod](req, res, next);
};

router.get('/', delegateToOrders('listOrders'));
router.get('/google/calendar/auth-url', delegateToOrders('getGoogleCalendarAuthUrl'));
router.post('/google/calendar/token', delegateToOrders('storeGoogleCalendarCode'));
router.get('/:id', delegateToOrders('getOrderDetail'));
router.post('/', validateBody(createPedidoSchema), delegateToOrders('createOrder'));
router.patch('/:id/estado', delegateToOrders('updateOrderStatus'));
router.post('/:id/aprobacion', delegateToOrders('createOrderApprovalLink'));
router.post('/:id/archivos', upload.single('image'), delegateToOrders('uploadOrderFile'));
router.patch('/:id/responsable', delegateToOrders('updateOrderResponsible'));
router.patch('/:id/fecha-entrega', delegateToOrders('updateOrderDeliveryDate'));
router.patch('/:id/aprobacion/:aprobacionId', delegateToOrders('respondOrderApproval'));
router.patch('/:id/aprobacion/:aprobacionId/meet', delegateToOrders('updateApprovalMeetLink'));

export default router;
