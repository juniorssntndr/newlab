import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../state/AuthContext.jsx';
import { apiClient } from '../services/http/apiClient.js';
import CustomSelect from '../components/CustomSelect.jsx';
import Modal from '../components/Modal.jsx';
import WheelOfFortune from '../components/WheelOfFortune.jsx';

export default function Marketing() {
    const { getHeaders, user } = useAuth();

    const [activeTab, setActiveTab] = useState('cupones'); // 'cupones' | 'ruleta' | 'fidelizacion'
    const [metricas, setMetricas] = useState(null);
    const [cupones, setCupones] = useState([]);
    const [historialGiros, setHistorialGiros] = useState([]);
    const [sectoresRuleta, setSectoresRuleta] = useState([]);
    const [totalPesoActivo, setTotalPesoActivo] = useState(0);
    const [clinicas, setClinicas] = useState([]);
    const [loading, setLoading] = useState(true);

    // Sub-pestaña dentro de Ruleta
    const [ruletaSubTab, setRuletaSubTab] = useState('girar'); // 'girar' | 'sectores' | 'historial'

    // Modal Crear/Editar Sector de Ruleta
    const [showSectorModal, setShowSectorModal] = useState(false);
    const [editingSector, setEditingSector] = useState(null);
    const [savingSector, setSavingSector] = useState(false);
    const [kioskParticipant, setKioskParticipant] = useState({
        doctor_nombre: '',
        clinica_id: '',
        doctor_telefono: '',
        evento_nombre: 'Visita Comercial'
    });
    const [sectorForm, setSectorForm] = useState({
        titulo: '',
        tipo_premio: 'porcentaje',
        valor: '10',
        descripcion: '',
        color_hex: '#0284c7',
        texto_color: '#ffffff',
        probabilidad_peso: '10',
        stock_disponible: ''
    });

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
            const [metricasRes, cuponesRes, girosRes, clinicasRes, premiosRes] = await Promise.all([
                apiClient.get('/api/marketing/metricas', { headers: getHeaders() }).catch(() => ({ data: { data: null } })),
                apiClient.get('/api/marketing/cupones', { headers: getHeaders() }).catch(() => ({ data: { data: [] } })),
                apiClient.get('/api/marketing/ruleta/historial', { headers: getHeaders() }).catch(() => ({ data: { data: [] } })),
                apiClient.get('/api/clinicas', { headers: getHeaders() }).catch(() => []),
                apiClient.get('/api/marketing/ruleta/premios/admin', { headers: getHeaders() }).catch(() => ({ data: [] }))
            ]);

            const mData = metricasRes?.data !== undefined ? metricasRes.data : metricasRes;
            setMetricas(mData || null);

            const cData = cuponesRes?.data !== undefined ? cuponesRes.data : cuponesRes;
            setCupones(Array.isArray(cData) ? cData : []);

            const gData = girosRes?.data !== undefined ? girosRes.data : girosRes;
            setHistorialGiros(Array.isArray(gData) ? gData : []);

            const clData = Array.isArray(clinicasRes) ? clinicasRes : (clinicasRes?.data || []);
            setClinicas(clData);

            const pData = premiosRes?.data !== undefined ? premiosRes.data : premiosRes;
            setSectoresRuleta(Array.isArray(pData) ? pData : []);
            setTotalPesoActivo(premiosRes?.totalPesoActivo || 0);
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

    const prizeTypeOptions = [
        { value: 'porcentaje', label: 'Descuento Porcentual (% OFF)' },
        { value: 'monto_fijo', label: 'Descuento Fijo en Soles (S/. OFF)' },
        { value: 'merch', label: 'Merchandising / Regalo Físico (Agenda, Taza, etc.)' },
        { value: 'sin_premio', label: 'Sin Premio (Sigue intentando)' }
    ];

    const colorPresets = [
        { hex: '#0284c7', label: 'Azul Afinix' },
        { hex: '#0369a1', label: 'Azul Marino' },
        { hex: '#f59e0b', label: 'Dorado Ámbar' },
        { hex: '#10b981', label: 'Verde Éxito' },
        { hex: '#8b5cf6', label: 'Violeta / Púrpura' },
        { hex: '#ec4899', label: 'Rosa Magenta' },
        { hex: '#ef4444', label: 'Rojo Coral' },
        { hex: '#475569', label: 'Gris Grafito' }
    ];

    const handleOpenNewSector = () => {
        setEditingSector(null);
        setSectorForm({
            titulo: '',
            tipo_premio: 'porcentaje',
            valor: '10',
            descripcion: '',
            color_hex: '#0284c7',
            texto_color: '#ffffff',
            probabilidad_peso: '10',
            stock_disponible: ''
        });
        setShowSectorModal(true);
    };

    const handleOpenEditSector = (sector) => {
        setEditingSector(sector);
        setSectorForm({
            titulo: sector.titulo,
            tipo_premio: sector.tipo_premio,
            valor: sector.valor !== null && sector.valor !== undefined ? String(sector.valor) : '',
            descripcion: sector.descripcion || '',
            color_hex: sector.color_hex || '#0284c7',
            texto_color: sector.texto_color || '#ffffff',
            probabilidad_peso: String(sector.probabilidad_peso || 10),
            stock_disponible: sector.stock_disponible !== null && sector.stock_disponible !== undefined ? String(sector.stock_disponible) : ''
        });
        setShowSectorModal(true);
    };

    const handleSaveSector = async (e) => {
        e.preventDefault();
        if (!sectorForm.titulo.trim()) {
            toast.error('El título del sector es requerido');
            return;
        }

        setSavingSector(true);
        try {
            if (editingSector) {
                await apiClient.put(`/api/marketing/ruleta/premios/${editingSector.id}`, sectorForm, {
                    headers: getHeaders()
                });
                toast.success('Sector actualizado con éxito');
            } else {
                await apiClient.post('/api/marketing/ruleta/premios', sectorForm, {
                    headers: getHeaders()
                });
                toast.success('Nuevo sector creado en la ruleta');
            }
            setShowSectorModal(false);
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error al guardar sector');
        } finally {
            setSavingSector(false);
        }
    };

    const handleToggleSector = async (id) => {
        try {
            await apiClient.patch(`/api/marketing/ruleta/premios/${id}/toggle`, {}, {
                headers: getHeaders()
            });
            toast.success('Estado del sector actualizado');
            loadData();
        } catch {
            toast.error('Error al cambiar estado del sector');
        }
    };

    const handleDeleteSector = async (id) => {
        if (!window.confirm('¿Seguro que deseas eliminar este sector de la ruleta?')) return;
        try {
            const res = await apiClient.delete(`/api/marketing/ruleta/premios/${id}`, {
                headers: getHeaders()
            });
            toast.success(res.data?.message || 'Sector eliminado');
            loadData();
        } catch {
            toast.error('Error al eliminar sector');
        }
    };

    const handleLaunchKiosk = (isFreeUse = false) => {
        const payload = isFreeUse ? {
            doctor_nombre: 'Participante Invitado',
            clinica_id: '',
            doctor_telefono: '',
            evento_nombre: 'Visita Comercial'
        } : kioskParticipant;

        sessionStorage.setItem('afinix_ruleta_participante', JSON.stringify(payload));
        window.open('/ruleta-evento', '_blank');
    };

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
                    {/* Barra de Herramientas y Modo Kiosco */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '1rem',
                        marginBottom: '1.25rem',
                        background: 'var(--color-bg-secondary, #f8fafc)',
                        padding: '1rem 1.25rem',
                        borderRadius: '12px',
                        border: '1px solid var(--color-border, #e2e8f0)'
                    }}>
                        {/* Sub-pestañas de Ruleta */}
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className={`btn btn-sm ${ruletaSubTab === 'girar' ? 'btn-primary' : 'btn-outline-secondary'}`}
                                onClick={() => setRuletaSubTab('girar')}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                            >
                                <i className="bi bi-play-circle-fill"></i>
                                Girar Ruleta (Visitas)
                            </button>
                            <button
                                type="button"
                                className={`btn btn-sm ${ruletaSubTab === 'sectores' ? 'btn-primary' : 'btn-outline-secondary'}`}
                                onClick={() => setRuletaSubTab('sectores')}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                            >
                                <i className="bi bi-sliders"></i>
                                Configurar Sectores & Probabilidades ({sectoresRuleta.length})
                            </button>
                            <button
                                type="button"
                                className={`btn btn-sm ${ruletaSubTab === 'historial' ? 'btn-primary' : 'btn-outline-secondary'}`}
                                onClick={() => setRuletaSubTab('historial')}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                            >
                                <i className="bi bi-clock-history"></i>
                                Historial de Giros ({historialGiros.length})
                            </button>
                        </div>

                        {/* Botón Lanzador Rápido */}
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleLaunchKiosk(true)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontWeight: 700,
                                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
                            }}
                            title="Abre la ruleta limpia en pantalla completa, estilo Interacty"
                        >
                            <i className="bi bi-box-arrow-up-right"></i>
                            Lanzar Modo Kiosco Libre
                        </button>
                    </div>

                    {/* VISTA 1: PREPARACIÓN Y LANZADOR MODO INTERACTY */}
                    {ruletaSubTab === 'girar' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                            {/* Tarjeta 1: Preparación con Doctor Específico */}
                            <div className="card dashboard-ops-panel" style={{ padding: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <span style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '8px',
                                        background: 'rgba(2, 132, 199, 0.12)',
                                        color: '#0284c7',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.2rem'
                                    }}>
                                        <i className="bi bi-person-fill-check"></i>
                                    </span>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                                            Preparar Visita para Doctor Específico
                                        </h3>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                                            Vincula el premio a la cuenta del doctor para que le llegue un pop-up a su portal.
                                        </p>
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                        Nombre del Doctor(a)
                                    </label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Ej. Dr. Carlos Valdivia"
                                        value={kioskParticipant.doctor_nombre}
                                        onChange={(e) => setKioskParticipant((prev) => ({ ...prev, doctor_nombre: e.target.value }))}
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                        Clínica / Consultorio (Asignación)
                                    </label>
                                    <CustomSelect
                                        options={clinicOptions}
                                        value={kioskParticipant.clinica_id ? String(kioskParticipant.clinica_id) : ''}
                                        onChange={(_, val) => setKioskParticipant((prev) => ({ ...prev, clinica_id: val }))}
                                        placeholder="Uso Libre (o vincular con cuenta en portal)"
                                        searchable
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                        Teléfono / WhatsApp (para entrega)
                                    </label>
                                    <input
                                        type="tel"
                                        className="form-input"
                                        placeholder="Ej. 958123456"
                                        value={kioskParticipant.doctor_telefono}
                                        onChange={(e) => setKioskParticipant((prev) => ({ ...prev, doctor_telefono: e.target.value }))}
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                    <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                        Motivo o Evento
                                    </label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Ej. Visita Clínica San Juan / Congreso Odontológico"
                                        value={kioskParticipant.evento_nombre}
                                        onChange={(e) => setKioskParticipant((prev) => ({ ...prev, evento_nombre: e.target.value }))}
                                    />
                                </div>

                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => handleLaunchKiosk(false)}
                                    style={{
                                        width: '100%',
                                        padding: '0.85rem',
                                        fontWeight: 700,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        boxShadow: '0 4px 15px rgba(2, 132, 199, 0.35)'
                                    }}
                                >
                                    <i className="bi bi-box-arrow-up-right"></i>
                                    🚀 Lanzar Ruleta para este Doctor
                                </button>
                            </div>

                            {/* Tarjeta 2: Modo Stand / Evento Libre */}
                            <div className="card dashboard-ops-panel" style={{
                                padding: '1.5rem',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.05) 0%, rgba(56, 189, 248, 0.02) 100%)',
                                border: '1px solid rgba(2, 132, 199, 0.2)'
                            }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                        <span style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '8px',
                                            background: 'rgba(16, 185, 129, 0.12)',
                                            color: '#10b981',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '1.2rem'
                                        }}>
                                            <i className="bi bi-stars"></i>
                                        </span>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                                                Modo Kiosco Libre (Interacty Style)
                                            </h3>
                                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                                                Ideal para ferias, stands o visitas express donde el doctor gira al instante.
                                            </p>
                                        </div>
                                    </div>

                                    <div style={{
                                        background: '#ffffff',
                                        padding: '1.25rem',
                                        borderRadius: '12px',
                                        border: '1px dashed #cbd5e1',
                                        marginBottom: '1.5rem'
                                    }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a', marginBottom: '0.5rem' }}>
                                            ¿Cómo funciona la Ruleta en Pantalla Completa?
                                        </div>
                                        <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', color: '#475569', lineHeight: 1.6 }}>
                                            <li>Pantalla limpia y oscura con los colores oficiales de <strong>AFINIX LAB</strong>.</li>
                                            <li><strong>Giro con 1 solo clic</strong> en el centro o sobre cualquier parte de la ruleta.</li>
                                            <li><strong>Ruleta infinita:</strong> Al terminar el giro, muestra el premio con su código de 6 dígitos y botón de reinicio inmediato para el siguiente participante.</li>
                                            <li>Todos los códigos quedan registrados automáticamente en el historial de marketing.</li>
                                        </ul>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="btn btn-success"
                                    onClick={() => handleLaunchKiosk(true)}
                                    style={{
                                        width: '100%',
                                        padding: '0.85rem',
                                        fontWeight: 700,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)',
                                        backgroundColor: '#10b981',
                                        borderColor: '#10b981',
                                        color: '#ffffff'
                                    }}
                                >
                                    <i className="bi bi-play-circle-fill"></i>
                                    ✨ Abrir Ruleta Libre Ahora (Pantalla Completa)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* VISTA 2: CONFIGURACIÓN DE SECTORES Y PROBABILIDADES */}
                    {ruletaSubTab === 'sectores' && (
                        <div className="card dashboard-ops-panel" style={{ padding: '1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <i className="bi bi-pie-chart-fill text-primary"></i>
                                        Sectores y Algoritmo de Probabilidad
                                    </h3>
                                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                                        Control de premios variables (merch, porcentaje, monto fijo o sin premio). Los premios con stock agotado o pausados se excluyen automáticamente del azar.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={handleOpenNewSector}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                                >
                                    <i className="bi bi-plus-lg"></i>
                                    Nuevo Sector / Premio
                                </button>
                            </div>

                            {/* Resumen de probabilidad activa */}
                            <div style={{
                                display: 'flex',
                                gap: '1rem',
                                flexWrap: 'wrap',
                                background: 'var(--color-bg-secondary, #f8fafc)',
                                padding: '0.85rem 1rem',
                                borderRadius: '10px',
                                marginBottom: '1.25rem',
                                border: '1px solid #e2e8f0',
                                fontSize: '0.85rem'
                            }}>
                                <div>
                                    <span style={{ color: '#64748b' }}>Sectores Totales:</span>{' '}
                                    <strong>{sectoresRuleta.length}</strong>
                                </div>
                                <div>
                                    <span style={{ color: '#64748b' }}>En Giro Activo:</span>{' '}
                                    <strong style={{ color: '#0284c7' }}>
                                        {sectoresRuleta.filter(s => s.activo && (!s.stock_disponible || s.stock_entregado < s.stock_disponible)).length}
                                    </strong>
                                </div>
                                <div>
                                    <span style={{ color: '#64748b' }}>Peso Total Acumulado:</span>{' '}
                                    <strong>{totalPesoActivo} pts</strong>
                                </div>
                            </div>

                            {/* Tabla de sectores */}
                            <div style={{ overflowX: 'auto' }}>
                                <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr>
                                            <th>Sector / Título</th>
                                            <th>Tipo de Premio</th>
                                            <th>Beneficio</th>
                                            <th>Stock Físico</th>
                                            <th>Peso & Probabilidad</th>
                                            <th>Estado</th>
                                            <th style={{ textAlign: 'right' }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sectoresRuleta.map((s) => {
                                            const isDepleted = s.stock_disponible !== null && s.stock_entregado >= s.stock_disponible;
                                            return (
                                                <tr key={s.id}>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                            <div style={{
                                                                width: '24px',
                                                                height: '24px',
                                                                borderRadius: '6px',
                                                                backgroundColor: s.color_hex || '#0284c7',
                                                                border: '1px solid rgba(0,0,0,0.15)',
                                                                flexShrink: 0
                                                            }} />
                                                            <div>
                                                                <strong style={{ display: 'block', color: '#0f172a' }}>{s.titulo}</strong>
                                                                {s.descripcion && (
                                                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                                        {s.descripcion}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="badge" style={{
                                                            background: s.tipo_premio === 'merch' ? 'rgba(139, 92, 246, 0.15)' :
                                                                s.tipo_premio === 'porcentaje' ? 'rgba(2, 132, 199, 0.15)' :
                                                                s.tipo_premio === 'monto_fijo' ? 'rgba(16, 185, 129, 0.15)' : '#f1f5f9',
                                                            color: s.tipo_premio === 'merch' ? '#8b5cf6' :
                                                                s.tipo_premio === 'porcentaje' ? '#0284c7' :
                                                                s.tipo_premio === 'monto_fijo' ? '#10b981' : '#64748b',
                                                            fontWeight: 600
                                                        }}>
                                                            {s.tipo_premio === 'merch' && <i className="bi bi-box-seam" style={{ marginRight: '4px' }}></i>}
                                                            {s.tipo_premio === 'porcentaje' && <i className="bi bi-percent" style={{ marginRight: '4px' }}></i>}
                                                            {s.tipo_premio === 'monto_fijo' && <i className="bi bi-cash" style={{ marginRight: '4px' }}></i>}
                                                            {s.tipo_premio === 'sin_premio' && <i className="bi bi-emoji-neutral" style={{ marginRight: '4px' }}></i>}
                                                            {s.tipo_premio === 'merch' ? 'Merch / Físico' :
                                                                s.tipo_premio === 'porcentaje' ? 'Porcentaje' :
                                                                s.tipo_premio === 'monto_fijo' ? 'Monto Soles' : 'Sin Premio'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {s.tipo_premio === 'porcentaje' && <strong>{Number(s.valor)}% DCTO</strong>}
                                                        {s.tipo_premio === 'monto_fijo' && <strong>S/. {Number(s.valor).toFixed(2)} DCTO</strong>}
                                                        {s.tipo_premio === 'merch' && <span style={{ color: '#475569' }}>Regalo de Marca</span>}
                                                        {s.tipo_premio === 'sin_premio' && <span style={{ color: '#94a3b8' }}>—</span>}
                                                    </td>
                                                    <td>
                                                        {s.stock_disponible === null ? (
                                                            <span className="badge badge-light" style={{ background: '#f1f5f9', color: '#475569' }}>
                                                                Ilimitado
                                                            </span>
                                                        ) : (
                                                            <div>
                                                                <span className={`badge ${isDepleted ? 'badge-danger' : 'badge-info'}`} style={{
                                                                    background: isDepleted ? 'rgba(239, 68, 68, 0.15)' : 'rgba(2, 132, 199, 0.12)',
                                                                    color: isDepleted ? '#ef4444' : '#0284c7',
                                                                    fontWeight: 600
                                                                }}>
                                                                    {Math.max(0, s.stock_disponible - s.stock_entregado)} de {s.stock_disponible} restantes
                                                                </span>
                                                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                                                                    {s.stock_entregado} entregados
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <span style={{ fontWeight: 600 }}>{s.probabilidad_peso} pts</span>
                                                            <span className="badge badge-primary" style={{
                                                                background: s.activo && !isDepleted ? 'rgba(2, 132, 199, 0.15)' : '#f1f5f9',
                                                                color: s.activo && !isDepleted ? '#0284c7' : '#94a3b8',
                                                                fontWeight: 700
                                                            }}>
                                                                {s.activo && !isDepleted ? `${s.probabilidad_porcentaje}%` : '0%'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {!s.activo ? (
                                                            <span className="badge" style={{ background: '#f1f5f9', color: '#64748b' }}>Pausado</span>
                                                        ) : isDepleted ? (
                                                            <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>Agotado</span>
                                                        ) : (
                                                            <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>Activo</span>
                                                        )}
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                                            <button
                                                                type="button"
                                                                className={`btn btn-xs ${s.activo ? 'btn-outline-warning' : 'btn-outline-success'}`}
                                                                onClick={() => handleToggleSector(s.id)}
                                                                title={s.activo ? 'Pausar sector' : 'Activar sector'}
                                                            >
                                                                <i className={`bi ${s.activo ? 'bi-pause-fill' : 'bi-play-fill'}`}></i>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn btn-xs btn-outline-primary"
                                                                onClick={() => handleOpenEditSector(s)}
                                                                title="Editar sector"
                                                            >
                                                                <i className="bi bi-pencil"></i>
                                                            </button>
                                                            {user?.tipo === 'admin' && (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-xs btn-outline-danger"
                                                                    onClick={() => handleDeleteSector(s.id)}
                                                                    title="Eliminar sector"
                                                                >
                                                                    <i className="bi bi-trash"></i>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* VISTA 3: HISTORIAL DE GIROS */}
                    {ruletaSubTab === 'historial' && (
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
                                                <th>Cupón (6 Dígitos)</th>
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
                                                            <code style={{ background: '#f1f5f9', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 700, letterSpacing: '0.05em' }}>
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
                    )}
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
            <Modal
                open={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="Nuevo Cupón Promocional"
                subtitle="Configura descuentos en soles o porcentaje con límites y vigencia"
                icon="bi-tag-fill"
                size="lg"
            >
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

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
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
            </Modal>

            {/* MODAL CREAR / EDITAR SECTOR DE RULETA */}
            <Modal
                open={showSectorModal}
                onClose={() => setShowSectorModal(false)}
                title={editingSector ? 'Editar Sector de la Ruleta' : 'Nuevo Sector en la Ruleta'}
                subtitle="Configura el premio, color, stock físico y peso de probabilidad (Interacty style)"
                icon="bi-pie-chart-fill"
                size="md"
            >
                <form onSubmit={handleSaveSector}>
                    <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                        <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                            Título Visible en la Ruleta <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Ej. 15% OFF, Agenda 2026, S/. 50 Soles, Sigue Intentando"
                            value={sectorForm.titulo}
                            onChange={(e) => setSectorForm((prev) => ({ ...prev, titulo: e.target.value }))}
                            required
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                        <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                            Tipo de Premio <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <CustomSelect
                            options={prizeTypeOptions}
                            value={sectorForm.tipo_premio}
                            onChange={(_, val) => setSectorForm((prev) => ({ ...prev, tipo_premio: val }))}
                        />
                    </div>

                    {['porcentaje', 'monto_fijo'].includes(sectorForm.tipo_premio) && (
                        <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                            <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                {sectorForm.tipo_premio === 'porcentaje' ? 'Porcentaje de Descuento (%)' : 'Monto de Descuento (S/.)'} <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                className="form-input"
                                placeholder={sectorForm.tipo_premio === 'porcentaje' ? '15' : '50.00'}
                                value={sectorForm.valor}
                                onChange={(e) => setSectorForm((prev) => ({ ...prev, valor: e.target.value }))}
                                required
                            />
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                Stock Disponible (Unidades)
                            </label>
                            <input
                                type="number"
                                min="1"
                                className="form-input"
                                placeholder="Ilimitado (vacío)"
                                value={sectorForm.stock_disponible}
                                onChange={(e) => setSectorForm((prev) => ({ ...prev, stock_disponible: e.target.value }))}
                            />
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                Al agotarse, sale de la ruleta automáticamente.
                            </span>
                        </div>

                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                Peso de Probabilidad (1 - 100) <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="1000"
                                className="form-input"
                                value={sectorForm.probabilidad_peso}
                                onChange={(e) => setSectorForm((prev) => ({ ...prev, probabilidad_peso: e.target.value }))}
                                required
                            />
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                Mayor peso = más probable.
                            </span>
                        </div>
                    </div>

                    {/* Paleta de Color del Sector */}
                    <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                        <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                            Color de la Tajada
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                            {colorPresets.map((c) => (
                                <button
                                    key={c.hex}
                                    type="button"
                                    onClick={() => setSectorForm((prev) => ({ ...prev, color_hex: c.hex }))}
                                    style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '6px',
                                        backgroundColor: c.hex,
                                        border: sectorForm.color_hex === c.hex ? '3px solid #0f172a' : '1px solid rgba(0,0,0,0.2)',
                                        cursor: 'pointer',
                                        outline: 'none'
                                    }}
                                    title={c.label}
                                />
                            ))}
                            <input
                                type="color"
                                value={sectorForm.color_hex}
                                onChange={(e) => setSectorForm((prev) => ({ ...prev, color_hex: e.target.value }))}
                                style={{ width: '36px', height: '28px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                title="Color personalizado"
                            />
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                        <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                            Descripción / Observaciones
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Ej. Entregar agenda corporativa en mano al doctor"
                            value={sectorForm.descripcion}
                            onChange={(e) => setSectorForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setShowSectorModal(false)}
                            disabled={savingSector}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={savingSector}
                            style={{ fontWeight: 600 }}
                        >
                            {savingSector ? 'Guardando...' : editingSector ? 'Actualizar Sector' : 'Crear Sector'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
