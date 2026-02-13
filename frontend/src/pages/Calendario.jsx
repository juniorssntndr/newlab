import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config.js';

const statusLabels = {
    pendiente: 'Pendiente', en_diseno: 'En Diseño', esperando_aprobacion: 'Aprobación',
    en_produccion: 'Producción', terminado: 'Terminado', enviado: 'Enviado'
};

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const Calendario = () => {
    const { getHeaders } = useAuth();
    const navigate = useNavigate();
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        fetch(`${API_URL}/pedidos`, { headers: getHeaders() })
            .then(r => r.json())
            .then(data => { setPedidos(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7; // Monday-start

    const calendarDays = useMemo(() => {
        const days = [];
        // Previous month padding
        for (let i = startOffset - 1; i >= 0; i--) {
            const d = new Date(year, month, -i);
            days.push({ date: d, inMonth: false });
        }
        // Current month
        for (let d = 1; d <= lastDay.getDate(); d++) {
            days.push({ date: new Date(year, month, d), inMonth: true });
        }
        // Next month padding
        const remaining = 7 - (days.length % 7);
        if (remaining < 7) {
            for (let d = 1; d <= remaining; d++) {
                days.push({ date: new Date(year, month + 1, d), inMonth: false });
            }
        }
        return days;
    }, [year, month]);

    const getOrdersForDate = (date) => {
        const dateStr = date.toISOString().split('T')[0];
        return pedidos.filter(p => p.fecha_entrega === dateStr);
    };

    const today = new Date().toISOString().split('T')[0];

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const goToday = () => setCurrentDate(new Date());

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Calendario de Entregas</h1>
                    <p>Vista mensual de fechas de entrega</p>
                </div>
            </div>

            <div className="card">
                {/* Month navigation */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={prevMonth}><i className="bi bi-chevron-left"></i></button>
                        <h2 style={{ fontSize: '1.125rem', margin: 0 }}>{MONTHS[month]} {year}</h2>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={nextMonth}><i className="bi bi-chevron-right"></i></button>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={goToday}>Hoy</button>
                </div>

                {loading ? (
                    <div className="skeleton" style={{ height: 400, borderRadius: 8 }} />
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: 'var(--color-border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                        {/* Day headers */}
                        {DAYS.map(d => (
                            <div key={d} style={{ padding: 'var(--space-2)', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', background: 'var(--color-bg-alt)' }}>
                                {d}
                            </div>
                        ))}
                        {/* Calendar cells */}
                        {calendarDays.map((day, i) => {
                            const dateStr = day.date.toISOString().split('T')[0];
                            const isToday = dateStr === today;
                            const orders = getOrdersForDate(day.date);
                            return (
                                <div key={i} style={{
                                    minHeight: 80, padding: 'var(--space-2)',
                                    background: isToday ? 'rgba(8,145,178,0.06)' : 'var(--color-bg)',
                                    opacity: day.inMonth ? 1 : 0.4,
                                    position: 'relative'
                                }}>
                                    <div style={{
                                        fontSize: '0.8125rem', fontWeight: isToday ? 700 : 400,
                                        color: isToday ? 'var(--color-primary)' : 'var(--color-text)',
                                        marginBottom: 'var(--space-1)'
                                    }}>
                                        {day.date.getDate()}
                                    </div>
                                    {orders.slice(0, 3).map(o => (
                                        <div key={o.id}
                                            onClick={() => navigate(`/pedidos/${o.id}`)}
                                            style={{
                                                fontSize: '0.625rem', fontWeight: 500, padding: '2px 4px', borderRadius: 3,
                                                marginBottom: 2, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                background: `var(--status-${o.estado}-bg, var(--color-bg-alt))`,
                                                color: `var(--status-${o.estado}-color, var(--color-text))`
                                            }}
                                            title={`${o.codigo} - ${o.paciente_nombre}`}>
                                            {o.codigo}
                                        </div>
                                    ))}
                                    {orders.length > 3 && (
                                        <div style={{ fontSize: '0.625rem', color: 'var(--color-text-secondary)' }}>+{orders.length - 3} más</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Calendario;
