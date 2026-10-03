import { canManageOrderRepeats, validateRepeatInput, repeatError } from '../../domain/orderRepeat.js';

export const makeOrderRepeatService = ({ repeatRepository }) => {
    const run = async (user, action) => {
        if (!canManageOrderRepeats(user)) return { ok: false, type: 'FORBIDDEN', error: 'No autorizado' };
        try {
            return { ok: true, type: 'SUCCESS', data: await action() };
        } catch (error) {
            if (error.serviceType) return { ok: false, type: error.serviceType, error: error.message };
            throw error;
        }
    };
    return {
        getOrderRepeatQuote: ({ user, orderId }) => run(user, () => repeatRepository.quote(orderId)),
        createOrderRepeat: ({ user, orderId, body, files }) => run(user, () =>
            repeatRepository.create(orderId, user.id, validateRepeatInput(body, files))),
        getOrderRepeatPhoto: ({ user, orderId, photoId }) => run(user, async () => {
            const photo = await repeatRepository.readPhoto(orderId, photoId);
            if (!photo) throw repeatError('Foto no encontrada', 'NOT_FOUND');
            return photo;
        })
    };
};
