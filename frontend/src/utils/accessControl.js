export const isAdminRole = (user) => user?.tipo === 'admin';

export const isClientRole = (user) => user?.tipo === 'cliente';

export const canAccessFinancialModules = (user) => isAdminRole(user);
