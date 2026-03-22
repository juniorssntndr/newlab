import { Router } from 'express';
import { authenticateToken } from '../../../../middleware/auth.js';
import { validateBody } from '../../../../middleware/validate.js';
import { createPedidoSchema } from '../../../../validation/schemas.js';

export const makeOrderRoutes = ({ orderController }) => {
    const router = Router();

    router.use(authenticateToken);
    router.get('/', orderController.listOrders);
    router.get('/:id', orderController.getOrderDetail);
    router.post('/', validateBody(createPedidoSchema), orderController.createOrder);
    router.patch('/:id/estado', orderController.updateOrderStatus);
    router.post('/:id/aprobacion', orderController.createOrderApprovalLink);
    router.patch('/:id/responsable', orderController.updateOrderResponsible);
    router.patch('/:id/fecha-entrega', orderController.updateOrderDeliveryDate);
    router.patch('/:id/aprobacion/:aprobacionId', orderController.respondOrderApproval);

    return router;
};
