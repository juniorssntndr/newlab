import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../state/AuthContext.jsx';
import { apiClient } from '../services/http/apiClient.js';
import CustomSelect from '../components/CustomSelect.jsx';
import WheelOfFortune from '../components/WheelOfFortune.jsx';

export default function Marketing() {
    const { getHeaders, user } = useAuth();

    const [activeTab, setActiveTab] = useState('cupones'); // 'cupones' | 'ruleta' | 'fidelizacion'
    const [metricas, setMetricas] = useState(null);
    const [cupones, setCupones] = useState([]);
    const [historialGiros, setHistorialGiros] = useState([]);
    const [clinicas, setClinicas] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal Crear Cupón
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [formData, setFormData] = useState({
        codigo: '',
        descripcion: '',
        tipo: 'porcentaje',
        valor: '',
        tope_descuento_maximo: '',
        monto_minimo_pedido: '',
        limite_usos_total: '1',
        limite_usos_por_doctor: '1',
        fecha_fin: '',
        clinica_id: '',
        evento_nombre: '',
        origen: 'manual'
    });

    const loadData = async () => {
        try {
            setLoading(true);
            const [metricasRes, cuponesRes, girosRes, clinicasRes] = await Promise.all([
                apiClient.get('/api/marketing/metricas', { headers: getHeaders() }).catch(() => ({ data: { data: null } })),
                apiClient.get('/api/marketing/cupones', { headers: getHeaders() }).catch(() => ({ data: { data: [] } })),
                apiClient.get('/api/marketing/ruleta/historial', { headers: getHeaders() }).catch(() => ({ data: { data: [] } })),
                apiClient.get('/api/clinicas', { headers: getHeaders() }).catch(() => ({ data: [] }))
            ]);

            const mData = metricasRes?.data !== undefined ? metricasRes.data : metricasRes;
            setMetricas(mData || null);

            const cData = cuponesRes?.data !== undefined ? cuponesRes.data : cuponesRes;
            setCupones(Array.isArray(cData) ? cData : []);

            const gData = girosRes?.data !== undefined ? girosRes.data : girosRes;
            setHistorialGiros(Array.isArray(gData) ? gData : []);

            const clData = Array.isArray(clinicasRes) ? clinicasRes : (clinicasRes?.data || []);
            setClinicas(clData);
        } catch (err) {
            toast.error('Error al sincronizar datos de marketing');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleGenerateCode = () => {
        const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
        setFormData((prev) => ({ ...prev, codigo: `AFX-${randomStr}` }));
    };

    const handleCreateCoupon = async (e) => {
        e.preventDefault();
        if (!formData.codigo.trim()) {
            toast.error('El código es obligatorio');
            return;
        }
        if (!formData.valor || Number(formData.valor) <= 0) {
            toast.error('El valor del descuento debe ser mayor a 0');
            return;
        }

        setCreating(true);
        try {
            await apiClient.post('/api/marketing/cupones', formData, {
                headers: getHeaders()
            });
            toast.success('Cupón creado exitosamente');
            setShowCreateModal(false);
            setFormData({
                codigo: '',
                descripcion: '',
                tipo: 'porcentaje',
                valor: '',
                tope_descuento_maximo: '',
                monto_minimo_pedido: '',
                limite_usos_total: '1',
                limite_usos_por_doctor: '1',
                fecha_fin: '',
                clinica_id: '',
                evento_nombre: '',
                origen: 'manual'
            });
            loadData();
        } catch (err) {
            const msg = err.response?.data?.error || 'Error al crear el cupón';
            toast.error(msg);
        } finally {
            setCreating(false);
        }
    };

    const handleToggleActive = async (id) => {
        try {
            await apiClient.patch(`/api/marketing/cupones/${id}/toggle`, {}, {
                headers: getHeaders()
            });
            toast.success('Estado del cupón actualizado');
            loadData();
        } catch (err) {
            toast.error('No se pudo actualizar el cupón');
        }
    };

    const handleDeleteCoupon = async (id) => {
        if (!window.confirm('¿Seguro que deseas eliminar o desactivar este cupón?')) return;
        try {
            const res = await apiClient.delete(`/api/marketing/cupones/${id}`, {
                headers: getHeaders()
            });
            toast.success(res.data?.message || 'Cupón eliminado');
            loadData();
        } catch (err) {
            toast.error('Error al eliminar cupón');
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success(`Código ${text} copiado`);
    };

    const clinicOptions = [
        { value: '', label: 'Cualquier clínica / doctor (Uso Libre)' },
        ...clinicas.map((c) => ({ value: String(c.id), label: `${c.nombre} (${c.ciudad || 'Arequipa'})` }))
    ];

    const typeOptions = [
        { value: 'porcentaje', label: 'Porcentaje (% de descuento)' },
        { value: 'monto_fijo', label: 'Monto Fijo en Soles (S/. descuento)' }
    ];

    return (
        <div className="page-container animate-fade-in" style={{ paddingBottom: '3rem' }}>
            {/* Header del módulo */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: 'rgba(2, 132, 199, 0.15)',
                            color: 'var(--color-primary, #0284c7)'
                        }}>
                            <i className="bi bi-megaphone-fill"></i>
                        </span>
                        Marketing & Fidelización Comercial
                    </h1>
                    <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-secondary, #64748b)', fontSize: '0.88rem' }}>
                        AFINIX DENTAL LAB S.A.C. · Cupones de descuento, ruleta para visitas de campo y recompensas por hitos.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={loadData}
                        title="Actualizar datos"
                    >
                        <i className="bi bi-arrow-clockwise"></i>
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                            handleGenerateCode();
                            setShowCreateModal(true);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
                    >
                        <i className="bi bi-plus-lg"></i>
                        Nuevo Cupón
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem'
            }}>
                <div className="card dashboard-kpi-card" style={{ padding: '1.15rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Cupones Activos</span>
                        <i className="bi bi-tags-fill text-primary" style={{ fontSize: '1.25rem' }}></i>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--color-primary, #0284c7)' }}>
                        {metricas?.cupones_activos ?? cupones.filter(c => c.activo).length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>Disponibles para canje</div>
                </div>

                <div className="card dashboard-kpi-card" style={{ padding: '1.15rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Canjes Totales</span>
                        <i className="bi bi-bag-check-fill text-success" style={{ fontSize: '1.25rem' }}></i>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.35rem', color: '#10b981' }}>
                        {metricas?.total_canjes ?? 0}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>Órdenes con descuento</div>
                </div>

                <div className="card dashboard-kpi-card" style={{ padding: '1.15rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Ahorro Otorgado</span>
                        <i className="bi bi-cash-stack text-warning" style={{ fontSize: '1.25rem' }}></i>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.35rem', color: '#f59e0b' }}>
                        S/. {Number(metricas?.total_ahorrado_soles || 0).toFixed(2)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>Beneficio total a doctores</div>
                </div>

                <div className="card dashboard-kpi-card" style={{ padding: '1.15rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Giros de Ruleta</span>
                        <i className="bi bi-disc text-info" style={{ fontSize: '1.25rem' }}></i>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.35rem', color: '#06b6d4' }}>
                        {metricas?.total_giros_ruleta ?? historialGiros.length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>Participantes en visitas</div>
                </div>
            </div>

            {/* Pestañas de Navegación */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                borderBottom: '1px solid var(--color-border, #e2e8f0)',
                marginBottom: '1.5rem',
                overflowX: 'auto',
                whiteSpace: 'nowrap'
            }}>
                <button
                    type="button"
                    className={`btn ${activeTab === 'cupones' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('cupones')}
                    style={{ borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: 'none' }}
                >
                    <i className="bi bi-ticket-perforated"></i>
                    Cupones de Descuento ({cupones.length})
                </button>
                <button
                    type="button"
                    className={`btn ${activeTab === 'ruleta' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('ruleta')}
                    style={{ borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: 'none' }}
                >
                    <i className="bi bi-disc"></i>
                    Ruleta de la Suerte (Eventos & Visitas)
                </button>
                <button
                    type="button"
                    className={`btn ${activeTab === 'fidelizacion' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('fidelizacion')}
                    style={{ borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: 'none' }}
                >
                    <i className="bi bi-trophy"></i>
                    Hitos & Fidelización (Rewards)
                </button>
            </div>

            {/* CONTENIDO DE PESTAÑAS */}
            {activeTab === 'cupones' && (
                <div className="card dashboard-ops-panel" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Listado Oficial de Cupones</h3>
                        <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                            Los cupones se validan en tiempo real en el Paso 3 del pedido técnico.
                        </span>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <div className="spinner-border text-primary" role="status"></div>
                            <p style={{ marginTop: '0.5rem', color: '#64748b' }}>Cargando cupones...</p>
                        </div>
                    ) : cupones.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                            <i className="bi bi-tag" style={{ fontSize: '2.5rem', opacity: 0.5 }}></i>
                            <p style={{ marginTop: '0.5rem' }}>No hay cupones registrados todavía.</p>
                            <button
                                type="button"
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => {
                                    handleGenerateCode();
                                    setShowCreateModal(true);
                                }}
                            >
                                Crear primer cupón
                            </button>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table" style={{ width: '100%', fontSize: '0.88rem' }}>
                                <thead>
                                    <tr>
                                        <th>Código</th>
                                        <th>Beneficio</th>
                                        <th>Destino / Clínica</th>
                                        <th>Origen</th>
                                        <th>Usos</th>
                                        <th>Vigencia</th>
                                        <th>Estado</th>
                                        <th style={{ textAlign: 'right' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cupones.map((c) => (
                                        <tr key={c.id}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    <code style={{
                                                        background: 'rgba(2, 132, 199, 0.1)',
                                                        color: 'var(--color-primary, #0284c7)',
                                                        padding: '0.2rem 0.5rem',
                                                        borderRadius: '6px',
                                                        fontWeight: 700
                                                    }}>
                                                        {c.codigo}
                                                    </code>
                                                    <button
                                                        type="button"
                                                        className="btn btn-xs btn-ghost"
                                                        onClick={() => copyToClipboard(c.codigo)}
                                                        title="Copiar código"
                                                        style={{ padding: '0.15rem 0.35rem' }}
                                                    >
                                                        <i className="bi bi-copy"></i>
                                                    </button>
                                                </div>
                                                {c.descripcion && (
                                                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '2px' }}>
                                                        {c.descripcion}
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <strong>
                                                    {c.tipo === 'porcentaje' ? `${Number(c.valor)}% DCTO` : `S/. ${Number(c.valor).toFixed(2)}`}
                                                </strong>
                                                {c.monto_minimo_pedido > 0 && (
                                                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                                        Mín: S/. {Number(c.monto_minimo_pedido).toFixed(2)}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                {c.clinica_nombre ? (
                                                    <span style={{ color: '#0284c7', fontWeight: 500 }}>
                                                        <i className="bi bi-hospital" style={{ marginRight: '4px' }}></i>
                                                        {c.clinica_nombre}
                                                    </span>
                                                ) : (
                                                    <span className="badge badge-light" style={{ background: '#f1f5f9', color: '#475569' }}>
                                                        Uso Libre (Cualquiera)
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <span className="badge" style={{
                                                    background: c.origen === 'ruleta_evento' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(2, 132, 199, 0.1)',
                                                    color: c.origen === 'ruleta_evento' ? '#8b5cf6' : '#0284c7'
                                                }}>
                                                    {c.origen === 'ruleta_evento' ? 'Ruleta Evento' : (c.origen || 'Manual')}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{ fontWeight: 600 }}>{c.usos_actuales}</span> / {c.limite_usos_total || '∞'}
                                            </td>
                                            <td>
                                                {c.fecha_fin ? (
                                                    <span style={{ fontSize: '0.8rem' }}>
                                                        Hasta {new Date(c.fecha_fin).toLocaleDateString('es-PE')}
                                                    </span>
                                                ) : (
                                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Permanente</span>
                                                )}
                                            </td>
                                            <td>
                                                <span className={`badge ${c.activo ? 'badge-success' : 'badge-secondary'}`} style={{
                                                    background: c.activo ? 'rgba(16, 185, 129, 0.15)' : '#f1f5f9',
                                                    color: c.activo ? '#10b981' : '#64748b',
                                                    padding: '0.2rem 0.6rem',
                                                    borderRadius: '12px'
                                                }}>
                                                    {c.activo ? 'Activo' : 'Pausado'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                                    <button
                                                        type="button"
                                                        className={`btn btn-xs ${c.activo ? 'btn-outline-warning' : 'btn-outline-success'}`}
                                                        onClick={() => handleToggleActive(c.id)}
                                                        title={c.activo ? 'Pausar cupón' : 'Activar cupón'}
                                                    >
                                                        <i className={`bi ${c.activo ? 'bi-pause-fill' : 'bi-play-fill'}`}></i>
                                                    </button>
                                                    {user?.tipo === 'admin' && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-xs btn-outline-danger"
                                                            onClick={() => handleDeleteCoupon(c.id)}
                                                            title="Eliminar cupón"
                                                        >
                                                            <i className="bi bi-trash"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'ruleta' && (
                <div>
                    {/* Componente Interactivo de Ruleta para Asesores */}
                    <WheelOfFortune onGiroCompletado={loadData} />

                    {/* Tabla de Historial de Giros */}
                    <div className="card dashboard-ops-panel" style={{ padding: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <i className="bi bi-clock-history text-primary"></i>
                                Historial de Giros y Doctores Premiados
                            </h3>
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                Últimos 100 giros registrados en visitas y eventos
                            </span>
                        </div>

                        {historialGiros.length === 0 ? (
                            <p style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem 0' }}>
                                Aún no se han realizado giros de ruleta. ¡Utiliza la herramienta superior en tu próxima visita!
                            </p>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr>
                                            <th>Fecha y Hora</th>
                                            <th>Doctor Participante</th>
                                            <th>Clínica</th>
                                            <th>Evento / Motivo</th>
                                            <th>Premio Obtenido</th>
                                            <th>Cupón Generado</th>
                                            <th>Asesor Afinix</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historialGiros.map((g) => (
                                            <tr key={g.id}>
                                                <td>{new Date(g.fecha_giro).toLocaleString('es-PE')}</td>
                                                <td>
                                                    <strong>{g.doctor_nombre}</strong>
                                                    {g.doctor_telefono && (
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                            <i className="bi bi-telephone" style={{ marginRight: '3px' }}></i>
                                                            {g.doctor_telefono}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>{g.clinica_nombre || '—'}</td>
                                                <td>{g.evento_nombre}</td>
                                                <td>
                                                    <span className="badge" style={{ background: `${g.color_hex}22`, color: g.color_hex, fontWeight: 600 }}>
                                                        {g.premio_titulo}
                                                    </span>
                                                </td>
                                                <td>
                                                    {g.codigo_descuento_generado ? (
                                                        <code style={{ background: '#f1f5f9', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>
                                                            {g.codigo_descuento_generado}
                                                        </code>
                                                    ) : (
                                                        <span style={{ color: '#94a3b8' }}>—</span>
                                                    )}
                                                </td>
                                                <td>{g.asesor_nombre || 'Equipo Comercial'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'fidelizacion' && (
                <div className="card dashboard-ops-panel" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                        <span style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '10px',
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#f59e0b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.35rem'
                        }}>
                            <i className="bi bi-stars"></i>
                        </span>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                                Motor de Fidelización y Gamificación Continua (Rewards)
                            </h3>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                                Reglas automáticas para premiar la recurrencia y celebrar fechas especiales con los doctores.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginTop: '1rem' }}>
                        <div style={{ background: 'var(--color-bg-secondary, #f8fafc)', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <i className="bi bi-10-circle-fill text-primary" style={{ fontSize: '1.3rem' }}></i>
                                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600 }}>Hitos por Volumen de Pedidos</h4>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
                                Disparador automático: cuando una clínica alcanza sus primeros <strong>10 trabajos</strong> o <strong>50 trabajos</strong> técnicos, el sistema genera automáticamente un cupón especial de felicitación y alerta al asesor asignado.
                            </p>
                            <span className="badge badge-success" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                                <i className="bi bi-check-circle" style={{ marginRight: '4px' }}></i> Arquitectura Lista
                            </span>
                        </div>

                        <div style={{ background: 'var(--color-bg-secondary, #f8fafc)', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <i className="bi bi-cake2-fill text-warning" style={{ fontSize: '1.3rem' }}></i>
                                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600 }}>Cumpleaños de Doctores (CRM)</h4>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
                                Conectado con la fecha de nacimiento registrada en <strong>Gestión de Clientes (CRM)</strong>. Muestra alertas preventivas de 7 días antes para coordinar el envío de regalo físico o cupón cumpleañero por WhatsApp.
                            </p>
                            <span className="badge badge-primary" style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7' }}>
                                <i className="bi bi-link-45deg" style={{ marginRight: '4px' }}></i> Conectado con CRM
                            </span>
                        </div>

                        <div style={{ background: 'var(--color-bg-secondary, #f8fafc)', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <i className="bi bi-share-fill text-info" style={{ fontSize: '1.3rem' }}></i>
                                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600 }}>Campañas & Redes Sociales</h4>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
                                Creación de enlaces y códigos con seguimiento (UTM) para campañas en Instagram, Facebook y congresos odontológicos, midiendo cuántos pedidos provienen de cada esfuerzo publicitario.
                            </p>
                            <span className="badge badge-light" style={{ background: '#f1f5f9', color: '#64748b' }}>
                                Planificado Fase 2
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CREAR CUPÓN */}
            {showCreateModal && (
                <div className="modal-overlay" style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.75)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    backdropFilter: 'blur(3px)',
                    padding: '1rem'
                }}>
                    <div className="card" style={{
                        maxWidth: '520px',
                        width: '100%',
                        padding: '1.5rem',
                        borderRadius: '14px',
                        maxHeight: '90vh',
                        overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                                <i className="bi bi-tag-fill text-primary" style={{ marginRight: '0.5rem' }}></i>
                                Nuevo Cupón Promocional
                            </h3>
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => setShowCreateModal(false)}
                            >
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>

                        <form onSubmit={handleCreateCoupon}>
                            <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                    <label className="form-label" style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>
                                        Código de Cupón <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <button
                                        type="button"
                                        className="btn btn-xs btn-outline-secondary"
                                        onClick={handleGenerateCode}
                                    >
                                        Generar Aleatorio
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Ej. AFX-CLIENTE10 o BIENVENIDA50"
                                    value={formData.codigo}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                                    required
                                    style={{ fontWeight: 700, letterSpacing: '0.05em' }}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                    Descripción o Motivo
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Ej. 10% de bienvenida en su primera corona"
                                    value={formData.descripcion}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, descripcion: e.target.value }))}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                        Tipo de Descuento
                                    </label>
                                    <CustomSelect
                                        options={typeOptions}
                                        value={formData.tipo}
                                        onChange={(_, val) => setFormData((prev) => ({ ...prev, tipo: val }))}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                        {formData.tipo === 'porcentaje' ? 'Porcentaje (%)' : 'Monto Fijo (S/.)'} <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        className="form-input"
                                        placeholder={formData.tipo === 'porcentaje' ? '15' : '50.00'}
                                        value={formData.valor}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, valor: e.target.value }))}
                                        required
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                        Pedido Mínimo (S/.)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="form-input"
                                        placeholder="0.00 (sin mínimo)"
                                        value={formData.monto_minimo_pedido}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, monto_minimo_pedido: e.target.value }))}
                                    />
                                </div>

                                {formData.tipo === 'porcentaje' ? (
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                            Tope Máximo DCTO (S/.)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className="form-input"
                                            placeholder="Opcional"
                                            value={formData.tope_descuento_maximo}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, tope_descuento_maximo: e.target.value }))}
                                        />
                                    </div>
                                ) : (
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                            Límite Usos Totales
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            className="form-input"
                                            value={formData.limite_usos_total}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, limite_usos_total: e.target.value }))}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                    Asignación Exclusiva (Clínica / Doctor)
                                </label>
                                <CustomSelect
                                    options={clinicOptions}
                                    value={formData.clinica_id ? String(formData.clinica_id) : ''}
                                    onChange={(_, val) => setFormData((prev) => ({ ...prev, clinica_id: val }))}
                                    searchable
                                    placeholder="Uso libre para cualquier clínica..."
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                        Fecha de Vencimiento
                                    </label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={formData.fecha_fin}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, fecha_fin: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                        Nombre de Evento
                                    </label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Ej. Expo Dental"
                                        value={formData.evento_nombre}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, evento_nombre: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowCreateModal(false)}
                                    disabled={creating}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={creating}
                                    style={{ fontWeight: 600 }}
                                >
                                    {creating ? 'Guardando...' : 'Crear Cupón'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
