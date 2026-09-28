import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './state/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import {
    canAccessModule,
    isClientRole
} from './utils/accessControl.js';
import Login from './pages/Login.jsx';
import RegistroCliente from './pages/RegistroCliente.jsx';
import AfinixLanding from './pages/AfinixLanding.jsx';
import AfinixLandingV2 from './pages/AfinixLandingV2.jsx';
import AfinixSeoArticlePage from './pages/AfinixSeoArticlePage.jsx';
import { SEO_ARTICLE_PATHS } from './pages/afinixLanding/seoArticlesData.js';
import Dashboard from './pages/Dashboard.jsx';
import Productos from './pages/Productos.jsx';
import Pedidos from './pages/Pedidos.jsx';
import NuevoPedido from './pages/NuevoPedido.jsx';
import DetallePedido from './pages/DetallePedido.jsx';
import Finanzas from './pages/Finanzas.jsx';
import DetalleFinanza from './pages/DetalleFinanza.jsx';
import FacturarPedido from './pages/FacturarPedido.jsx';
import CajaGastos from './pages/CajaGastos.jsx';
import Calendario from './pages/Calendario.jsx';
import Cuenta from './pages/Cuenta.jsx';
import Equipo from './pages/Equipo.jsx';
import Marketing from './pages/Marketing.jsx';

import Almacen from './pages/Almacen.jsx';
import CalendarioCliente from './pages/CalendarioCliente.jsx';
import CatalogoCliente from './pages/CatalogoCliente.jsx';

import CrmResumenPage from './modules/crm/pages/CrmResumenPage.jsx';
import CrmClinicasPage from './modules/crm/pages/CrmClinicasPage.jsx';
import CrmDoctoresPage from './modules/crm/pages/CrmDoctoresPage.jsx';
import CrmProspectosPage from './modules/crm/pages/CrmProspectosPage.jsx';
import CrmVisitasPage from './modules/crm/pages/CrmVisitasPage.jsx';
import CrmMapaPage from './modules/crm/pages/CrmMapaPage.jsx';
import AgentInspector from './components/dev/AgentInspector.jsx';

const LoadingScreen = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--color-bg)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}></div>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Cargando sistema...</p>
        </div>
    </div>
);

const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <LoadingScreen />;
    if (!user) return <Navigate to="/login" replace />;
    return children;
};

const ModuleRoute = ({ module, children }) => {
    const { user, loading } = useAuth();
    if (loading) return <LoadingScreen />;
    if (!user) return <Navigate to="/login" replace />;
    if (!canAccessModule(user, module)) {
        if (isClientRole(user)) return <Navigate to="/pedidos" replace />;
        const fallback = canAccessModule(user, 'pedidos') ? '/pedidos' :
            canAccessModule(user, 'dashboard') ? '/dashboard' :
            canAccessModule(user, 'crm') ? '/crm/resumen' :
            canAccessModule(user, 'caja') ? '/caja-gastos' : '/cuenta';
        return <Navigate to={fallback} replace />;
    }
    return children;
};

const OrdersRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <LoadingScreen />;
    if (!user) return <Navigate to="/login" replace />;
    if (!isClientRole(user) && !canAccessModule(user, 'pedidos')) {
        return <Navigate to="/cuenta" replace />;
    }
    return children;
};

const App = () => {
    return (
        <>
            <Toaster position="top-right" />
            <Routes>
                <Route path="/" element={<AfinixLanding />} />
                <Route path="/landing-2" element={<AfinixLandingV2 />} />
                {SEO_ARTICLE_PATHS.map((seoPath) => (
                    <Route key={seoPath} path={seoPath} element={<AfinixSeoArticlePage path={seoPath} />} />
                ))}
                <Route path="/login" element={<Login />} />
                <Route path="/registro" element={<RegistroCliente />} />
                <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    <Route path="dashboard" element={<ModuleRoute module="dashboard"><Dashboard /></ModuleRoute>} />
                    <Route path="productos" element={<ModuleRoute module="catalogo"><Productos /></ModuleRoute>} />
                    <Route path="almacen" element={<ModuleRoute module="almacen"><Almacen /></ModuleRoute>} />
                    <Route path="pedidos" element={<OrdersRoute><Pedidos /></OrdersRoute>} />
                    <Route path="pedidos/nuevo" element={<OrdersRoute><NuevoPedido /></OrdersRoute>} />
                    <Route path="pedidos/:id" element={<OrdersRoute><DetallePedido /></OrdersRoute>} />
                    <Route path="finanzas" element={<ModuleRoute module="cobros"><Finanzas /></ModuleRoute>} />
                    <Route path="caja-gastos" element={<ModuleRoute module="caja"><CajaGastos /></ModuleRoute>} />
                    <Route path="caja-gastos/facturar" element={<ModuleRoute module="caja"><FacturarPedido /></ModuleRoute>} />
                    <Route path="caja-gastos/facturar/:id" element={<ModuleRoute module="caja"><FacturarPedido /></ModuleRoute>} />
                    <Route path="finanzas/:id" element={<ModuleRoute module="cobros"><DetalleFinanza /></ModuleRoute>} />
                    <Route path="finanzas/:id/facturar" element={<ModuleRoute module="caja"><FacturarPedido /></ModuleRoute>} />
                    <Route path="calendario" element={<ModuleRoute module="calendario"><Calendario /></ModuleRoute>} />
                    <Route path="mi-calendario" element={<CalendarioCliente />} />
                    <Route path="catalogo" element={<CatalogoCliente />} />
                    <Route path="cuenta" element={<Cuenta />} />
                    <Route path="equipo" element={<ModuleRoute module="usuarios"><Equipo /></ModuleRoute>} />
                    <Route path="usuarios" element={<ModuleRoute module="usuarios"><Equipo /></ModuleRoute>} />

                    {/* CRM Territorial Module */}
                    <Route path="crm" element={<Navigate to="/crm/resumen" replace />} />
                    <Route path="crm/resumen" element={<ModuleRoute module="crm"><CrmResumenPage /></ModuleRoute>} />
                    <Route path="crm/clinicas" element={<ModuleRoute module="crm"><CrmClinicasPage /></ModuleRoute>} />
                    <Route path="crm/doctores" element={<ModuleRoute module="crm"><CrmDoctoresPage /></ModuleRoute>} />
                    <Route path="crm/prospectos" element={<ModuleRoute module="crm"><CrmProspectosPage /></ModuleRoute>} />
                    <Route path="crm/visitas" element={<ModuleRoute module="crm"><CrmVisitasPage /></ModuleRoute>} />
                    <Route path="crm/mapa" element={<ModuleRoute module="crm"><CrmMapaPage /></ModuleRoute>} />

                    {/* Marketing & Gamification Module */}
                    <Route path="marketing" element={<ModuleRoute module="marketing"><Marketing /></ModuleRoute>} />

                    {/* Backward-compatibility Redirects */}
                    <Route path="clinicas" element={<Navigate to="/crm/clinicas" replace />} />
                    <Route path="doctores" element={<Navigate to="/crm/doctores" replace />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            {import.meta.env.DEV && <AgentInspector />}
        </>
    );
};

export default App;
