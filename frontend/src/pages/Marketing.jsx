import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../state/AuthContext.jsx';
import { apiClient } from '../services/http/apiClient.js';
import CustomSelect from '../components/CustomSelect.jsx';
import Modal from '../components/Modal.jsx';
import WheelOfFortune from '../components/WheelOfFortune.jsx';
import '../styles/marketing.css';

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
        <div className="page-container animate-fade-in marketing-page">
            {/* Header del módulo */}
            <div className="page-header marketing-header">
                <div className="page-header-left">
                    <h1>
                        <i className="bi bi-megaphone-fill text-primary" aria-hidden="true"></i>
                        Marketing & Fidelización Comercial
                    </h1>
                    <p>
                        AFINIX DENTAL LAB S.A.C. · Cupones de descuento, ruleta para visitas de campo y recompensas por hitos.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={loadData}
                        title="Actualizar datos"
                        aria-label="Actualizar datos"
                    >
                        <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>
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
                        <i className="bi bi-plus-lg" aria-hidden="true"></i>
                        Nuevo Cupón
                    </button>
                </div>
            </div>

            {/* Shared collection-dashboard KPI presentation. */}
            <div className="grid dashboard-kpi-grid-liquid marketing-kpi-grid">
                <div className="card kpi-card dashboard-kpi-card dashboard-kpi-card--primary">
                    <div className="dashboard-kpi-shell">
                        <div className="dashboard-kpi-row">
                            <div className="kpi-icon" aria-hidden="true"><i className="bi bi-tags-fill" aria-hidden="true"></i></div>
                            <div className="dashboard-kpi-heading-group">
                                <div className="dashboard-kpi-heading">Cupones Activos</div>
                                <div className="dashboard-kpi-main-value">{metricas?.cupones_activos ?? cupones.filter(c => c.activo).length}</div>
                                <div className="dashboard-kpi-note">Disponibles para canje</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="card kpi-card dashboard-kpi-card dashboard-kpi-card--success">
                    <div className="dashboard-kpi-shell">
                        <div className="dashboard-kpi-row">
                            <div className="kpi-icon" aria-hidden="true"><i className="bi bi-bag-check-fill" aria-hidden="true"></i></div>
                            <div className="dashboard-kpi-heading-group">
                                <div className="dashboard-kpi-heading">Canjes Totales</div>
                                <div className="dashboard-kpi-main-value">{metricas?.total_canjes ?? 0}</div>
                                <div className="dashboard-kpi-note">Órdenes con descuento</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="card kpi-card dashboard-kpi-card dashboard-kpi-card--warning">
                    <div className="dashboard-kpi-shell">
                        <div className="dashboard-kpi-row">
                            <div className="kpi-icon" aria-hidden="true"><i className="bi bi-cash-stack" aria-hidden="true"></i></div>
                            <div className="dashboard-kpi-heading-group">
                                <div className="dashboard-kpi-heading">Ahorro Otorgado</div>
                                <div className="dashboard-kpi-main-value">S/. {Number(metricas?.total_ahorrado_soles || 0).toFixed(2)}</div>
                                <div className="dashboard-kpi-note">Beneficio total a doctores</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="card kpi-card dashboard-kpi-card dashboard-kpi-card--primary">
                    <div className="dashboard-kpi-shell">
                        <div className="dashboard-kpi-row">
                            <div className="kpi-icon" aria-hidden="true"><i className="bi bi-disc" aria-hidden="true"></i></div>
                            <div className="dashboard-kpi-heading-group">
                                <div className="dashboard-kpi-heading">Giros de Ruleta</div>
                                <div className="dashboard-kpi-main-value">{metricas?.total_giros_ruleta ?? historialGiros.length}</div>
                                <div className="dashboard-kpi-note">Participantes en visitas</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pestañas de Navegación */}
            <div className="section-tabs dashboard-view-switcher marketing-tabs" role="group" aria-label="Secciones de marketing">
                <button
                    type="button"
                    className={`btn section-tab dashboard-view-tab ${activeTab === 'cupones' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('cupones')}
                    aria-pressed={activeTab === 'cupones'}
                >
                    <i className="bi bi-ticket-perforated" aria-hidden="true"></i>
                    Cupones de Descuento ({cupones.length})
                </button>
                <button
                    type="button"
                    className={`btn section-tab dashboard-view-tab ${activeTab === 'ruleta' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('ruleta')}
                    aria-pressed={activeTab === 'ruleta'}
                >
                    <i className="bi bi-disc" aria-hidden="true"></i>
                    Ruleta de la Suerte (Eventos & Visitas)
                </button>
                <button
                    type="button"
                    className={`btn section-tab dashboard-view-tab ${activeTab === 'fidelizacion' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('fidelizacion')}
                    aria-pressed={activeTab === 'fidelizacion'}
                >
                    <i className="bi bi-trophy" aria-hidden="true"></i>
                    Hitos & Fidelización (Rewards)
                </button>
            </div>

            {/* CONTENIDO DE PESTAÑAS */}
            {activeTab === 'cupones' && (
                <div className="card dashboard-ops-panel" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Listado Oficial de Cupones</h3>
                        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                            Los cupones se validan en tiempo real en el Paso 3 del pedido técnico.
                        </span>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <div className="spinner" role="status" aria-label="Cargando cupones"></div>
                            <p style={{ marginTop: '0.5rem', color: 'var(--color-text-secondary)' }}>Cargando cupones...</p>
                        </div>
                    ) : cupones.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-secondary)' }}>
                            <i className="bi bi-tag" aria-hidden="true" style={{ fontSize: '2.5rem', opacity: 0.5 }}></i>
                            <p style={{ marginTop: '0.5rem' }}>No hay cupones registrados todavía.</p>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                    handleGenerateCode();
                                    setShowCreateModal(true);
                                }}
                            >
                                Crear primer cupón
                            </button>
                        </div>
                    ) : (
                        <div className="data-table-wrapper marketing-table-wrap">
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
                                                        background: 'var(--color-primary-ultra-light)',
                                                        color: 'var(--color-primary)',
                                                        padding: '0.2rem 0.5rem',
                                                        borderRadius: '6px',
                                                        fontWeight: 700
                                                    }}>
                                                        {c.codigo}
                                                    </code>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-ghost"
                                                        onClick={() => copyToClipboard(c.codigo)}
                                                        title="Copiar código"
                                                        aria-label="Copiar código"
                                                        style={{ padding: '0.15rem 0.35rem' }}
                                                    >
                                                        <i className="bi bi-copy" aria-hidden="true"></i>
                                                    </button>
                                                </div>
                                                {c.descripcion && (
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block', marginTop: '2px' }}>
                                                        {c.descripcion}
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <strong>
                                                    {c.tipo === 'porcentaje' ? `${Number(c.valor)}% DCTO` : `S/. ${Number(c.valor).toFixed(2)}`}
                                                </strong>
                                                {c.monto_minimo_pedido > 0 && (
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                                                        Mín: S/. {Number(c.monto_minimo_pedido).toFixed(2)}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                {c.clinica_nombre ? (
                                                    <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
                                                        <i className="bi bi-hospital" aria-hidden="true" style={{ marginRight: '4px' }}></i>
                                                        {c.clinica_nombre}
                                                    </span>
                                                ) : (
                                                    <span className="badge badge-inactive" style={{ background: 'var(--color-bg-alt)', color: 'var(--color-text-secondary)' }}>
                                                        Uso Libre (Cualquiera)
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <span className="badge" style={{
                                                    background: c.origen === 'ruleta_evento' ? 'var(--color-primary-light)' : 'var(--color-primary-ultra-light)',
                                                    color: c.origen === 'ruleta_evento' ? 'var(--color-primary)' : 'var(--color-primary)'
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
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Permanente</span>
                                                )}
                                            </td>
                                            <td>
                                                <span className={`badge ${c.activo ? 'badge-success' : 'badge-inactive'}`} style={{
                                                    background: c.activo ? 'var(--color-success-bg)' : 'var(--color-bg-alt)',
                                                    color: c.activo ? 'var(--color-success)' : 'var(--color-text-secondary)',
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
                                                        className={`btn btn-sm ${c.activo ? 'btn-ghost' : 'btn-ghost'}`}
                                                        onClick={() => handleToggleActive(c.id)}
                                                        title={c.activo ? 'Pausar cupón' : 'Activar cupón'}
                                                        aria-label={c.activo ? 'Pausar cupón' : 'Activar cupón'}
                                                    >
                                                        <i className={`bi ${c.activo ? 'bi-pause-fill' : 'bi-play-fill'}`} aria-hidden="true"></i>
                                                    </button>
                                                    {user?.tipo === 'admin' && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-ghost marketing-danger-action"
                                                            onClick={() => handleDeleteCoupon(c.id)}
                                                            title="Eliminar cupón"
                                                            aria-label="Eliminar cupón"
                                                        >
                                                            <i className="bi bi-trash" aria-hidden="true"></i>
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
                        background: 'var(--color-bg-alt)',
                        padding: '1rem 1.25rem',
                        borderRadius: '12px',
                        border: '1px solid var(--color-border)'
                    }}>
                        {/* Sub-pestañas de Ruleta */}
                        <div className="section-tabs marketing-tabs marketing-subtabs" role="group" aria-label="Secciones de ruleta">
                            <button
                                type="button"
                                className={`btn btn-sm ${ruletaSubTab === 'girar' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setRuletaSubTab('girar')}
                    aria-pressed={ruletaSubTab === 'girar'}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                            >
                                <i className="bi bi-play-circle-fill" aria-hidden="true"></i>
                                Girar Ruleta (Visitas)
                            </button>
                            <button
                                type="button"
                                className={`btn btn-sm ${ruletaSubTab === 'sectores' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setRuletaSubTab('sectores')}
                    aria-pressed={ruletaSubTab === 'sectores'}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                            >
                                <i className="bi bi-sliders" aria-hidden="true"></i>
                                Configurar Sectores & Probabilidades ({sectoresRuleta.length})
                            </button>
                            <button
                                type="button"
                                className={`btn btn-sm ${ruletaSubTab === 'historial' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setRuletaSubTab('historial')}
                    aria-pressed={ruletaSubTab === 'historial'}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                            >
                                <i className="bi bi-clock-history" aria-hidden="true"></i>
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
                                boxShadow: 'var(--shadow-sm)'
                            }}
                            title="Abre la ruleta limpia en pantalla completa, estilo Interacty"
                            aria-label="Abre la ruleta limpia en pantalla completa, estilo Interacty"
                        >
                            <i className="bi bi-box-arrow-up-right" aria-hidden="true"></i>
                            Lanzar Modo Kiosco Libre
                        </button>
                    </div>

                    {/* VISTA 1: PREPARACIÓN Y LANZADOR MODO INTERACTY */}
                    {ruletaSubTab === 'girar' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                            {/* Tarjeta 1: Preparación con Doctor Específico */}
                            <div className="card dashboard-ops-panel" style={{ padding: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <span style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '8px',
                                        background: 'var(--color-primary-light)',
                                        color: 'var(--color-primary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.2rem'
                                    }}>
                                        <i className="bi bi-person-fill-check" aria-hidden="true"></i>
                                    </span>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                                            Preparar Visita para Doctor Específico
                                        </h3>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                            Vincula el premio a la cuenta del doctor para que le llegue un pop-up a su portal.
                                        </p>
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                                    <label htmlFor="marketing-kioskParticipant-doctor_nombre" className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                        Nombre del Doctor(a)
                                    </label>
                                    <input
                                        id="marketing-kioskParticipant-doctor_nombre"
                                        type="text"
                                        className="form-input"
                                        placeholder="Ej. Dr. Carlos Valdivia"
                                        value={kioskParticipant.doctor_nombre}
                                        onChange={(e) => setKioskParticipant((prev) => ({ ...prev, doctor_nombre: e.target.value }))}
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                                    <label htmlFor="marketing-kioskParticipant-clinica_id" className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                        Clínica / Consultorio (Asignación)
                                    </label>
                                    <CustomSelect
                                        id="marketing-kioskParticipant-clinica_id"
                                        options={clinicOptions}
                                        value={kioskParticipant.clinica_id ? String(kioskParticipant.clinica_id) : ''}
                                        onChange={(_, val) => setKioskParticipant((prev) => ({ ...prev, clinica_id: val }))}
                                        placeholder="Uso Libre (o vincular con cuenta en portal)"
                                        searchable
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                                    <label htmlFor="marketing-kioskParticipant-doctor_telefono" className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                        Teléfono / WhatsApp (para entrega)
                                    </label>
                                    <input
                                        id="marketing-kioskParticipant-doctor_telefono"
                                        type="tel"
                                        className="form-input"
                                        placeholder="Ej. 958123456"
                                        value={kioskParticipant.doctor_telefono}
                                        onChange={(e) => setKioskParticipant((prev) => ({ ...prev, doctor_telefono: e.target.value }))}
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                    <label htmlFor="marketing-kioskParticipant-evento_nombre" className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                        Motivo o Evento
                                    </label>
                                    <input
                                        id="marketing-kioskParticipant-evento_nombre"
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
                                    <i className="bi bi-box-arrow-up-right" aria-hidden="true"></i>
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
                                            color: 'var(--color-success)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '1.2rem'
                                        }}>
                                            <i className="bi bi-stars" aria-hidden="true"></i>
                                        </span>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                                                Modo Kiosco Libre (Interacty Style)
                                            </h3>
                                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
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
                                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--color-text)', marginBottom: '0.5rem' }}>
                                            ¿Cómo funciona la Ruleta en Pantalla Completa?
                                        </div>
                                        <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
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
                                        backgroundColor: 'var(--color-success)',
                                        borderColor: 'var(--color-success)',
                                        color: '#ffffff'
                                    }}
                                >
                                    <i className="bi bi-play-circle-fill" aria-hidden="true"></i>
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
                                        <i className="bi bi-pie-chart-fill text-primary" aria-hidden="true"></i>
                                        Sectores y Algoritmo de Probabilidad
                                    </h3>
                                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                                        Control de premios variables (merch, porcentaje, monto fijo o sin premio). Los premios con stock agotado o pausados se excluyen automáticamente del azar.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={handleOpenNewSector}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                                >
                                    <i className="bi bi-plus-lg" aria-hidden="true"></i>
                                    Nuevo Sector / Premio
                                </button>
                            </div>

                            {/* Resumen de probabilidad activa */}
                            <div style={{
                                display: 'flex',
                                gap: '1rem',
                                flexWrap: 'wrap',
                                background: 'var(--color-bg-alt)',
                                padding: '0.85rem 1rem',
                                borderRadius: '10px',
                                marginBottom: '1.25rem',
                                border: '1px solid var(--color-border)',
                                fontSize: '0.85rem'
                            }}>
                                <div>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>Sectores Totales:</span>{' '}
                                    <strong>{sectoresRuleta.length}</strong>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>En Giro Activo:</span>{' '}
                                    <strong style={{ color: 'var(--color-primary)' }}>
                                        {sectoresRuleta.filter(s => s.activo && (!s.stock_disponible || s.stock_entregado < s.stock_disponible)).length}
                                    </strong>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>Peso Total Acumulado:</span>{' '}
                                    <strong>{totalPesoActivo} pts</strong>
                                </div>
                            </div>

                            {/* Tabla de sectores */}
                            <div className="data-table-wrapper marketing-table-wrap">
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
                                                                border: '1px solid var(--color-border)',
                                                                flexShrink: 0
                                                            }} />
                                                            <div>
                                                                <strong style={{ display: 'block', color: 'var(--color-text)' }}>{s.titulo}</strong>
                                                                {s.descripcion && (
                                                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                                                        {s.descripcion}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="badge" style={{
                                                            background: s.tipo_premio === 'merch' ? 'var(--color-primary-light)' :
                                                                s.tipo_premio === 'porcentaje' ? 'var(--color-primary-light)' :
                                                                s.tipo_premio === 'monto_fijo' ? 'var(--color-success-bg)' : 'var(--color-bg-alt)',
                                                            color: s.tipo_premio === 'merch' ? 'var(--color-primary)' :
                                                                s.tipo_premio === 'porcentaje' ? 'var(--color-primary)' :
                                                                s.tipo_premio === 'monto_fijo' ? 'var(--color-success)' : 'var(--color-text-secondary)',
                                                            fontWeight: 600
                                                        }}>
                                                            {s.tipo_premio === 'merch' && <i className="bi bi-box-seam" aria-hidden="true" style={{ marginRight: '4px' }}></i>}
                                                            {s.tipo_premio === 'porcentaje' && <i className="bi bi-percent" aria-hidden="true" style={{ marginRight: '4px' }}></i>}
                                                            {s.tipo_premio === 'monto_fijo' && <i className="bi bi-cash" aria-hidden="true" style={{ marginRight: '4px' }}></i>}
                                                            {s.tipo_premio === 'sin_premio' && <i className="bi bi-emoji-neutral" aria-hidden="true" style={{ marginRight: '4px' }}></i>}
                                                            {s.tipo_premio === 'merch' ? 'Merch / Físico' :
                                                                s.tipo_premio === 'porcentaje' ? 'Porcentaje' :
                                                                s.tipo_premio === 'monto_fijo' ? 'Monto Soles' : 'Sin Premio'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {s.tipo_premio === 'porcentaje' && <strong>{Number(s.valor)}% DCTO</strong>}
                                                        {s.tipo_premio === 'monto_fijo' && <strong>S/. {Number(s.valor).toFixed(2)} DCTO</strong>}
                                                        {s.tipo_premio === 'merch' && <span style={{ color: 'var(--color-text-secondary)' }}>Regalo de Marca</span>}
                                                        {s.tipo_premio === 'sin_premio' && <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>}
                                                    </td>
                                                    <td>
                                                        {s.stock_disponible === null ? (
                                                            <span className="badge badge-inactive" style={{ background: 'var(--color-bg-alt)', color: 'var(--color-text-secondary)' }}>
                                                                Ilimitado
                                                            </span>
                                                        ) : (
                                                            <div>
                                                                <span className={`badge ${isDepleted ? 'badge-danger' : 'marketing-badge-primary'}`} style={{
                                                                    background: isDepleted ? 'var(--color-error-bg)' : 'var(--color-primary-light)',
                                                                    color: isDepleted ? 'var(--color-error)' : 'var(--color-primary)',
                                                                    fontWeight: 600
                                                                }}>
                                                                    {Math.max(0, s.stock_disponible - s.stock_entregado)} de {s.stock_disponible} restantes
                                                                </span>
                                                                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                                                    {s.stock_entregado} entregados
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <span style={{ fontWeight: 600 }}>{s.probabilidad_peso} pts</span>
                                                            <span className="badge marketing-badge-primary" style={{
                                                                background: s.activo && !isDepleted ? 'var(--color-primary-light)' : 'var(--color-bg-alt)',
                                                                color: s.activo && !isDepleted ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
                                                                fontWeight: 700
                                                            }}>
                                                                {s.activo && !isDepleted ? `${s.probabilidad_porcentaje}%` : '0%'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {!s.activo ? (
                                                            <span className="badge" style={{ background: 'var(--color-bg-alt)', color: 'var(--color-text-secondary)' }}>Pausado</span>
                                                        ) : isDepleted ? (
                                                            <span className="badge" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>Agotado</span>
                                                        ) : (
                                                            <span className="badge" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>Activo</span>
                                                        )}
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                                            <button
                                                                type="button"
                                                                className={`btn btn-sm ${s.activo ? 'btn-ghost' : 'btn-ghost'}`}
                                                                onClick={() => handleToggleSector(s.id)}
                                                                title={s.activo ? 'Pausar sector' : 'Activar sector'}
                                                                aria-label={s.activo ? 'Pausar sector' : 'Activar sector'}
                                                            >
                                                                <i className={`bi ${s.activo ? 'bi-pause-fill' : 'bi-play-fill'}`} aria-hidden="true"></i>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-secondary"
                                                                onClick={() => handleOpenEditSector(s)}
                                                                title="Editar sector"
                                                                aria-label="Editar sector"
                                                            >
                                                                <i className="bi bi-pencil" aria-hidden="true"></i>
                                                            </button>
                                                            {user?.tipo === 'admin' && (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm btn-ghost marketing-danger-action"
                                                                    onClick={() => handleDeleteSector(s.id)}
                                                                    title="Eliminar sector"
                                                                    aria-label="Eliminar sector"
                                                                >
                                                                    <i className="bi bi-trash" aria-hidden="true"></i>
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
                                    <i className="bi bi-clock-history text-primary" aria-hidden="true"></i>
                                    Historial de Giros y Doctores Premiados
                                </h3>
                                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                    Últimos 100 giros registrados en visitas y eventos
                                </span>
                            </div>

                            {historialGiros.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '1.5rem 0' }}>
                                    Aún no se han realizado giros de ruleta. ¡Utiliza la herramienta superior en tu próxima visita!
                                </p>
                            ) : (
                                <div className="data-table-wrapper marketing-table-wrap">
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
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                                                <i className="bi bi-telephone" aria-hidden="true" style={{ marginRight: '3px' }}></i>
                                                                {g.doctor_telefono}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>{g.clinica_nombre || '—'}</td>
                                                    <td>{g.evento_nombre}</td>
                                                    <td>
                                                        <span className="badge marketing-badge-primary">
                                                            <span className="marketing-prize-dot" style={{ backgroundColor: g.color_hex }} aria-hidden="true" />
                                                            {g.premio_titulo}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {g.codigo_descuento_generado ? (
                                                            <code style={{ background: 'var(--color-bg-alt)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 700, letterSpacing: '0.05em' }}>
                                                                {g.codigo_descuento_generado}
                                                            </code>
                                                        ) : (
                                                            <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
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
                            background: 'var(--color-warning-bg)',
                            color: 'var(--color-warning)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.35rem'
                        }}>
                            <i className="bi bi-stars" aria-hidden="true"></i>
                        </span>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                                Motor de Fidelización y Gamificación Continua (Rewards)
                            </h3>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                                Reglas automáticas para premiar la recurrencia y celebrar fechas especiales con los doctores.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1.25rem', marginTop: '1rem' }}>
                        <div style={{ background: 'var(--color-bg-alt)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <i className="bi bi-10-circle-fill text-primary" aria-hidden="true" style={{ fontSize: '1.3rem' }}></i>
                                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600 }}>Hitos por Volumen de Pedidos</h4>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                                Disparador automático: cuando una clínica alcanza sus primeros <strong>10 trabajos</strong> o <strong>50 trabajos</strong> técnicos, el sistema genera automáticamente un cupón especial de felicitación y alerta al asesor asignado.
                            </p>
                            <span className="badge badge-success" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                                <i className="bi bi-check-circle" aria-hidden="true" style={{ marginRight: '4px' }}></i> Arquitectura Lista
                            </span>
                        </div>

                        <div style={{ background: 'var(--color-bg-alt)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <i className="bi bi-cake2-fill text-warning" aria-hidden="true" style={{ fontSize: '1.3rem' }}></i>
                                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600 }}>Cumpleaños de Doctores (CRM)</h4>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                                Conectado con la fecha de nacimiento registrada en <strong>Gestión de Clientes (CRM)</strong>. Muestra alertas preventivas de 7 días antes para coordinar el envío de regalo físico o cupón cumpleañero por WhatsApp.
                            </p>
                            <span className="badge marketing-badge-primary" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                                <i className="bi bi-link-45deg" aria-hidden="true" style={{ marginRight: '4px' }}></i> Conectado con CRM
                            </span>
                        </div>

                        <div style={{ background: 'var(--color-bg-alt)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <i className="bi bi-share-fill text-info" aria-hidden="true" style={{ fontSize: '1.3rem' }}></i>
                                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600 }}>Campañas & Redes Sociales</h4>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                                Creación de enlaces y códigos con seguimiento (UTM) para campañas en Instagram, Facebook y congresos odontológicos, midiendo cuántos pedidos provienen de cada esfuerzo publicitario.
                            </p>
                            <span className="badge badge-inactive" style={{ background: 'var(--color-bg-alt)', color: 'var(--color-text-secondary)' }}>
                                Planificado Fase 2
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CREAR CUPÓN */}
            <Modal
                className="marketing-modal"
                bodyClassName="marketing-modal-body"
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
                            <label htmlFor="marketing-formData-codigo" className="form-label" style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>
                                Código de Cupón <span style={{ color: 'var(--color-error)' }}>*</span>
                            </label>
                            <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={handleGenerateCode}
                            >
                                Generar Aleatorio
                            </button>
                        </div>
                        <input
                            id="marketing-formData-codigo"
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
                        <label htmlFor="marketing-formData-descripcion" className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                            Descripción o Motivo
                        </label>
                        <input
                            id="marketing-formData-descripcion"
                            type="text"
                            className="form-input"
                            placeholder="Ej. 10% de bienvenida en su primera corona"
                            value={formData.descripcion}
                            onChange={(e) => setFormData((prev) => ({ ...prev, descripcion: e.target.value }))}
                        />
                    </div>

                    <div className="marketing-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                        <div className="form-group">
                            <label htmlFor="marketing-formData-tipo" className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                Tipo de Descuento
                            </label>
                            <CustomSelect
                                id="marketing-formData-tipo"
                                options={typeOptions}
                                value={formData.tipo}
                                onChange={(_, val) => setFormData((prev) => ({ ...prev, tipo: val }))}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="marketing-formData-valor" className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                {formData.tipo === 'porcentaje' ? 'Porcentaje (%)' : 'Monto Fijo (S/.)'} <span style={{ color: 'var(--color-error)' }}>*</span>
                            </label>
                            <input
                                id="marketing-formData-valor"
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

                    <div className="marketing-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                        <div className="form-group">
                            <label htmlFor="marketing-formData-monto_minimo_pedido" className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                Pedido Mínimo (S/.)
                            </label>
                            <input
                                id="marketing-formData-monto_minimo_pedido"
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
                                <label htmlFor="marketing-formData-tope_descuento_maximo" className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                    Tope Máximo DCTO (S/.)
                                </label>
                                <input
                                    id="marketing-formData-tope_descuento_maximo"
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
                                <label htmlFor="marketing-formData-limite_usos_total" className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                    Límite Usos Totales
                                </label>
                                <input
                                    id="marketing-formData-limite_usos_total"
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
                        <label htmlFor="marketing-formData-clinica_id" className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                            Asignación Exclusiva (Clínica / Doctor)
                        </label>
                        <CustomSelect
                            id="marketing-formData-clinica_id"
                            options={clinicOptions}
                            value={formData.clinica_id ? String(formData.clinica_id) : ''}
                            onChange={(_, val) => setFormData((prev) => ({ ...prev, clinica_id: val }))}
                            searchable
                            placeholder="Uso libre para cualquier clínica..."
                        />
                    </div>

                    <div className="marketing-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                        <div className="form-group">
                            <label htmlFor="marketing-formData-fecha_fin" className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                Fecha de Vencimiento
                            </label>
                            <input
                                id="marketing-formData-fecha_fin"
                                type="date"
                                className="form-input"
                                value={formData.fecha_fin}
                                onChange={(e) => setFormData((prev) => ({ ...prev, fecha_fin: e.target.value }))}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="marketing-formData-evento_nombre" className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                Nombre de Evento
                            </label>
                            <input
                                id="marketing-formData-evento_nombre"
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
                className="marketing-modal"
                bodyClassName="marketing-modal-body"
                open={showSectorModal}
                onClose={() => setShowSectorModal(false)}
                title={editingSector ? 'Editar Sector de la Ruleta' : 'Nuevo Sector en la Ruleta'}
                subtitle="Configura el premio, color, stock físico y peso de probabilidad (Interacty style)" aria-label="Configura el premio, color, stock físico y peso de probabilidad (Interacty style)"
                icon="bi-pie-chart-fill"
                size="md"
            >
                <form onSubmit={handleSaveSector}>
                    <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                        <label htmlFor="marketing-sectorForm-titulo" className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                            Título Visible en la Ruleta <span style={{ color: 'var(--color-error)' }}>*</span>
                        </label>
                        <input
                            id="marketing-sectorForm-titulo"
                            type="text"
                            className="form-input"
                            placeholder="Ej. 15% OFF, Agenda 2026, S/. 50 Soles, Sigue Intentando"
                            value={sectorForm.titulo}
                            onChange={(e) => setSectorForm((prev) => ({ ...prev, titulo: e.target.value }))}
                            required
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                        <label htmlFor="marketing-sectorForm-tipo_premio" className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                            Tipo de Premio <span style={{ color: 'var(--color-error)' }}>*</span>
                        </label>
                        <CustomSelect
                            id="marketing-sectorForm-tipo_premio"
                            options={prizeTypeOptions}
                            value={sectorForm.tipo_premio}
                            onChange={(_, val) => setSectorForm((prev) => ({ ...prev, tipo_premio: val }))}
                        />
                    </div>

                    {['porcentaje', 'monto_fijo'].includes(sectorForm.tipo_premio) && (
                        <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                            <label htmlFor="marketing-sectorForm-valor" className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                {sectorForm.tipo_premio === 'porcentaje' ? 'Porcentaje de Descuento (%)' : 'Monto de Descuento (S/.)'} <span style={{ color: 'var(--color-error)' }}>*</span>
                            </label>
                            <input
                                id="marketing-sectorForm-valor"
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

                    <div className="marketing-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                        <div className="form-group">
                            <label htmlFor="marketing-sectorForm-stock_disponible" className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                Stock Disponible (Unidades)
                            </label>
                            <input
                                id="marketing-sectorForm-stock_disponible"
                                type="number"
                                min="1"
                                className="form-input"
                                placeholder="Ilimitado (vacío)"
                                value={sectorForm.stock_disponible}
                                onChange={(e) => setSectorForm((prev) => ({ ...prev, stock_disponible: e.target.value }))}
                            />
                            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                                Al agotarse, sale de la ruleta automáticamente.
                            </span>
                        </div>

                        <div className="form-group">
                            <label htmlFor="marketing-sectorForm-probabilidad_peso" className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                Peso de Probabilidad (1 - 100) <span style={{ color: 'var(--color-error)' }}>*</span>
                            </label>
                            <input
                                id="marketing-sectorForm-probabilidad_peso"
                                type="number"
                                min="1"
                                max="1000"
                                className="form-input"
                                value={sectorForm.probabilidad_peso}
                                onChange={(e) => setSectorForm((prev) => ({ ...prev, probabilidad_peso: e.target.value }))}
                                required
                            />
                            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                                Mayor peso = más probable.
                            </span>
                        </div>
                    </div>

                    {/* Paleta de Color del Sector */}
                    <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                        <label htmlFor="marketing-sectorForm-color_hex" className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                            Color de la Tajada
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                            {colorPresets.map((c) => (
                                <button
                                    key={c.hex}
                                    className="marketing-color-swatch"
                                    aria-pressed={sectorForm.color_hex === c.hex}
                                    type="button"
                                    onClick={() => setSectorForm((prev) => ({ ...prev, color_hex: c.hex }))}
                                    style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '6px',
                                        backgroundColor: c.hex,
                                        border: sectorForm.color_hex === c.hex ? '3px solid var(--color-text)' : '1px solid var(--color-border)',
                                        cursor: 'pointer',
                                        outlineOffset: '3px'
                                    }}
                                    title={c.label}
                                    aria-label={c.label}
                                />
                            ))}
                            <input
                                id="marketing-sectorForm-color_hex"
                                type="color"
                                value={sectorForm.color_hex}
                                onChange={(e) => setSectorForm((prev) => ({ ...prev, color_hex: e.target.value }))}
                                style={{ width: '36px', height: '28px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                title="Color personalizado"
                                aria-label="Color personalizado"
                            />
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                        <label htmlFor="marketing-sectorForm-descripcion" className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                            Descripción / Observaciones
                        </label>
                        <input
                            id="marketing-sectorForm-descripcion"
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
