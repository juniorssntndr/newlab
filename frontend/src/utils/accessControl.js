export const isAdminRole = (user) => user?.tipo === 'admin';

export const isOperatorRole = (user) => user?.tipo === 'operador';

export const isTechnicianRole = (user) => user?.tipo === 'tecnico';

export const isVisitorRole = (user) => user?.tipo === 'visitador';

export const isClientRole = (user) => user?.tipo === 'cliente';

/** Staff interno del laboratorio (admin, operador, técnico). */
export const isLabStaffRole = (user) =>
    user?.tipo === 'admin' || user?.tipo === 'operador' || user?.tipo === 'tecnico';

/** Caja, Gastos y Cobranzas: solo Admin y Operador (Técnico no tiene acceso). */
export const canAccessFinancialModules = (user) =>
    user?.tipo === 'admin' || user?.tipo === 'operador';

/** Producción técnica, catálogo y pedidos operativos: Admin y Técnico. */
export const canAccessLabProduction = (user) =>
    user?.tipo === 'admin' || user?.tipo === 'tecnico';

/** Módulo CRM: Admin, Operador y Visitador (acotado por territorio). */
export const canAccessCrm = (user) =>
    user?.tipo === 'admin' || user?.tipo === 'operador' || user?.tipo === 'visitador';

/** Administración estructural de CRM (importar, convertir prospecto, fusionar, reasignar). */
export const canAdministerCrm = (user) => isAdminRole(user);

/** KPIs financieros y Reportes contables globales: solo Admin. */
export const canAccessFinanceDashboard = (user) => isAdminRole(user);

export const canAccessReports = (user) => isAdminRole(user);

/** Cierres diarios/mensuales de caja y reversiones auditadas: solo Admin. */
export const canPerformDailyClose = (user) => isAdminRole(user);

/** Gestión de proveedores y configuración de sistema: solo Admin. */
export const canManageProviders = (user) => isAdminRole(user);

export const canManageUsers = (user) => isAdminRole(user);
