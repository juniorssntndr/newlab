export const isAdminRole = (user) => user?.tipo === 'admin';

export const isClientRole = (user) => user?.tipo === 'cliente';

export const isLabStaffRole = (user) => user?.tipo === 'admin' || user?.tipo === 'tecnico';

export const isVisitorRole = (user) => user?.tipo === 'visitador';

export const canAccessCrm = (user) =>
    user?.tipo === 'admin' || user?.tipo === 'tecnico' || user?.tipo === 'visitador';

export const canAccessLabProduction = (user) =>
    (user?.tipo === 'admin' || user?.tipo === 'tecnico') && !isVisitorRole(user);

/** Cobrar, finanzas de pedido y comprobantes: admin + técnico (cajero). */
export const canAccessFinancialModules = (user) => isLabStaffRole(user);

/** KPIs financieros globales del dashboard: solo socios/admin. */
export const canAccessFinanceDashboard = (user) => isAdminRole(user);

