export function notificationData(value) {
    if (value && typeof value === 'object') return value;
    if (typeof value === 'string') { try { return JSON.parse(value) || {}; } catch { return {}; } }
    return {};
}
export function shouldShowNotificationToast(item, now = new Date()) {
    const data = notificationData(item.data);
    if (!['campana_marketing', 'prueba_campana'].includes(item.tipo)) return true;
    if (data.mostrar_toast_in_app === false) return false;
    return !data.fecha_fin || new Date(data.fecha_fin) >= now;
}
