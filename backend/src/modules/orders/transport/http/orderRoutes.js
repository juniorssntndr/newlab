import { Router } from 'express';
import { authenticateToken, forbidRole } from '../../../../middleware/auth.js';
import { validateBody } from '../../../../middleware/validate.js';
import { createPedidoSchema } from '../../../../validation/schemas.js';
import { requireOrderRepeatStaff, uploadRepeatPhotos } from './orderRepeatUpload.js';
import { handleOptionalApprovalUpload } from './orderApprovalUpload.js';

export const makeOrderRoutes = ({ orderController }) => {
    const router = Router();

    router.use(authenticateToken);
    router.use(forbidRole('visitador'));
    router.get('/', orderController.listOrders);
    router.get('/:id', orderController.getOrderDetail);
    router.post('/', validateBody(createPedidoSchema), orderController.createOrder);
    router.get('/:id/repeticion/cotizacion', requireOrderRepeatStaff, orderController.getOrderRepeatQuote);
    router.post('/:id/repeticion', requireOrderRepeatStaff, uploadRepeatPhotos, orderController.createOrderRepeat);
    router.get('/:id/repeticion/fotos/:photoId', requireOrderRepeatStaff, orderController.getOrderRepeatPhoto);
    router.patch('/:id/estado', orderController.updateOrderStatus);
    router.post('/:id/aprobacion', handleOptionalApprovalUpload, orderController.createOrderApprovalLink);
    router.patch('/:id/responsable', orderController.updateOrderResponsible);
    router.patch('/:id/fecha-entrega', orderController.updateOrderDeliveryDate);
    router.patch('/:id/aprobacion/:aprobacionId', orderController.respondOrderApproval);
    router.patch('/:id/aprobacion/:aprobacionId/meet', orderController.updateApprovalMeetLink);

    return router;
};
