import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '@fullcalendar/react/dist/vdom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import Modal from '../components/Modal.jsx';
import { useOrdersListQuery } from '../modules/orders/queries/useOrdersListQuery.js';

const statusLabels = {
    pendiente: 'Pendiente',
    en_diseno: 'En Diseño',
    esperando_aprobacion: 'Aprobación',
    en_produccion: 'Producción',
    terminado: 'Terminado',
    enviado: 'Enviado',
};

const statusColors = {
    pendiente: '#F59E0B',
    en_diseno: '#8B5CF6',
    esperando_aprobacion: '#3B82F6',
    en_produccion: '#0891B2',
    terminado: '#10B981',
    enviado: '#6B7280',
};

const toLocalIsoDate = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDayTitle = (isoDate) => {
    const [year, month, day] = String(isoDate).split('-').map(Number);
    if (!year || !month || !day) return isoDate;
    return new Date(year, month - 1, day).toLocaleDateString('es-PE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });
};

const patientLabel = (name, codigo) => {
    const trimmed = String(name || '').trim();
    return trimmed || codigo || 'Sin paciente';
};

const CalendarioCliente = () => {
    const navigate = useNavigate();
    const calendarRef = useRef(null);
    const { data: pedidos = [], isLoading } = useOrdersListQuery({ filters: undefined });
    const [isCompact, setIsCompact] = useState(() => (
        typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
    ));
    const [dayPanel, setDayPanel] = useState(null);
    const [viewTitle, setViewTitle] = useState('');
    const [activeView, setActiveView] = useState(() => (
        typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
            ? 'listWeek'
            : 'dayGridMonth'
    ));

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
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

    const events = useMemo(() => (
        (pedidos || []).filter((pedido) => pedido.fecha_entrega).map((pedido) => {
            const date = new Date(pedido.fecha_entrega);
            const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const color = statusColors[pedido.estado] || '#64748B';
            const nombre = patientLabel(pedido.paciente_nombre, pedido.codigo);
            return {
                id: String(pedido.id),
                title: nombre,
                start,
                allDay: true,
                backgroundColor: color,
                borderColor: color,
                textColor: '#FFFFFF',
                extendedProps: {
                    estado: pedido.estado,
                    paciente_nombre: nombre,
                    codigo: pedido.codigo,
                    producto_principal: pedido.producto_principal,
                    dateKey: toLocalIsoDate(start),
                },
            };
        })
    ), [pedidos]);

    const eventsByDate = useMemo(() => {
        const map = new Map();
        events.forEach((event) => {
            const key = event.extendedProps.dateKey;
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(event);
        });
        return map;
    }, [events]);

    const openDayPanel = (isoDate) => {
        const items = eventsByDate.get(isoDate) || [];
        if (items.length === 0) return;
        setDayPanel({ date: isoDate, items });
    };

    const getCalendarApi = () => calendarRef.current?.getApi?.() || null;

    const goPrev = () => getCalendarApi()?.prev();
    const goNext = () => getCalendarApi()?.next();
    const goToday = () => getCalendarApi()?.today();
    const changeView = (view) => {
        const api = getCalendarApi();
        if (!api) return;
        api.changeView(view);
        setActiveView(view);
        setViewTitle(api.view.title);
    };

    const viewButtons = isCompact
        ? [
            { id: 'listWeek', label: 'Semana' },
            { id: 'listDay', label: 'Día' },
            { id: 'dayGridMonth', label: 'Mes' },
        ]
        : [
            { id: 'dayGridMonth', label: 'Mes' },
            { id: 'listWeek', label: 'Semana' },
            { id: 'listDay', label: 'Día' },
        ];

    const counts = useMemo(() => {
        const next = {
            pendiente: 0,
            en_diseno: 0,
            esperando_aprobacion: 0,
            en_produccion: 0,
            terminado: 0,
            enviado: 0,
        };
        pedidos.forEach((pedido) => {
            if (next[pedido.estado] !== undefined) next[pedido.estado] += 1;
        });
        return next;
    }, [pedidos]);

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Mi Calendario</h1>
                    <p>Fechas de entrega de tus pedidos activos</p>
                </div>
            </div>

            <div className="card calendar-client-card">
                {isLoading && pedidos.length === 0 ? (
                    <div className="skeleton" style={{ height: 520, borderRadius: 8 }} />
                ) : events.length === 0 ? (
                    <div className="calendar-empty">
                        <i className="bi bi-calendar-x" aria-hidden="true" />
                        <h3>No hay pedidos con fecha de entrega</h3>
                        <p>Cuando el laboratorio asigne fechas a tus pedidos, aparecerán aquí.</p>
                    </div>
                ) : (
                    <>
                        <div className="calendar-client-toolbar" aria-label="Controles del calendario">
                            <div className="segmented-control calendar-client-toolbar-views" role="group" aria-label="Vista del calendario">
                                {viewButtons.map((view) => (
                                    <button
                                        key={view.id}
                                        type="button"
                                        className={`segmented-control__btn${activeView === view.id ? ' is-active' : ''}`}
                                        onClick={() => changeView(view.id)}
                                    >
                                        {view.label}
                                    </button>
                                ))}
                            </div>
                            <div className="calendar-client-toolbar-nav">
                                <button type="button" className="fc-button fc-button-primary" onClick={goPrev} aria-label="Anterior">
                                    <i className="bi bi-chevron-left" aria-hidden="true" />
                                </button>
                                <button type="button" className="fc-button fc-button-primary" onClick={goToday}>
                                    Hoy
                                </button>
                                <button type="button" className="fc-button fc-button-primary" onClick={goNext} aria-label="Siguiente">
                                    <i className="bi bi-chevron-right" aria-hidden="true" />
                                </button>
                            </div>
                            <strong className="calendar-client-toolbar-title">{viewTitle}</strong>
                        </div>

                        <div className="calendar-legend" aria-label="Leyenda de estados">
                            {Object.entries(statusLabels).map(([key, label]) => (
                                <div className="calendar-legend-item" key={key}>
                                    <span className="calendar-legend-pill" style={{ background: statusColors[key] }} />
                                    <span>
                                        {label}
                                        {counts[key] > 0 ? ` · ${counts[key]}` : ''}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <FullCalendar
                            ref={calendarRef}
                            plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
                            initialView={isCompact ? 'listWeek' : 'dayGridMonth'}
                            headerToolbar={false}
                            views={{
                                listWeek: { buttonText: 'Semana' },
                                listDay: { buttonText: 'Día' },
                            }}
                            locale={esLocale}
                            events={events}
                            displayEventTime={false}
                            dayMaxEvents={1}
                            datesSet={(arg) => {
                                setViewTitle(arg.view.title);
                                setActiveView(arg.view.type);
                            }}
                            moreLinkClick={(info) => {
                                info.jsEvent.preventDefault();
                                openDayPanel(toLocalIsoDate(info.date));
                                return 'none';
                            }}
                            moreLinkContent={(arg) => (
                                <span className="fc-more-link-label">+{arg.num}</span>
                            )}
                            dateClick={(info) => {
                                if (info.view.type !== 'dayGridMonth') return;
                                openDayPanel(toLocalIsoDate(info.date));
                            }}
                            eventClick={(info) => {
                                const isMonthView = info.view.type === 'dayGridMonth';
                                if (isMonthView) {
                                    info.jsEvent.preventDefault();
                                    openDayPanel(info.event.extendedProps.dateKey || toLocalIsoDate(info.event.start));
                                    return;
                                }
                                navigate(`/pedidos/${info.event.id}`);
                            }}
                            height={isCompact ? 480 : 'auto'}
                            eventContent={(arg) => {
                                const props = arg.event.extendedProps;
                                const estado = statusLabels[props.estado] || '';
                                const estadoKey = props.estado;
                                const color = statusColors[estadoKey] || '#64748B';
                                const isMonthView = arg.view.type === 'dayGridMonth';
                                const name = patientLabel(props.paciente_nombre, props.codigo);

                                if (isMonthView) {
                                    return (
                                        <div className="fc-event-pill" title={`${name} · ${props.codigo || ''}`.trim()}>
                                            <span className="fc-event-pill-name">{name}</span>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="calendar-day-item calendar-day-item--list">
                                        <span
                                            className="calendar-day-item-bar"
                                            style={{ background: color }}
                                            aria-hidden="true"
                                        />
                                        <span className="calendar-day-item-copy">
                                            <strong>{name}</strong>
                                            <em>{props.codigo}</em>
                                            {props.producto_principal ? (
                                                <span>{props.producto_principal}</span>
                                            ) : null}
                                        </span>
                                        <span className="fc-event-status" style={{ background: color }}>
                                            {estado}
                                        </span>
                                        <i className="bi bi-chevron-right" aria-hidden="true" />
                                    </div>
                                );
                            }}
                        />
                    </>
                )}
            </div>

            <Modal
                open={Boolean(dayPanel)}
                onClose={() => setDayPanel(null)}
                title={dayPanel ? formatDayTitle(dayPanel.date) : 'Entregas del día'}
                className="calendar-day-modal"
                footer={(
                    <button type="button" className="btn btn-secondary" onClick={() => setDayPanel(null)}>
                        Cerrar
                    </button>
                )}
            >
                {dayPanel?.items?.length ? (
                    <ul className="calendar-day-list">
                        {dayPanel.items.map((event) => {
                            const estado = event.extendedProps.estado;
                            const name = patientLabel(event.extendedProps.paciente_nombre, event.extendedProps.codigo);
                            return (
                                <li key={event.id}>
                                    <button
                                        type="button"
                                        className="calendar-day-item"
                                        onClick={() => navigate(`/pedidos/${event.id}`)}
                                    >
                                        <span
                                            className="calendar-day-item-bar"
                                            style={{ background: statusColors[estado] || '#64748B' }}
                                            aria-hidden="true"
                                        />
                                        <span className="calendar-day-item-copy">
                                            <strong>{name}</strong>
                                            <em>{event.extendedProps.codigo}</em>
                                            {event.extendedProps.producto_principal ? (
                                                <span>{event.extendedProps.producto_principal}</span>
                                            ) : null}
                                        </span>
                                        <span
                                            className="fc-event-status"
                                            style={{ background: statusColors[estado] || '#64748B' }}
                                        >
                                            {statusLabels[estado] || estado}
                                        </span>
                                        <i className="bi bi-chevron-right" aria-hidden="true" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p className="calendar-day-empty">No hay entregas este día.</p>
                )}
            </Modal>
        </div>
    );
};

export default CalendarioCliente;
