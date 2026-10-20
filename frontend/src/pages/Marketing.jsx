import { resolveImageUrl } from '../utils/resolveImageUrl.js';
import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../state/AuthContext.jsx';
import { apiClient } from '../services/http/apiClient.js';
import CustomSelect from '../components/CustomSelect.jsx';
import Modal from '../components/Modal.jsx';
import { readMarketingData, marketingErrorMessage, settleMarketingResources, marketingClinicLabel } from './marketingData.js';
import FormDatePicker from '../components/FormDatePicker.jsx';
import MarketingInvitation from './MarketingInvitation.jsx';
import MarketingCampaignComposer from './MarketingCampaignComposer.jsx';
import RuletaCustomizer from '../components/RuletaCustomizer.jsx';
import { eligibleInvitationCoupon } from './marketingInvitation.js';
import '../styles/marketing.css';

export default function Marketing() {
    const { getHeaders, user } = useAuth();

    const [activeTab, setActiveTab] = useState('cupones');
    const [metricas, setMetricas] = useState(null);
    const [cupones, setCupones] = useState([]);
    const [historialGiros, setHistorialGiros] = useState([]);
    const [sectoresRuleta, setSectoresRuleta] = useState([]);
    const [totalPesoActivo, setTotalPesoActivo] = useState(0);
    const [clinicas, setClinicas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingRuleta, setLoadingRuleta] = useState(false);
    const [errors, setErrors] = useState({});

    // Sub-pestaña dentro de Ruleta
    const [ruletaSubTab, setRuletaSubTab] = useState('sectores'); // 'sectores' | 'historial'

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
    const [invitationCouponContext, setInvitationCouponContext] = useState(false);
    const [couponSaveError, setCouponSaveError] = useState('');
    const invitationCouponCallback = useRef(null);
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

    const pendingKioskRefresh = useRef(false);
    const loadDataRef = useRef(null);

    // --- ESTADOS: CAMPAÑAS VISUALES & PUSH BROADCAST ---
    const [campanas, setCampanas] = useState([]);
    const [loadingCampanas, setLoadingCampanas] = useState(false);
    const [showCampanaModal, setShowCampanaModal] = useState(false);

    // Modal de confirmación de eliminación segura (Cupones, Campañas)
    const [deleteModal, setDeleteModal] = useState({
        open: false,
        type: '', // 'coupon' | 'campaign'
        id: null,
        title: '',
        details: null,
        loading: false
    });
    const loadData = async (section = activeTab, refreshMetrics = true) => {
        const headers = getHeaders();
        const metricsRequest = refreshMetrics || section === 'cupones'
            ? apiClient.get('/api/marketing/metricas', { headers }).catch(() => null)
            : null;
        if (section === 'cupones') setLoading(true);
        if (section === 'campanas') setLoadingCampanas(true);
        if (section === 'ruleta') setLoadingRuleta(true);
        const resources = [];
        const addResource = (key, path, onSuccess) => resources.push({
            key, request: () => apiClient.get(path, { headers }), onSuccess
        });
        if (section === 'cupones' || section === 'bienvenida') {
            addResource(section, '/api/marketing/cupones', (response) => setCupones(readMarketingData(response)));
        }
        if (section === 'campanas') {
            addResource('campanas', '/api/marketing/campanas', (response) => setCampanas(readMarketingData(response)));
        }
        if (section === 'ruleta') {
            addResource('historial', '/api/marketing/ruleta/historial', (response) => setHistorialGiros(readMarketingData(response)));
            addResource('premios', '/api/marketing/ruleta/premios/admin', (response) => {
                setSectoresRuleta(readMarketingData(response));
                setTotalPesoActivo(response.totalPesoActivo || 0);
            });
        }
        if (['campanas', 'ruleta', 'clinicas'].includes(section) && (section === 'clinicas' || clinicas.length === 0)) {
            addResource('clinicas', '/api/marketing/campanas/clinicas', (response) => setClinicas(readMarketingData(response)));
        }
        setErrors((previous) => ({ ...previous, ...Object.fromEntries(resources.map(({ key }) => [key, null])) }));
        try {
            await settleMarketingResources(resources, (key, err) => {
                const message = key === 'clinicas' ? 'No se pudieron cargar las clínicas.' : marketingErrorMessage(err, 'No se pudieron cargar los datos.');
                setErrors((previous) => ({ ...previous, [key]: message }));
            });
        } finally {
            if (section === 'cupones') setLoading(false);
            if (section === 'campanas') setLoadingCampanas(false);
            if (section === 'ruleta') setLoadingRuleta(false);
        }
        if (metricsRequest) {
            const response = await metricsRequest;
            try { setMetricas(response ? readMarketingData(response) : null); }
            catch { setMetricas(null); }
        }
    };

    // Recarga silenciosa exclusiva para la ruleta sin desmontar el componente ni poner spinners
    const refreshRuletaPremiosSilently = async () => {
        try {
            const res = await apiClient.get('/api/marketing/ruleta/premios/admin', { headers: getHeaders() });
            const list = readMarketingData(res);
            setSectoresRuleta(list);
            if (res?.totalPesoActivo !== undefined) setTotalPesoActivo(res.totalPesoActivo);
            return list;
        } catch {
            return null;
        }
    };

    const handleToggleCampana = async (id) => {
        try {
            await apiClient.patch(`/api/marketing/campanas/${id}/toggle`, {}, {
                headers: getHeaders()
            });
            toast.success('Estado de campaña actualizado');
            loadData('campanas');
        } catch {
            toast.error('Error al cambiar estado de campaña');
        }
    };

    useEffect(() => {
        loadData(activeTab, false);
    }, [activeTab]);

    loadDataRef.current = loadData;
    useEffect(() => {
        const refreshAfterKiosk = () => {
            if (!pendingKioskRefresh.current || document.visibilityState !== 'visible') return;
            pendingKioskRefresh.current = false;
            loadDataRef.current('ruleta');
        };
        window.addEventListener('focus', refreshAfterKiosk);
        document.addEventListener('visibilitychange', refreshAfterKiosk);
        return () => {
            window.removeEventListener('focus', refreshAfterKiosk);
            document.removeEventListener('visibilitychange', refreshAfterKiosk);
        };
    }, []);

    const handleGenerateCode = () => {
        const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
        setFormData((prev) => ({ ...prev, codigo: `AFX-${randomStr}` }));
    };

    const closeCouponModal = () => {
        if (creating) return;
        invitationCouponCallback.current = null;
        setShowCreateModal(false);
        setInvitationCouponContext(false);
        setCouponSaveError('');
    };

    const openInvitationCoupon = (onCreated) => {
        setCouponSaveError('');
        invitationCouponCallback.current = onCreated;
        setInvitationCouponContext(true);
        setFormData({ codigo: `AFX-${Math.random().toString(36).substring(2, 8).toUpperCase()}`, descripcion: 'Bienvenida a AFINIX Dental Lab', tipo: 'monto_fijo', valor: '', tope_descuento_maximo: '', monto_minimo_pedido: '', limite_usos_total: '1', limite_usos_por_doctor: '1', fecha_fin: '', clinica_id: '', evento_nombre: '', origen: 'manual' });
        setShowCreateModal(true);
    };

    const handleCreateCoupon = async (e) => {
        e.preventDefault();
        setCouponSaveError('');
        if (!formData.codigo.trim()) {
            toast.error('El código es obligatorio');
            return;
        }
        const value = Number(formData.valor);
        if (!Number.isFinite(value) || value <= 0 || (formData.tipo === 'porcentaje' && value > 100)) {
            toast.error('El descuento debe ser mayor a 0 y el porcentaje no puede superar 100');
            return;
        }
        if ([formData.limite_usos_total, formData.limite_usos_por_doctor].some((limit) => !Number.isInteger(Number(limit)) || Number(limit) < 1)) {
            toast.error('Los límites de uso deben ser números enteros mayores a 0');
            return;
        }
        if (formData.fecha_fin && new Date(`${formData.fecha_fin}T23:59:59.999`).getTime() <= Date.now()) {
            toast.error('Elige una fecha de vencimiento futura');
            return;
        }

        setCreating(true);
        try {
            const response = await apiClient.post('/api/marketing/cupones', formData, {
                headers: getHeaders()
            });
            const savedCoupon = readMarketingData(response);
            if (!savedCoupon?.id || !savedCoupon?.codigo) throw new Error('No se pudo confirmar el cupón guardado. Revisa la lista antes de volver a crearlo.');
            setCupones((previous) => [savedCoupon, ...previous.filter((coupon) => coupon.id !== savedCoupon.id)]);
            if (invitationCouponCallback.current) {
                if (invitationCouponContext && eligibleInvitationCoupon(savedCoupon)) {
                    setErrors((previous) => ({ ...previous, bienvenida: null }));
                }
                invitationCouponCallback.current(savedCoupon.codigo, savedCoupon);
            }
            invitationCouponCallback.current = null;
            toast.success('Cupón creado exitosamente');
            setShowCreateModal(false);
            setInvitationCouponContext(false);
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
            loadData(activeTab);
        } catch (err) {
            const msg = marketingErrorMessage(err, 'Error al crear el cupón');
            setCouponSaveError(msg);
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
            loadData('cupones');
        } catch (err) {
            toast.error(marketingErrorMessage(err, 'No se pudo actualizar el cupón'));
        }
    };

    const promptDeleteCoupon = (c) => {
        setDeleteModal({
            open: true,
            type: 'coupon',
            id: c.id,
            title: c.codigo,
            details: {
                badge: c.tipo === 'porcentaje' ? `${c.valor}% OFF` : `S/. ${c.valor} OFF`,
                subtitle: c.descripcion || 'Sin descripción adicional',
                usos: `Límite: ${c.limite_usos_total} usos • Canjeados: ${c.total_usos || 0}`
            },
            loading: false
        });
    };

    const promptDeleteCampana = (cmp) => {
        setDeleteModal({
            open: true,
            type: 'campaign',
            id: cmp.id,
            title: cmp.titulo,
            details: {
                badge: cmp.canal === 'in_app' ? 'In-App Banner' : cmp.canal === 'push' ? 'Push Broadcast' : 'Multicanal',
                subtitle: cmp.subtitulo || cmp.mensaje || 'Campaña de difusión',
                usos: cmp.activo ? 'Estado actual: Activa' : 'Estado actual: Pausada'
            },
            loading: false
        });
    };

    const handleConfirmDelete = async () => {
        if (!deleteModal.id || !deleteModal.type) return;
        setDeleteModal((prev) => ({ ...prev, loading: true }));
        try {
            if (deleteModal.type === 'coupon') {
                const res = await apiClient.delete(`/api/marketing/cupones/${deleteModal.id}`, {
                    headers: getHeaders()
                });
                toast.success(res?.message || 'Cupón eliminado correctamente');
                loadData('cupones');
            } else if (deleteModal.type === 'campaign') {
                const res = await apiClient.delete(`/api/marketing/campanas/${deleteModal.id}`, {
                    headers: getHeaders()
                });
                toast.success(res?.message || 'Campaña eliminada correctamente');
                loadData('campanas');
            }
            setDeleteModal({ open: false, type: '', id: null, title: '', details: null, loading: false });
        } catch (err) {
            toast.error(marketingErrorMessage(err, `Error al eliminar ${deleteModal.type === 'coupon' ? 'el cupón' : 'la campaña'}`));
            setDeleteModal((prev) => ({ ...prev, loading: false }));
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => toast.success(`Código ${text} copiado`))
            .catch(() => toast.error('No se pudo copiar el código.'));
    };

    const clinicOptions = [
        { value: '', label: 'Cualquier clínica / doctor (Uso Libre)' },
        ...clinicas.map((c) => ({ value: String(c.id), label: marketingClinicLabel(c) }))
    ];

    const typeOptions = [
        { value: 'porcentaje', label: 'Porcentaje (%)', icon: 'bi-percent' },
        { value: 'monto_fijo', label: 'Monto Fijo (S/)', icon: 'bi-cash' }
    ];

    const prizeTypeOptions = [
        { value: 'porcentaje', label: 'Porcentaje (% OFF)', icon: 'bi-percent' },
        { value: 'monto_fijo', label: 'Monto Fijo (S/ OFF)', icon: 'bi-cash' },
        { value: 'merch', label: 'Merchandising / Regalo', icon: 'bi-gift' },
        { value: 'sin_premio', label: 'Sin Premio', icon: 'bi-emoji-neutral' }
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
            loadData('ruleta');
        } catch (err) {
            toast.error(marketingErrorMessage(err, 'Error al guardar sector'));
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
            loadData('ruleta');
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
            toast.success(res.message || 'Sector eliminado');
            loadData('ruleta');
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
        pendingKioskRefresh.current = true;
        window.open('/ruleta-evento', '_blank');
    };

    return (
        <div className="page-container animate-fade-in marketing-page">
            {/* Header del módulo */}
            <div className="page-header marketing-header">
                <div className="page-header-left">
                    <h1>
                        <i className="bi bi-megaphone-fill text-primary" aria-hidden="true"></i>
                        Marketing
                    </h1>
                    <p>
                        Cupones, campañas e invitaciones para clientes.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {activeTab === 'cupones' && <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                            handleGenerateCode();
                            setShowCreateModal(true);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
                    >
                        <i className="bi bi-plus-lg" aria-hidden="true"></i>
                        Nuevo cupón
                    </button>}
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
                                <div className="dashboard-kpi-main-value">{metricas?.cupones_activos ?? '—'}</div>
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
                                <div className="dashboard-kpi-main-value">{metricas?.total_canjes ?? '—'}</div>
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
                                <div className="dashboard-kpi-main-value">{metricas ? `S/. ${Number(metricas.total_ahorrado_soles || 0).toFixed(2)}` : '—'}</div>
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
                                <div className="dashboard-kpi-main-value">{metricas?.total_giros_ruleta ?? '—'}</div>
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
                    Cupones ({cupones.length})
                </button>
                <button
                    type="button"
                    className={`btn section-tab dashboard-view-tab ${activeTab === 'bienvenida' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('bienvenida')}
                    aria-pressed={activeTab === 'bienvenida'}
                >
                    <i className="bi bi-whatsapp" aria-hidden="true"></i>
                    Invitaciones
                </button>
                <button
                    type="button"
                    className={`btn section-tab dashboard-view-tab ${activeTab === 'campanas' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('campanas')}
                    aria-pressed={activeTab === 'campanas'}
                >
                    <i className="bi bi-broadcast" aria-hidden="true"></i>
                    Campañas ({campanas.length})
                </button>
                <button
                    type="button"
                    className={`btn section-tab dashboard-view-tab ${activeTab === 'ruleta' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('ruleta')}
                    aria-pressed={activeTab === 'ruleta'}
                >
                    <i className="bi bi-disc" aria-hidden="true"></i>
                    Ruleta
                </button>
            </div>

            {/* CONTENIDO DE PESTAÑAS */}
            {['bienvenida', 'campanas', 'ruleta'].includes(activeTab) && errors.clinicas && (
                <div className="marketing-load-error" role="alert">
                    {errors.clinicas}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => loadData('clinicas', false)}>Reintentar clínicas</button>
                </div>
            )}
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
                    ) : errors.cupones ? (
                        <div className="marketing-load-error" role="alert">{errors.cupones} <button type="button" className="btn btn-secondary btn-sm" onClick={() => loadData('cupones')}>Reintentar</button></div>
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
                                                            onClick={() => promptDeleteCoupon(c)}
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

            <div hidden={activeTab !== 'bienvenida'}>
                {errors.bienvenida && <div className="marketing-load-error" role="alert">{errors.bienvenida} <button type="button" className="btn btn-secondary btn-sm" onClick={() => loadData('bienvenida')}>Reintentar</button></div>}
                <MarketingInvitation coupons={cupones} couponsError={errors.bienvenida} onCreateCoupon={openInvitationCoupon} />
            </div>

            {activeTab === 'campanas' && (
                <div className="card dashboard-ops-panel" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <i className="bi bi-broadcast text-primary" aria-hidden="true"></i>
                                Campañas
                            </h3>
                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                                Envía comunicaciones a clientes activos.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => setShowCampanaModal(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                        >
                            <i className="bi bi-send-fill" aria-hidden="true"></i>
                            Nueva campaña
                        </button>
                    </div>

                    {loadingCampanas ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <div className="spinner" role="status"></div>
                            <p style={{ marginTop: '0.5rem', color: 'var(--color-text-secondary)' }}>Cargando campañas...</p>
                        </div>
                    ) : errors.campanas ? (
                        <div className="marketing-load-error" role="alert">{errors.campanas} <button type="button" className="btn btn-secondary btn-sm" onClick={() => loadData('campanas')}>Reintentar</button></div>
                    ) : campanas.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-secondary)' }}>
                            <i className="bi bi-megaphone" aria-hidden="true" style={{ fontSize: '2.5rem', opacity: 0.5 }}></i>
                            <p style={{ marginTop: '0.5rem' }}>No hay campañas registradas todavía.</p>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setShowCampanaModal(true)}
                            >
                                Crear primera campaña
                            </button>
                        </div>
                    ) : (
                        <div className="data-table-wrapper marketing-table-wrap">
                            <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr>
                                        <th>Campaña & Imagen</th>
                                        <th>Mensaje</th>
                                        <th>Audiencia</th>
                                        <th>Beneficio / Destino</th>
                                        <th>Impacto</th>
                                        <th>Estado</th>
                                        <th style={{ textAlign: 'right' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {campanas.map((cmp) => (
                                        <tr key={cmp.id}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                    {cmp.imagen_url ? (
                                                        <img
                                                            src={resolveImageUrl(cmp.imagen_url)}
                                                            alt={cmp.titulo}
                                                            style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }}
                                                        />
                                                    ) : (
                                                        <div style={{
                                                            width: '40px',
                                                            height: '40px',
                                                            borderRadius: '8px',
                                                            background: 'var(--color-primary-light)',
                                                            color: 'var(--color-primary)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '1.1rem'
                                                        }}>
                                                            <i className="bi bi-image" aria-hidden="true"></i>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <strong>{cmp.titulo}</strong>
                                                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                                                            {new Date(cmp.created_at).toLocaleDateString('es-PE')}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <p style={{ margin: 0, maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {cmp.mensaje}
                                                </p>
                                            </td>
                                            <td>
                                                <span className="badge" style={{
                                                    background: cmp.tipo_audiencia === 'inactivos' ? 'var(--color-warning-bg)' : 'var(--color-primary-light)',
                                                    color: cmp.tipo_audiencia === 'inactivos' ? 'var(--color-warning)' : 'var(--color-primary)',
                                                    fontWeight: 600
                                                }}>
                                                    {cmp.tipo_audiencia === 'todos' ? 'Clientes con portal' : cmp.tipo_audiencia === 'inactivos' ? 'Sin pedidos en 30 días' : 'Clínicas seleccionadas'}
                                                </span>
                                            </td>
                                            <td>
                                                {cmp.codigo_descuento ? (
                                                    <code style={{ background: 'var(--color-bg-alt)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                                                        {cmp.codigo_descuento}
                                                    </code>
                                                ) : (
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                                        {cmp.link_destino || 'General'}
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ fontSize: '0.82rem' }}>
                                                    {cmp.envio_metricas ? <><strong>{cmp.envio_metricas.cuentas_objetivo}</strong> cuentas objetivo<br />{cmp.envio_metricas.avisos_portal} avisos portal<br />{cmp.envio_metricas.push_aceptados} Push aceptados · {cmp.envio_metricas.push_fallidos} fallidos<br />{cmp.envio_metricas.push_inciertos + cmp.envio_metricas.push_pendientes > 0 ? 'Resultados pendientes de confirmar' : cmp.envio_estado === 'partial' ? 'Procesamiento parcial' : 'Procesamiento finalizado'}</> : 'Campaña anterior: entrega no verificada'}
                                                </div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                                                    Push aceptado no confirma entrega
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`badge ${cmp.activo ? 'badge-success' : 'badge-inactive'}`} style={{
                                                    background: cmp.activo ? 'var(--color-success-bg)' : 'var(--color-bg-alt)',
                                                    color: cmp.activo ? 'var(--color-success)' : 'var(--color-text-secondary)'
                                                }}>
                                                    {cmp.activo ? 'Activa' : 'Pausada'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-ghost"
                                                        onClick={() => handleToggleCampana(cmp.id)}
                                                        title={cmp.activo ? 'Pausar campaña' : 'Activar campaña'}
                                                        aria-label={cmp.activo ? 'Pausar campaña' : 'Activar campaña'}
                                                    >
                                                        <i className={`bi ${cmp.activo ? 'bi-pause-fill' : 'bi-play-fill'}`} aria-hidden="true"></i>
                                                    </button>
                                                    {user?.tipo === 'admin' && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-ghost marketing-danger-action"
                                                            onClick={() => promptDeleteCampana(cmp)}
                                                            title="Eliminar campaña"
                                                            aria-label="Eliminar campaña"
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
                    {['premios', 'historial'].filter((key) => errors[key]).map((key) => (
                        <div key={key} className="marketing-load-error" role="alert">
                            {key === 'premios' ? 'Sectores de ruleta: ' : 'Historial de giros: '}{errors[key]}
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => loadData('ruleta', false)}>Reintentar ruleta</button>
                        </div>
                    ))}
                    {loadingRuleta && <p role="status">Cargando ruleta…</p>}
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
                                className={`btn btn-sm ${ruletaSubTab === 'sectores' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setRuletaSubTab('sectores')}
                                aria-pressed={ruletaSubTab === 'sectores'}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                            >
                                <i className="bi bi-sliders" aria-hidden="true"></i>
                                Configurar Sectores & Probabilidades ({loadingRuleta || errors.premios ? '—' : sectoresRuleta.length})
                            </button>
                            <button
                                type="button"
                                className={`btn btn-sm ${ruletaSubTab === 'historial' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setRuletaSubTab('historial')}
                                aria-pressed={ruletaSubTab === 'historial'}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                            >
                                <i className="bi bi-clock-history" aria-hidden="true"></i>
                                Historial de Giros ({loadingRuleta || errors.historial ? '—' : historialGiros.length})
                            </button>
                        </div>

                        {/* Botón Principal: Lanzar Ruleta en Pantalla Completa */}
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => handleLaunchKiosk(true)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.55rem',
                                fontWeight: 800,
                                padding: '0.55rem 1.25rem',
                                borderRadius: '10px',
                                boxShadow: '0 4px 15px rgba(2, 132, 199, 0.35)',
                                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                            }}
                            title="Abre la ruleta inmersiva con escenario 3D en pantalla completa"
                            aria-label="Abrir Ruleta AFINIX en Pantalla Completa"
                        >
                            <i className="bi bi-play-circle-fill" style={{ fontSize: '1.15rem' }} aria-hidden="true"></i>
                            Abrir Ruleta AFINIX en Pantalla Completa
                        </button>
                    </div>



                    {/* VISTA 2: CONFIGURADOR ESTILO INTERACTY CON VISTA PREVIA EN VIVO */}
                    {ruletaSubTab === 'sectores' && !loadingRuleta && !errors.premios && (
                        <RuletaCustomizer
                            sectores={sectoresRuleta}
                            totalPesoActivo={totalPesoActivo}
                            onUpdateSectoresLocally={setSectoresRuleta}
                            onReloadSectores={refreshRuletaPremiosSilently}
                            getHeaders={getHeaders}
                            onLaunchKiosk={() => handleLaunchKiosk(true)}
                        />
                    )}

                    {/* VISTA 3: HISTORIAL DE GIROS */}
                    {ruletaSubTab === 'historial' && !loadingRuleta && !errors.historial && (
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

            {/* MODAL CREAR CUPÓN */}
            <Modal
                className="marketing-modal"
                bodyClassName="marketing-modal-body"
                open={showCreateModal}
                onClose={closeCouponModal}
                title={invitationCouponContext ? 'Crear cupón de bienvenida' : 'Nuevo Cupón Promocional'}
                subtitle="Configura descuentos en soles o porcentaje con límites y vigencia"
                icon="bi-tag-fill"
                size="lg"
            >
                <form onSubmit={handleCreateCoupon}>
                    {couponSaveError && <p className="marketing-form-note" role="alert">{couponSaveError}</p>}
                    <fieldset disabled={creating} className="marketing-coupon-fields">
                    {/* 1. Código y Motivo */}
                    <div className="marketing-form-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '0.75rem', marginBottom: '0.85rem' }}>
                        <div className="form-group">
                            <label htmlFor="marketing-formData-codigo" className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                Código del cupón <span style={{ color: 'var(--color-error)' }}>*</span>
                            </label>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <input
                                    id="marketing-formData-codigo"
                                    type="text"
                                    className="form-input"
                                    placeholder="Ej. BIENVENIDA50"
                                    value={formData.codigo}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                                    required
                                    style={{ fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}
                                />
                                <button
                                    type="button"
                                    className="btn btn-sm btn-secondary"
                                    onClick={handleGenerateCode}
                                    title="Generar código aleatorio AFX-"
                                    aria-label="Generar código aleatorio"
                                    style={{ padding: '0 10px', display: 'grid', placeItems: 'center', minWidth: '38px' }}
                                >
                                    <i className="bi bi-shuffle" aria-hidden="true" style={{ fontSize: '1rem' }} />
                                </button>
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="marketing-formData-descripcion" className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                Motivo / Descripción
                            </label>
                            <input
                                id="marketing-formData-descripcion"
                                type="text"
                                className="form-input"
                                placeholder="Ej. Bienvenida o apertura"
                                value={formData.descripcion}
                                onChange={(e) => setFormData((prev) => ({ ...prev, descripcion: e.target.value }))}
                            />
                        </div>
                    </div>

                    {/* 2. Beneficio: Tipo, Valor y Vencimiento */}
                    <div className="marketing-form-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
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
                                {formData.tipo === 'porcentaje' ? 'Porcentaje (%)' : 'Monto (S/.)'} <span style={{ color: 'var(--color-error)' }}>*</span>
                            </label>
                            <input
                                id="marketing-formData-valor"
                                type="number"
                                step="0.01"
                                min="0.01"
                                max={formData.tipo === 'porcentaje' ? '100' : undefined}
                                className="form-input"
                                placeholder={formData.tipo === 'porcentaje' ? '15' : '50.00'}
                                value={formData.valor}
                                onChange={(e) => setFormData((prev) => ({ ...prev, valor: e.target.value }))}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="marketing-formData-fecha_fin" className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                Vence el (opcional)
                            </label>
                            <FormDatePicker
                                id="marketing-formData-fecha_fin"
                                value={formData.fecha_fin}
                                onChange={(iso) => setFormData((prev) => ({ ...prev, fecha_fin: iso }))}
                            />
                        </div>
                    </div>

                    {/* 3. Condiciones avanzadas colapsables */}
                    <details style={{ background: 'var(--color-bg-alt)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--color-border)', marginBottom: '1rem' }}>
                        <summary style={{ cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text)' }}>
                            Condiciones y límites de uso (opcional)
                        </summary>
                        <div style={{ marginTop: '10px', display: 'grid', gap: '10px' }}>
                            <div className="marketing-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div className="form-group">
                                    <label htmlFor="marketing-formData-limite_usos_total" className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                        Límite Usos Totales
                                    </label>
                                    <input
                                        id="marketing-formData-limite_usos_total"
                                        type="number"
                                        min="1"
                                        step="1"
                                        className="form-input"
                                        placeholder="1"
                                        value={formData.limite_usos_total}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, limite_usos_total: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="marketing-formData-limite_usos_por_doctor" className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                        Usos por cliente
                                    </label>
                                    <input
                                        id="marketing-formData-limite_usos_por_doctor"
                                        type="number"
                                        min="1"
                                        step="1"
                                        className="form-input"
                                        placeholder="1"
                                        value={formData.limite_usos_por_doctor}
                                        onChange={(event) => setFormData((previous) => ({ ...previous, limite_usos_por_doctor: event.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="marketing-form-grid" style={{ display: 'grid', gridTemplateColumns: formData.tipo === 'porcentaje' ? '1fr 1fr' : '1fr', gap: '0.75rem' }}>
                                <div className="form-group">
                                    <label htmlFor="marketing-formData-monto_minimo_pedido" className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                        Pedido Mínimo (S/., opcional)
                                    </label>
                                    <input
                                        id="marketing-formData-monto_minimo_pedido"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="form-input"
                                        placeholder="0.00"
                                        value={formData.monto_minimo_pedido}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, monto_minimo_pedido: e.target.value }))}
                                    />
                                </div>
                                {formData.tipo === 'porcentaje' && (
                                    <div className="form-group">
                                        <label htmlFor="marketing-formData-tope_descuento_maximo" className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                            Tope Máximo DCTO (S/., opcional)
                                        </label>
                                        <input
                                            id="marketing-formData-tope_descuento_maximo"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className="form-input"
                                            placeholder="Sin tope"
                                            value={formData.tope_descuento_maximo}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, tope_descuento_maximo: e.target.value }))}
                                        />
                                    </div>
                                )}
                            </div>

                            {!invitationCouponContext && (
                                <div className="form-group">
                                    <label htmlFor="marketing-formData-clinica_id" className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
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
                            )}

                            <div className="form-group">
                                <label htmlFor="marketing-formData-evento_nombre" className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                    Campaña / Evento de referencia
                                </label>
                                <input
                                    id="marketing-formData-evento_nombre"
                                    type="text"
                                    className="form-input"
                                    placeholder="Ej. Campaña Pop-up Noviembre"
                                    value={formData.evento_nombre}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, evento_nombre: e.target.value }))}
                                />
                            </div>
                        </div>
                    </details>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={closeCouponModal}
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
                    </fieldset>
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

            {/* Modal de confirmación de eliminación segura */}
            <Modal
                open={deleteModal.open}
                onClose={() => !deleteModal.loading && setDeleteModal((prev) => ({ ...prev, open: false }))}
                title={deleteModal.type === 'coupon' ? 'Eliminar Cupón' : 'Eliminar Campaña'}
                subtitle="Confirmación de seguridad"
                icon="bi-exclamation-triangle-fill"
                size="sm"
            >
                <div style={{ padding: '0.25rem 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1rem' }}>
                        <div style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '50%',
                            background: 'var(--color-danger-bg, rgba(239, 68, 68, 0.12))',
                            color: 'var(--color-danger, #ef4444)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.35rem',
                            flexShrink: 0,
                            boxShadow: '0 0 16px rgba(239, 68, 68, 0.2)'
                        }}>
                            <i className="bi bi-trash3-fill" aria-hidden="true" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                ¿Eliminar definitivamente este registro?
                            </div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                Esta acción es irreversible y no se podrá recuperar.
                            </div>
                        </div>
                    </div>

                    {deleteModal.title && (
                        <div style={{
                            background: 'var(--color-bg-alt)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '10px',
                            padding: '0.85rem 1rem',
                            marginBottom: '1.25rem'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                <span style={{ fontWeight: 800, fontSize: '1.02rem', letterSpacing: '0.04em', color: 'var(--color-text)' }}>
                                    {deleteModal.title}
                                </span>
                                {deleteModal.details?.badge && (
                                    <span className="badge" style={{
                                        background: 'rgba(2, 132, 199, 0.12)',
                                        color: '#0284c7',
                                        fontWeight: 700,
                                        fontSize: '0.74rem',
                                        padding: '0.2rem 0.55rem',
                                        borderRadius: '8px'
                                    }}>
                                        {deleteModal.details.badge}
                                    </span>
                                )}
                            </div>
                            {deleteModal.details?.subtitle && (
                                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
                                    {deleteModal.details.subtitle}
                                </div>
                            )}
                            {deleteModal.details?.usos && (
                                <div style={{ fontSize: '0.74rem', color: 'var(--color-text-tertiary)' }}>
                                    {deleteModal.details.usos}
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setDeleteModal((prev) => ({ ...prev, open: false }))}
                            disabled={deleteModal.loading}
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="btn btn-danger"
                            onClick={handleConfirmDelete}
                            disabled={deleteModal.loading}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
                        >
                            {deleteModal.loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                                    Eliminando...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-trash3" aria-hidden="true" />
                                    Eliminar
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Modal>

            <MarketingCampaignComposer
                open={showCampanaModal}
                onClose={() => setShowCampanaModal(false)}
                clinicas={clinicas}
                cupones={cupones}
                onCreateCoupon={openInvitationCoupon}
                onCreated={() => loadData('campanas')}
            />
        </div>
    );
}
