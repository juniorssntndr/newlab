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

    const [selectedEvent, setSelectedEvent] = useState(null);

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
                    codigo: p.codigo,
                    producto_principal: p.producto_principal
                }
            };
        });
    }, [pedidos]);

    const headerToolbar = useMemo(() => (isCompact ? {
        left: 'prev,next today',
        center: 'title',
        right: 'listWeek,listDay,dayGridMonth'
    } : {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,listWeek,listDay'
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
                        initialView={isCompact ? 'listWeek' : 'dayGridMonth'}
                        headerToolbar={headerToolbar}
                        buttonText={{
                            today: 'Hoy',
                            month: 'Mes',
                            day: 'Día',
                            week: 'Semana'
                        }}
                        views={{
                            listWeek: { buttonText: 'Semana' },
                            listDay: { buttonText: 'Día' }
                        }}
                        locale={esLocale}
                        events={events}
                        displayEventTime={false}
                        eventClick={(info) => {
                            if (!isCompact) {
                                navigate(`/pedidos/${info.event.id}`);
                                return;
                            }
                            const rect = info.el.getBoundingClientRect();
                            const popupWidth = Math.min(280, Math.max(220, window.innerWidth - 20));
                            setSelectedEvent({
                                id: info.event.id,
                                title: info.event.title,
                                ...info.event.extendedProps,
                                position: {
                                    top: rect.bottom + window.scrollY + 10,
                                    left: Math.max(10, Math.min(rect.left, window.innerWidth - popupWidth - 10)),
                                    width: popupWidth
                                },
                            });
                        }}
                        dayMaxEventRows={isCompact ? 2 : 3}
                        height="auto"
                        eventDidMount={(info) => {
                            info.el.setAttribute('title', `${info.event.title} • ${statusLabels[info.event.extendedProps.estado] || ''}`);
                        }}
                        eventContent={(arg) => {
                            const props = arg.event.extendedProps;
                            const estado = statusLabels[props.estado] || '';
                            const paciente = props.paciente_nombre || '';
                            const clinica = props.clinica_nombre || '';
                            const isMonthView = arg.view.type === 'dayGridMonth';

                            if (isCompact && isMonthView) {
                                const prodAbbr = props.producto_principal ? props.producto_principal.substring(0, 3).toUpperCase() : 'ND';
                                return (
                                    <div className="fc-event-card" style={{ padding: '2px', textAlign: 'center' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{prodAbbr}</span>
                                    </div>
                                );
                            }

                            return (
                                <div className="fc-event-card">
                                    <div className="fc-event-code">{arg.event.title}</div>
                                    <div className="fc-event-meta">{paciente}</div>
                                    <div className="fc-event-sub">{clinica}</div>
                                    <span className="fc-event-status" style={{ background: statusColors[props.estado] || '#64748B' }}>
                                        {estado}
                                    </span>
                                </div>
                            );
                        }}
                    />
                )}
            </div>

            {selectedEvent && (
                <>
                    <div
                        onClick={() => setSelectedEvent(null)}
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
                    />
                    <div
                        className="animate-fade-in"
                        style={{
                            position: 'absolute',
                            top: selectedEvent.position.top,
                            left: selectedEvent.position.left,
                            zIndex: 1000,
                            background: 'var(--color-bg-elevated, var(--color-bg-card, #1e293b))',
                            padding: '1.25rem',
                            borderRadius: '12px',
                             boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
                             border: '1px solid var(--color-border, #334155)',
                             width: selectedEvent.position.width
                         }}
                     >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text, #f8fafc)' }}>{selectedEvent.title}</h3>
                            <button className="btn-icon" onClick={() => setSelectedEvent(null)} style={{ padding: '0.25rem', background: 'transparent', border: 'none', color: 'var(--color-text-muted, #94a3b8)' }}>
                                <i className="bi bi-x-lg" style={{ fontSize: '1rem' }}></i>
                            </button>
                        </div>

                        <div style={{ marginBottom: '0.75rem' }}>
                            <span className="fc-event-status" style={{
                                background: statusColors[selectedEvent.estado] || '#64748B',
                                display: 'inline-block',
                                fontSize: '0.75rem',
                                padding: '0.15rem 0.5rem'
                            }}>
                                {statusLabels[selectedEvent.estado] || selectedEvent.estado}
                            </span>
                        </div>

                        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                            <p style={{ margin: '0 0 0.25rem 0' }}><strong>Paciente:</strong> {selectedEvent.paciente_nombre}</p>
                            <p style={{ margin: '0 0 0.25rem 0' }}><strong>Clínica:</strong> {selectedEvent.clinica_nombre}</p>
                            {selectedEvent.producto_principal && (
                                <p style={{ margin: '0 0 0.25rem 0' }}><strong>Producto:</strong> {selectedEvent.producto_principal}</p>
                            )}
                        </div>

                        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                className="btn btn-primary"
                                style={{ width: '100%', padding: '0.5rem' }}
                                onClick={() => navigate(`/pedidos/${selectedEvent.id}`)}
                            >
                                Ver Seguimiento
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default Calendario;
