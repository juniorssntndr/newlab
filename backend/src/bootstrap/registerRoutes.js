import authRoutes from '../routes/auth.js';
import clinicasRoutes from '../routes/clinicas.js';
import productosRoutes from '../routes/productos.js';
import pedidosRoutes from '../routes/pedidos.js';
import finanzasRoutes from '../routes/finanzas.js';
import dashboardRoutes from '../routes/dashboard.js';
import notificacionesRoutes from '../routes/notificaciones.js';
import categoriasRoutes from '../routes/categorias.js';
import inventoryRoutes from '../routes/inventory.js';
import usuariosRoutes from '../routes/usuarios.js';
import auditRoutes from '../routes/audit.js';
import facturacionRoutes from '../routes/facturacion.js';
import consultasRoutes from '../routes/consultas.js';

export const registerRoutes = (app, compositionRoot) => {
    app.use('/api/auth', authRoutes);
    app.use('/api/clinicas', clinicasRoutes);
    app.use('/api/productos', productosRoutes);
    app.use('/api/pedidos', pedidosRoutes);
    app.use('/api/finanzas', finanzasRoutes);
    app.use('/api/dashboard', dashboardRoutes);
    app.use('/api/notificaciones', notificacionesRoutes);
    app.use('/api/categorias', categoriasRoutes);
    app.use('/api/inventory', inventoryRoutes);
    app.use('/api/usuarios', usuariosRoutes);
    app.use('/api/audit', auditRoutes);
    app.use('/api/facturacion', facturacionRoutes);
    app.use('/api/consultas', consultasRoutes);

    if (compositionRoot?.modules?.orders?.orderRoutes) {
        app.use('/api/pedidos-v2', compositionRoot.modules.orders.orderRoutes);
    }

    if (compositionRoot?.modules?.finance?.financeRoutes) {
        app.use('/api/finanzas-v2', compositionRoot.modules.finance.financeRoutes);
    }

    if (compositionRoot?.modules?.dashboard?.dashboardRoutes) {
        app.use('/api/dashboard-v2', compositionRoot.modules.dashboard.dashboardRoutes);
    }
};
