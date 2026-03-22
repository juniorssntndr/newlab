import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createPedidoSchema } from '../validation/schemas.js';

const router = Router();
router.use(authenticateToken);

const getOrderController = (req) => req.app?.locals?.modules?.orders?.orderController;

const delegateToOrders = (controllerMethod) => async (req, res, next) => {
    const orderController = getOrderController(req);
    if (!orderController?.[controllerMethod]) {
        return res.status(503).json({ error: 'Orders module not available' });
    }

    return orderController[controllerMethod](req, res, next);
};

router.get('/', delegateToOrders('listOrders'));
router.get('/:id', delegateToOrders('getOrderDetail'));
router.post('/', validateBody(createPedidoSchema), delegateToOrders('createOrder'));
router.patch('/:id/estado', delegateToOrders('updateOrderStatus'));
router.post('/:id/aprobacion', delegateToOrders('createOrderApprovalLink'));
router.patch('/:id/responsable', delegateToOrders('updateOrderResponsible'));
router.patch('/:id/fecha-entrega', delegateToOrders('updateOrderDeliveryDate'));
router.patch('/:id/aprobacion/:aprobacionId', delegateToOrders('respondOrderApproval'));

export default router;
