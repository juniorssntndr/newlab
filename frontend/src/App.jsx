import React from 'react';
import { Navigate, Route, Routes, Outlet } from 'react-router-dom';
import { useAuth } from './state/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clinicas from './pages/Clinicas.jsx';
import Productos from './pages/Productos.jsx';
import Pedidos from './pages/Pedidos.jsx';
import NuevoPedido from './pages/NuevoPedido.jsx';
import DetallePedido from './pages/DetallePedido.jsx';
import Calendario from './pages/Calendario.jsx';
import Cuenta from './pages/Cuenta.jsx';
import Equipo from './pages/Equipo.jsx';

import Almacen from './pages/Almacen.jsx';

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
    if (user?.tipo === 'cliente') return <Navigate to="/pedidos" replace />;
    return children;
};

const AdminOnlyRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <LoadingScreen />;
    if (user?.tipo !== 'admin') return <Navigate to="/dashboard" replace />;
    return children;
};

const HomeRedirect = () => {
    const { user, loading } = useAuth();
    if (loading) return <LoadingScreen />;
    return <Navigate to={user?.tipo === 'cliente' ? '/pedidos' : '/dashboard'} replace />;
};

const App = () => {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<HomeRedirect />} />
                <Route path="dashboard" element={<LabOnlyRoute><Dashboard /></LabOnlyRoute>} />
                <Route path="clinicas" element={<LabOnlyRoute><Clinicas /></LabOnlyRoute>} />
                <Route path="productos" element={<LabOnlyRoute><Productos /></LabOnlyRoute>} />
                <Route path="almacen" element={<LabOnlyRoute><Almacen /></LabOnlyRoute>} />
                <Route path="pedidos" element={<Pedidos />} />
                <Route path="pedidos/nuevo" element={<NuevoPedido />} />
                <Route path="pedidos/:id" element={<DetallePedido />} />
                <Route path="calendario" element={<LabOnlyRoute><Calendario /></LabOnlyRoute>} />
                <Route path="cuenta" element={<Cuenta />} />
                <Route path="equipo" element={<AdminOnlyRoute><Equipo /></AdminOnlyRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

export default App;
