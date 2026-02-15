import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config.js';
import '@fullcalendar/react/dist/vdom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';

const statusLabels = {
    pendiente: 'Pendiente', en_diseno: 'En Diseño', esperando_aprobacion: 'Aprobación',
    en_produccion: 'Producción', terminado: 'Terminado', enviado: 'Enviado'
};

const statusColors = {
    pendiente: '#F59E0B',
    en_diseno: '#8B5CF6',
    esperando_aprobacion: '#3B82F6',
    en_produccion: '#0891B2',
    terminado: '#10B981',
    enviado: '#6B7280'
};

const Calendario = () => {
    const { getHeaders } = useAuth();
    const navigate = useNavigate();
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCompact, setIsCompact] = useState(() => (
        typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
    ));

    useEffect(() => {
        fetch(`${API_URL}/pedidos`, { headers: getHeaders() })
            .then(r => r.json())
            .then(data => { setPedidos(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const media = window.matchMedia('(max-width: 768px)');
        const handleChange = (event) => setIsCompact(event.matches);
        if (media.addEventListener) {
            media.addEventListener('change', handleChange);
        } else {
            media.addListener(handleChange);
        }
        return () => {
            if (media.removeEventListener) {
                media.removeEventListener('change', handleChange);
            } else {
                media.removeListener(handleChange);
            }
        };
    }, []);

    const events = useMemo(() => {
        return (pedidos || []).filter(p => p.fecha_entrega).map(p => {
            const date = new Date(p.fecha_entrega);
            const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const color = statusColors[p.estado] || '#64748B';
            return {
                id: String(p.id),
                title: p.codigo,
                start,
                allDay: true,
                backgroundColor: color,
                borderColor: color,
                textColor: '#FFFFFF',
                extendedProps: {
                    estado: p.estado,
                    paciente_nombre: p.paciente_nombre,
                    clinica_nombre: p.clinica_nombre,
                    codigo: p.codigo
                }
            };
        });
    }, [pedidos]);

    const headerToolbar = useMemo(() => (isCompact ? {
        left: 'prev,next today',
        center: 'title',
        right: 'listWeekCustom,dayGridMonth'
    } : {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,listWeekCustom,listDayCustom'
    }), [isCompact]);

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Calendario de Entregas</h1>
                    <p>Vista diaria, semanal y mensual de fechas de entrega</p>
                </div>
            </div>

            <div className="card">
                <div className="calendar-legend">
                    {Object.entries(statusLabels).map(([key, label]) => (
                        <div className="calendar-legend-item" key={key}>
                            <span className="calendar-legend-dot" style={{ background: statusColors[key] }}></span>
                            <span>{label}</span>
                        </div>
                    ))}
                </div>
                {loading ? (
                    <div className="skeleton" style={{ height: 520, borderRadius: 8 }} />
                ) : (
                    <FullCalendar
                        plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
                        initialView={isCompact ? 'listWeekCustom' : 'dayGridMonth'}
                        headerToolbar={headerToolbar}
                        buttonText={{
                            today: 'Hoy',
                            month: 'Mes',
                            week: 'Semana',
                            day: 'Dia',
                            list: 'Lista'
                        }}
                        views={{
                            listWeekCustom: { type: 'listWeek', buttonText: 'Semana' },
                            listDayCustom: { type: 'listDay', buttonText: 'Dia' }
                        }}
                        locale={esLocale}
                        events={events}
                        displayEventTime={false}
                        eventClick={(info) => navigate(`/pedidos/${info.event.id}`)}
                        dayMaxEventRows={isCompact ? 2 : 3}
                        height="auto"
                        eventDidMount={(info) => {
                            info.el.setAttribute('title', `${info.event.title} • ${statusLabels[info.event.extendedProps.estado] || ''}`);
                        }}
                        eventContent={(arg) => {
                            const estado = statusLabels[arg.event.extendedProps.estado] || '';
                            const paciente = arg.event.extendedProps.paciente_nombre || '';
                            const clinica = arg.event.extendedProps.clinica_nombre || '';
                            return (
                                <div className="fc-event-card">
                                    <div className="fc-event-code">{arg.event.title}</div>
                                    <div className="fc-event-meta">{paciente}</div>
                                    <div className="fc-event-sub">{clinica}</div>
                                    <span className="fc-event-status" style={{ background: statusColors[arg.event.extendedProps.estado] || '#64748B' }}>
                                        {estado}
                                    </span>
                                </div>
                            );
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default Calendario;
