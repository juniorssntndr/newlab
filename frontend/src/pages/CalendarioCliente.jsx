import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '@fullcalendar/react/dist/vdom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { useOrdersListQuery } from '../modules/orders/queries/useOrdersListQuery.js';

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

const CalendarioCliente = () => {
    const navigate = useNavigate();
    const { data: pedidos = [], isLoading } = useOrdersListQuery({ filters: undefined });
    const [isCompact, setIsCompact] = useState(() => (
        typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
    ));
    const [selectedEvent, setSelectedEvent] = useState(null);

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
                title: `${p.codigo} — ${p.paciente_nombre || ''}`,
                start,
                allDay: true,
                backgroundColor: color,
                borderColor: color,
                textColor: '#FFFFFF',
                extendedProps: {
                    estado: p.estado,
                    paciente_nombre: p.paciente_nombre,
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

    // Summary counts
    const counts = useMemo(() => {
        const c = { pendiente: 0, en_diseno: 0, esperando_aprobacion: 0, en_produccion: 0, terminado: 0, enviado: 0 };
        pedidos.forEach(p => { if (c[p.estado] !== undefined) c[p.estado]++; });
        return c;
    }, [pedidos]);

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Mi Calendario</h1>
                    <p>Fechas de entrega de tus pedidos activos</p>
                </div>
            </div>

            {/* Summary chips */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                {Object.entries(statusLabels).map(([key, label]) => counts[key] > 0 && (
                    <div key={key} style={{
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        padding: '0.3rem 0.75rem', borderRadius: '999px',
                        background: `${statusColors[key]}22`, border: `1px solid ${statusColors[key]}55`,
                        fontSize: '0.8rem', fontWeight: '600', color: statusColors[key]
                    }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColors[key], display: 'inline-block' }} />
                        {label}: {counts[key]}
                    </div>
                ))}
            </div>

            <div className="card">
                <div className="calendar-legend">
                    {Object.entries(statusLabels).map(([key, label]) => (
                        <div className="calendar-legend-item" key={key}>
                            <span className="calendar-legend-dot" style={{ background: statusColors[key] }} />
                            <span>{label}</span>
                        </div>
                    ))}
                </div>
                {isLoading && pedidos.length === 0 ? (
                    <div className="skeleton" style={{ height: 520, borderRadius: 8 }} />
                ) : events.length === 0 ? (
                    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                        <i className="bi bi-calendar-x" style={{ fontSize: '3rem', marginBottom: '1rem', display: 'block' }} />
                        <h3>No hay pedidos con fecha de entrega</h3>
                        <p>Cuando el laboratorio asigne fechas a tus pedidos, aparecerán aquí.</p>
                    </div>
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
                        eventContent={(arg) => {
                            const props = arg.event.extendedProps;
                            const estado = statusLabels[props.estado] || '';
                            const isMonthView = arg.view.type === 'dayGridMonth';

                            if (isCompact && isMonthView) {
                                return (
                                    <div className="fc-event-card" style={{ padding: '2px', textAlign: 'center' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{props.codigo}</span>
                                    </div>
                                );
                            }

                            return (
                                <div className="fc-event-card">
                                    <div className="fc-event-code">{props.codigo}</div>
                                    <div className="fc-event-meta">{props.paciente_nombre}</div>
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
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
                            border: '1px solid var(--color-border, #334155)',
                            width: selectedEvent.position.width
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-text)' }}>{selectedEvent.codigo}</h3>
                            <button className="btn-icon" onClick={() => setSelectedEvent(null)} style={{ padding: '0.25rem', background: 'transparent', border: 'none', color: 'var(--color-text-muted)' }}>
                                <i className="bi bi-x-lg" />
                            </button>
                        </div>
                        <div style={{ marginBottom: '0.75rem' }}>
                            <span className="fc-event-status" style={{
                                background: statusColors[selectedEvent.estado] || '#64748B',
                                display: 'inline-block', fontSize: '0.75rem', padding: '0.15rem 0.5rem'
                            }}>
                                {statusLabels[selectedEvent.estado] || selectedEvent.estado}
                            </span>
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                            <p style={{ margin: '0 0 0.25rem 0' }}><strong>Paciente:</strong> {selectedEvent.paciente_nombre}</p>
                            {selectedEvent.producto_principal && (
                                <p style={{ margin: '0 0 0.25rem 0' }}><strong>Producto:</strong> {selectedEvent.producto_principal}</p>
                            )}
                        </div>
                        <div style={{ marginTop: '1rem' }}>
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

export default CalendarioCliente;
