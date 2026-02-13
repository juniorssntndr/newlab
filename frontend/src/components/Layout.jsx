import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';
import NotificationsPanel from './NotificationsPanel.jsx';
import { useNotifications } from '../state/NotificationContext.jsx';

const Layout = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const { panelOpen } = useNotifications();

    return (
        <div className="app-layout">
            <Sidebar
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                mobileOpen={mobileOpen}
                onMobileClose={() => setMobileOpen(false)}
            />
            <main className={`app-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
                <Header onMenuClick={() => setMobileOpen(true)} />
                <div className="app-content">
                    <Outlet />
                </div>
            </main>
            {panelOpen && <NotificationsPanel />}
        </div>
    );
};

export default Layout;
