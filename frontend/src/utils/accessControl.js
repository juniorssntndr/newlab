export const SYSTEM_MODULES = [
    { id: 'dashboard', label: 'Dashboard', icon: 'bi-grid-1x2', desc: 'Métricas, KPIs y rendimiento operativo' },
    { id: 'pedidos', label: 'Gestión de Pedidos', icon: 'bi-clipboard2-pulse', desc: 'Recepción, diseño CAD/CAM, producción y entregas' },
    { id: 'caja', label: 'Caja y Facturación', icon: 'bi-wallet2', desc: 'Aperturas de caja, cobros, egresos y comprobantes' },
    { id: 'cobros', label: 'Gestión de Cobros', icon: 'bi-cash-stack', desc: 'Cartera de clínicas, saldos deudores y pagos consolidados' },
    { id: 'calendario', label: 'Calendario', icon: 'bi-calendar3', desc: 'Agenda de entregas, pruebas y visitas comerciales' },
    { id: 'crm', label: 'Gestión de Clientes', icon: 'bi-person-lines-fill', desc: 'CRM, mapa territorial, doctores, visitas y prospectos' },
    { id: 'marketing', label: 'Marketing', icon: 'bi-megaphone', desc: 'Cupones de descuento, ruleta de visitas/eventos y fidelización' },
    { id: 'catalogo', label: 'Catálogo', icon: 'bi-box-seam', desc: 'Catálogo de trabajos dentales, materiales y precios' },
    { id: 'almacen', label: 'Almacén', icon: 'bi-boxes', desc: 'Inventario físico, stock de insumos y consumos' },
    { id: 'usuarios', label: 'Gestión de Usuarios', icon: 'bi-people', desc: 'Equipo interno, perfiles, permisos y clientes con portal' },
];

export const DEFAULT_ROLE_MODULES = {
    admin: ['dashboard', 'pedidos', 'caja', 'cobros', 'calendario', 'crm', 'marketing', 'catalogo', 'almacen', 'usuarios', 'cuenta'],
    socio: ['dashboard', 'pedidos', 'caja', 'cobros', 'calendario', 'crm', 'marketing', 'catalogo', 'cuenta'],
    tecnico: ['pedidos', 'catalogo', 'almacen', 'calendario', 'cuenta'],
    operador: ['caja', 'pedidos', 'calendario', 'crm', 'catalogo', 'cuenta'],
    visitador: ['crm', 'marketing', 'calendario', 'cuenta'],
    cliente: ['pedidos_cliente', 'catalogo_cliente', 'cuenta'],
};

export const isAdminRole = (user) => user?.tipo === 'admin';

export const isPartnerRole = (user) => user?.tipo === 'socio' || user?.rol?.toLowerCase().includes('socio');

export const isOperatorRole = (user) => user?.tipo === 'operador';

export const isTechnicianRole = (user) => user?.tipo === 'tecnico';

export const isVisitorRole = (user) => user?.tipo === 'visitador';

export const isClientRole = (user) => user?.tipo === 'cliente';

/** Staff interno del laboratorio (admin, socio, operador, técnico). */
export const isLabStaffRole = (user) =>
    ['admin', 'socio', 'operador', 'tecnico', 'visitador'].includes(user?.tipo);

/**
 * Validador principal granular: comprueba si el usuario tiene acceso a un módulo específico.
 * Prioridad:
 * 1. Admin siempre tiene acceso total.
 * 2. Sobreescritura individual en `permisos_modulos`.
 * 3. Array `modulos` devuelto por autenticación.
 * 4. Plantilla predeterminada según su rol.
 */
export const canAccessModule = (user, moduleId) => {
    if (!user) return false;
    if (user.tipo === 'admin') return true;

    if (user.permisos_modulos) {
        if (Array.isArray(user.permisos_modulos)) {
            return user.permisos_modulos.includes(moduleId);
        }
        if (typeof user.permisos_modulos === 'object' && user.permisos_modulos[moduleId] !== undefined) {
            return Boolean(user.permisos_modulos[moduleId]);
        }
    }

    if (Array.isArray(user.modulos)) {
        return user.modulos.includes(moduleId);
    }

    const roleKey = user.tipo;
    const allowed = DEFAULT_ROLE_MODULES[roleKey];
    if (Array.isArray(allowed)) {
        return allowed.includes(moduleId);
    }

    return false;
};

/** Caja, Gastos y Cobranzas. */
export const canAccessFinancialModules = (user) =>
    canAccessModule(user, 'caja') || canAccessModule(user, 'cobros');

/** Producción técnica, catálogo y almacén. */
export const canAccessLabProduction = (user) =>
    canAccessModule(user, 'catalogo') || canAccessModule(user, 'almacen') || canAccessModule(user, 'pedidos');

/** Módulo CRM. */
export const canAccessCrm = (user) =>
    canAccessModule(user, 'crm');

/** Administración estructural de CRM (importar, convertir prospecto, fusionar, reasignar). */
export const canAdministerCrm = (user) =>
    isAdminRole(user) || isPartnerRole(user);

/** KPIs financieros y Reportes contables globales. */
export const canAccessFinanceDashboard = (user) =>
    canAccessModule(user, 'dashboard');

export const canAccessReports = (user) =>
    canAccessModule(user, 'dashboard') || isAdminRole(user);

/** Cierres diarios/mensuales de caja y reversiones auditadas: Admin y Socio. */
export const canPerformDailyClose = (user) =>
    isAdminRole(user) || isPartnerRole(user);

/** Gestión de proveedores y configuración de sistema: solo Admin. */
export const canManageProviders = (user) =>
    isAdminRole(user);

export const canManageUsers = (user) =>
    canAccessModule(user, 'usuarios');

