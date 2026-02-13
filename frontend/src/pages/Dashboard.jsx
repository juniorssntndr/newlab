import React, { useState, useEffect } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { API_URL } from '../config.js';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const statusLabels = {
    pendiente: 'Pendiente', en_diseno: 'En Diseño', esperando_aprobacion: 'Esperando Aprobación',
    en_produccion: 'En Producción', terminado: 'Terminado', enviado: 'Enviado'
};
const statusColors = ['#F59E0B', '#8B5CF6', '#3B82F6', '#0891B2', '#10B981', '#6B7280'];

const Dashboard = () => {
    const { getHeaders } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API_URL}/dashboard/stats`, { headers: getHeaders() })
            .then(r => r.json())
            .then(data => { setStats(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div>
                <div className="page-header"><div className="page-header-left"><h1>Dashboard</h1></div></div>
                <div className="grid grid-cols-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 12 }} />)}
                </div>
            </div>
        );
    }

    const kpis = stats?.kpis || {};

    const kpiCards = [
        { label: 'Total Pedidos', value: kpis.total_pedidos, icon: 'bi-clipboard2-pulse', color: '#0891B2', bg: 'rgba(8,145,178,0.1)' },
        { label: 'Pendientes', value: kpis.pendientes, icon: 'bi-hourglass-split', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
        { label: 'En Producción', value: kpis.en_produccion, icon: 'bi-gear', color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
        { label: 'Clínicas Activas', value: kpis.clinicas_activas, icon: 'bi-building', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
    ];

    const doughnutData = {
        labels: (stats?.por_estado || []).map(e => statusLabels[e.estado] || e.estado),
        datasets: [{
            data: (stats?.por_estado || []).map(e => parseInt(e.count)),
            backgroundColor: statusColors.slice(0, (stats?.por_estado || []).length),
            borderWidth: 0, borderRadius: 4,
        }]
    };

    const barData = {
        labels: (stats?.ingresos_mensuales || []).map(m => {
            const d = new Date(m.mes);
            return d.toLocaleDateString('es-PE', { month: 'short' });
        }),
        datasets: [{
            label: 'Ingresos S/.',
            data: (stats?.ingresos_mensuales || []).map(m => parseFloat(m.total)),
            backgroundColor: 'rgba(8, 145, 178, 0.7)',
            borderRadius: 6, borderSkipped: false,
        }]
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Dashboard</h1>
                    <p>Resumen de tu laboratorio dental</p>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-4" style={{ marginBottom: 'var(--space-6)' }}>
                {kpiCards.map((kpi, i) => (
                    <div key={i} className="card kpi-card animate-slide-up" style={{ animationDelay: `${i * 80}ms` }}>
                        <div className="kpi-icon" style={{ background: kpi.bg, color: kpi.color }}>
                            <i className={`bi ${kpi.icon}`}></i>
                        </div>
                        <div className="kpi-value">{kpi.value ?? 0}</div>
                        <div className="kpi-label">{kpi.label}</div>
                    </div>
                ))}
            </div>

            {/* Charts & Recent */}
            <div className="grid grid-cols-3">
                {/* Doughnut */}
                <div className="card">
                    <div className="card-header"><h3 className="card-title">Pedidos por Estado</h3></div>
                    <div style={{ maxWidth: 240, margin: '0 auto' }}>
                        {(stats?.por_estado || []).length > 0 ? (
                            <Doughnut data={doughnutData} options={{
                                plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyle: 'circle', font: { size: 11 } } } },
                                cutout: '65%'
                            }} />
                        ) : (
                            <div className="empty-state"><p className="empty-state-text">Sin datos</p></div>
                        )}
                    </div>
                </div>

                {/* Bar chart */}
                <div className="card" style={{ gridColumn: 'span 2' }}>
                    <div className="card-header"><h3 className="card-title">Ingresos Mensuales</h3></div>
                    {(stats?.ingresos_mensuales || []).length > 0 ? (
                        <Bar data={barData} options={{
                            responsive: true,
                            plugins: { legend: { display: false } },
                            scales: {
                                x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                                y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 } } }
                            }
                        }} />
                    ) : (
                        <div className="empty-state"><p className="empty-state-text">Sin datos de ingresos</p></div>
                    )}
                </div>
            </div>

            {/* Recent Orders */}
            <div className="card" style={{ marginTop: 'var(--space-6)' }}>
                <div className="card-header">
                    <h3 className="card-title">Pedidos Recientes</h3>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/pedidos')}>Ver todos →</button>
                </div>
                {(stats?.recientes || []).length > 0 ? (
                    <div className="data-table-wrapper" style={{ border: 'none' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Código</th><th>Paciente</th><th>Clínica</th><th>Estado</th><th>Entrega</th><th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.recientes.map(p => (
                                    <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/pedidos/${p.id}`)}>
                                        <td><strong>{p.codigo}</strong></td>
                                        <td>{p.paciente_nombre}</td>
                                        <td>{p.clinica_nombre}</td>
                                        <td><span className={`badge badge-dot badge-${p.estado}`}>{statusLabels[p.estado]}</span></td>
                                        <td>{p.fecha_entrega}</td>
                                        <td><strong>S/. {parseFloat(p.total).toFixed(2)}</strong></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state">
                        <i className="bi bi-clipboard2 empty-state-icon"></i>
                        <p className="empty-state-text">No hay pedidos recientes</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
