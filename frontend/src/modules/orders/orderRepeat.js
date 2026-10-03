import { canAccessModule } from '../../utils/accessControl.js';

export const canRepeatOrder = (user, order) =>
    ['admin', 'socio', 'operador', 'tecnico'].includes(user?.tipo) &&
    canAccessModule(user, 'pedidos') && order?.estado === 'enviado';

export const buildRepeatFormData = ({ kind, reason, requestKey, chargeAgreed, total, photos }) => {
    const data = new FormData();
    data.append('kind', kind);
    data.append('reason', reason.trim());
    data.append('requestKey', requestKey);
    data.append('chargeAgreed', String(chargeAgreed));
    data.append('expectedTotal', String(kind === 'warranty' ? 0 : total));
    for (const photo of photos) data.append('photos', photo);
    return data;
};
