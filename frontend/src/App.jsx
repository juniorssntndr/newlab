import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './state/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import { canAccessFinancialModules, isAdminRole, isClientRole } from './utils/accessControl.js';
import Login from './pages/Login.jsx';
import AffinixLanding from './pages/AffinixLanding.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clinicas from './pages/Clinicas.jsx';
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

import Almacen from './pages/Almacen.jsx';
import CalendarioCliente from './pages/CalendarioCliente.jsx';
import CatalogoCliente from './pages/CatalogoCliente.jsx';

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

const LabOnlyRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <LoadingScreen />;
    if (isClientRole(user)) return <Navigate to="/pedidos" replace />;
    return children;
};

const AdminOnlyRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <LoadingScreen />;
    if (!isAdminRole(user)) return <Navigate to="/dashboard" replace />;
    return children;
};

const FinancialAccessRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <LoadingScreen />;
    if (!canAccessFinancialModules(user)) return <Navigate to="/dashboard" replace />;
    return children;
};

const App = () => {
    return (
        <>
            <Toaster position="top-right" />
            <Routes>
                <Route path="/" element={<AffinixLanding />} />
                <Route path="/login" element={<Login />} />
                <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    <Route path="dashboard" element={<LabOnlyRoute><Dashboard /></LabOnlyRoute>} />
                    <Route path="clinicas" element={<LabOnlyRoute><Clinicas /></LabOnlyRoute>} />
                    <Route path="productos" element={<LabOnlyRoute><Productos /></LabOnlyRoute>} />
                    <Route path="almacen" element={<LabOnlyRoute><Almacen /></LabOnlyRoute>} />
                    <Route path="pedidos" element={<Pedidos />} />
                    <Route path="pedidos/nuevo" element={<NuevoPedido />} />
                    <Route path="pedidos/:id" element={<DetallePedido />} />
                    <Route path="finanzas" element={<FinancialAccessRoute><Finanzas /></FinancialAccessRoute>} />
                    <Route path="caja-gastos" element={<FinancialAccessRoute><CajaGastos /></FinancialAccessRoute>} />
                    <Route path="finanzas/:id" element={<FinancialAccessRoute><DetalleFinanza /></FinancialAccessRoute>} />
                    <Route path="finanzas/:id/facturar" element={<FinancialAccessRoute><FacturarPedido /></FinancialAccessRoute>} />
                    <Route path="calendario" element={<LabOnlyRoute><Calendario /></LabOnlyRoute>} />
                    <Route path="mi-calendario" element={<CalendarioCliente />} />
                    <Route path="catalogo" element={<CatalogoCliente />} />
                    <Route path="cuenta" element={<Cuenta />} />
                    <Route path="equipo" element={<AdminOnlyRoute><Equipo /></AdminOnlyRoute>} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </>
    );
};

export default App;
