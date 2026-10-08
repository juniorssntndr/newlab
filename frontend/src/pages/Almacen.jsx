import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { API_URL } from '../config.js';
import ProveedorModal from '../modules/almacen/components/ProveedorModal.jsx';
import ProveedorMaterialesModal from '../modules/almacen/components/ProveedorMaterialesModal.jsx';
import MaterialMovimientoModal from '../modules/almacen/components/MaterialMovimientoModal.jsx';
import MaterialKardexModal from '../modules/almacen/components/MaterialKardexModal.jsx';
import CustomSelect from '../components/CustomSelect.jsx';
import toast from 'react-hot-toast';

const materialTemplates = {
    digital: [
        { nombre: 'Digital - Disco Zirconia Multicapa', categoria: 'disco', color: 'A2', unidad: 'disco', stock_minimo: 5, tipo_control: 'multiuso' },
        { nombre: 'Digital - Bloque PMMA CAD/CAM', categoria: 'bloque', color: 'A2', unidad: 'bloque', stock_minimo: 8, tipo_control: 'unitario' },
        { nombre: 'Digital - Resina Modelos 3D', categoria: 'resina', color: 'beige', unidad: 'litro', stock_minimo: 4, tipo_control: 'multiuso' },
        { nombre: 'Digital - Resina Guía Quirúrgica', categoria: 'resina', color: 'transparente', unidad: 'litro', stock_minimo: 3, tipo_control: 'multiuso' },
        { nombre: 'Digital - Fresa Carburo', categoria: 'fresa', color: '', unidad: 'unidad', stock_minimo: 20, tipo_control: 'unitario' },
        { nombre: 'Digital - Film FEP Impresora', categoria: 'consumible', color: 'transparente', unidad: 'unidad', stock_minimo: 3, tipo_control: 'unitario' }
    ],
    analogico: [
        { nombre: 'Analogico - Aleación Cr-Co', unidad: 'kg', stock_minimo: 8, tipo_control: 'unitario' },
        { nombre: 'Analogico - Yeso Tipo IV', unidad: 'kg', stock_minimo: 20, tipo_control: 'unitario' },
        { nombre: 'Analogico - Revestimiento Fosfático', unidad: 'kg', stock_minimo: 10, tipo_control: 'unitario' },
        { nombre: 'Analogico - Acrílico Termocurable', unidad: 'kg', stock_minimo: 6, tipo_control: 'unitario' },
        { nombre: 'Analogico - Cerámica Feldespática', unidad: 'kit', stock_minimo: 4, tipo_control: 'unitario' },
        { nombre: 'Analogico - Arenado Óxido Aluminio 50um', unidad: 'kg', stock_minimo: 12, tipo_control: 'unitario' }
    ]
};

const units = [
    { value: 'unidad', label: 'Unidad (unidad)' },
    { value: 'disco', label: 'Disco' },
    { value: 'bloque', label: 'Bloque' },
    { value: 'litro', label: 'Litro' },
    { value: 'kg', label: 'Kilogramo (kg)' },
    { value: 'frasco', label: 'Frasco' },
    { value: 'kit', label: 'Kit' },
    { value: 'barra', label: 'Barra' },
    { value: 'caja', label: 'Caja' }
];

const PRESET_RUBROS_FILTER = [
    'Discos',
    'Resinas 3D',
    'Fresas',
    'Fresadoras',
    'Impresoras 3D',
    'Merch',
    'Consumibles',
    'Servicios'
];

const Almacen = () => {
    const { getHeaders } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Tabs
    const activeTab = searchParams.get('tab') || 'inventario';
    const handleTabChange = (newTab) => {
        setSearchParams({ tab: newTab });
    };

    // --- ESTADOS: INVENTARIO / MATERIALES ---
    const [materiales, setMateriales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [restoringId, setRestoringId] = useState(null);
    const [confirmDeleteMaterial, setConfirmDeleteMaterial] = useState(null);
    const [form, setForm] = useState({
        nombre: '',
        flujo: 'digital',
        categoria: 'resina',
        color: '',
        unidad: 'unidad',
        stock_actual: 0,
        stock_en_uso: 0,
        tipo_control: 'multiuso',
        stock_minimo: 5,
        alerta_bajo_stock: true,
        notas: ''
    });
    const [search, setSearch] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('');
    const [materialView, setMaterialView] = useState('activos');

    // --- ESTADOS: MOVIMIENTOS Y KÁRDEX ---
    const [movimientoModalOpen, setMovimientoModalOpen] = useState(false);
    const [selectedMaterialMovimiento, setSelectedMaterialMovimiento] = useState(null);
    const [initialTipoMovimiento, setInitialTipoMovimiento] = useState('ingreso');

    const [kardexModalOpen, setKardexModalOpen] = useState(false);
    const [selectedMaterialKardex, setSelectedMaterialKardex] = useState(null);

    // --- ESTADOS: PROVEEDORES ---
    const [proveedores, setProveedores] = useState([]);
    const [loadingProveedores, setLoadingProveedores] = useState(false);
    const [searchProveedor, setSearchProveedor] = useState('');
    const [filtroRubro, setFiltroRubro] = useState('');
    const [rubroDropdownOpen, setRubroDropdownOpen] = useState(false);
    const rubroDropdownRef = useRef(null);
    const [proveedorView, setProveedorView] = useState('activos');
    const [proveedorModalOpen, setProveedorModalOpen] = useState(false);
    const [editingProveedor, setEditingProveedor] = useState(null);
    const [materialesModalOpen, setMaterialesModalOpen] = useState(false);
    const [selectedProveedorId, setSelectedProveedorId] = useState(null);
    const [confirmDeleteProveedor, setConfirmDeleteProveedor] = useState(null);
    const [deletingProveedorId, setDeletingProveedorId] = useState(null);
    const [restoringProveedorId, setRestoringProveedorId] = useState(null);

    // Close rubro dropdown on click outside or escape
    useEffect(() => {
        if (!rubroDropdownOpen) return;
        const handleClickOutside = (e) => {
            if (rubroDropdownRef.current && !rubroDropdownRef.current.contains(e.target)) {
                setRubroDropdownOpen(false);
            }
        };
        const handleEscape = (e) => {
            if (e.key === 'Escape') setRubroDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [rubroDropdownOpen]);

    // --- ESTADOS: HISTORIAL DE MOVIMIENTOS ---
    const [historialMovimientos, setHistorialMovimientos] = useState([]);
    const [loadingMovimientos, setLoadingMovimientos] = useState(false);
    const [filtroTipoMov, setFiltroTipoMov] = useState('todos'); // 'todos' | 'ingresos' | 'egresos'
    const [searchMovimiento, setSearchMovimiento] = useState('');

    // Fetch Materiales
    const fetchMateriales = useCallback(() => {
        setLoading(true);
        fetch(`${API_URL}/inventory?estado=todos`, { headers: getHeaders() })
            .then(r => r.json())
            .then(data => {
                setMateriales(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [getHeaders]);

    // Fetch Proveedores
    const fetchProveedores = useCallback(() => {
        setLoadingProveedores(true);
        fetch(`${API_URL}/proveedores?estado=todos`, { headers: getHeaders() })
            .then(r => r.json())
            .then(data => {
                setProveedores(Array.isArray(data) ? data : []);
                setLoadingProveedores(false);
            })
            .catch(err => {
                console.error(err);
                setLoadingProveedores(false);
            });
    }, [getHeaders]);

    // Fetch Historial de Movimientos
    const fetchMovimientos = useCallback(() => {
        setLoadingMovimientos(true);
        const params = new URLSearchParams();
        if (filtroTipoMov && filtroTipoMov !== 'todos') params.append('tipo', filtroTipoMov);
        if (searchMovimiento.trim()) params.append('search', searchMovimiento.trim());

        fetch(`${API_URL}/inventory/movimientos?${params.toString()}`, { headers: getHeaders() })
            .then(r => r.json())
            .then(data => {
                setHistorialMovimientos(Array.isArray(data) ? data : []);
                setLoadingMovimientos(false);
            })
            .catch(err => {
                console.error(err);
                setLoadingMovimientos(false);
            });
    }, [getHeaders, filtroTipoMov, searchMovimiento]);

    useEffect(() => {
        fetchMateriales();
        fetchProveedores();
        fetchMovimientos();
    }, [fetchMateriales, fetchProveedores, fetchMovimientos]);

    // Manejo de apertura nuevo material
    const openNew = () => {
        setEditing(null);
        setForm({
            nombre: '',
            flujo: 'digital',
            categoria: 'resina',
            color: '',
            unidad: 'unidad',
            stock_actual: 0,
            stock_en_uso: 0,
            tipo_control: 'multiuso',
            stock_minimo: 5,
            alerta_bajo_stock: true,
            activo: true,
            notas: ''
        });
        setModalOpen(true);
    };

    const openEdit = (m) => {
        setEditing(m);
        setForm({
            nombre: m.nombre,
            flujo: m.flujo || ((m.nombre || '').toLowerCase().startsWith('analogico') ? 'analogico' : 'digital'),
            categoria: m.categoria || 'consumible',
            color: m.color || '',
            stock_actual: m.stock_actual,
            stock_en_uso: m.stock_en_uso || 0,
            tipo_control: m.tipo_control || (['disco', 'resina', 'liquido'].includes((m.categoria || '').toLowerCase()) ? 'multiuso' : 'unitario'),
            stock_minimo: m.stock_minimo,
            unidad: m.unidad,
            alerta_bajo_stock: m.alerta_bajo_stock !== false,
            activo: m.activo !== false,
            notas: m.notas || ''
        });
        setModalOpen(true);
    };

    // Helpers para movimientos y kardex
    const openMovimiento = (material, tipo = 'ingreso') => {
        setSelectedMaterialMovimiento(material);
        setInitialTipoMovimiento(tipo);
        setMovimientoModalOpen(true);
    };

    const openKardex = (material) => {
        setSelectedMaterialKardex(material);
        setKardexModalOpen(true);
    };

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('newMaterial') !== '1') return;
        const flow = params.get('flow') === 'analogico' ? 'analogico' : 'digital';
        setEditing(null);
        setForm({
            nombre: '',
            flujo: flow,
            categoria: 'resina',
            color: '',
            unidad: 'unidad',
            stock_actual: 0,
            stock_en_uso: 0,
            tipo_control: 'multiuso',
            stock_minimo: 5,
            alerta_bajo_stock: true,
            activo: true,
            notas: ''
        });
        setModalOpen(true);
    }, [location.search]);

    const applyTemplate = (tpl) => {
        setForm((prev) => ({
            ...prev,
            nombre: tpl.nombre,
            categoria: tpl.categoria,
            color: tpl.color,
            unidad: tpl.unidad,
            stock_minimo: tpl.stock_minimo,
            tipo_control: tpl.tipo_control || prev.tipo_control
        }));
    };

    const save = async () => {
        const method = editing ? 'PUT' : 'POST';
        const url = editing ? `${API_URL}/inventory/${editing.id}` : `${API_URL}/inventory`;

        try {
            if (!form.nombre.trim()) {
                toast.error('Ingresa un nombre de material');
                return;
            }
            const res = await fetch(url, {
                method,
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: form.nombre.trim(),
                    flujo: form.flujo,
                    categoria: form.categoria,
                    color: form.color || null,
                    stock_actual: Number(form.stock_actual) || 0,
                    stock_en_uso: Number(form.stock_en_uso) || 0,
                    tipo_control: form.tipo_control || 'unitario',
                    stock_minimo: Number(form.stock_minimo) || 0,
                    unidad: form.unidad,
                    alerta_bajo_stock: !!form.alerta_bajo_stock,
                    activo: form.activo !== false,
                    notas: form.notas || null
                })
            });
            if (res.ok) {
                const saved = await res.json();
                toast.success(editing ? 'Material actualizado' : 'Material registrado');
                setModalOpen(false);
                fetchMateriales();

                const params = new URLSearchParams(location.search);
                const returnTo = params.get('returnTo');
                if (!editing && returnTo === '/productos') {
                    navigate(`/productos?materialCreated=${saved.id}`);
                }
            } else {
                toast.error('Error al guardar material');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error de red al guardar material');
        }
    };

    const confirmRemoveMaterial = async () => {
        const material = confirmDeleteMaterial;
        if (!material) return;
        setDeletingId(material.id);

        try {
            const res = await fetch(`${API_URL}/inventory/${material.id}?hard=true`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || 'No se pudo eliminar el material');
            }

            toast.success(data.deleted ? 'Material eliminado definitivamente' : 'Material desactivado');

            if (editing?.id === material.id) {
                setModalOpen(false);
                setEditing(null);
            }

            setConfirmDeleteMaterial(null);
            fetchMateriales();
        } catch (error) {
            toast.error(error.message || 'Error al eliminar material');
        } finally {
            setDeletingId(null);
        }
    };

    const restoreMaterial = async (material) => {
        setRestoringId(material.id);

        try {
            const res = await fetch(`${API_URL}/inventory/${material.id}/restore`, {
                method: 'PATCH',
                headers: getHeaders()
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'No se pudo restaurar el material');
            }

            fetchMateriales();
        } catch (error) {
            alert(error.message || 'Error al restaurar material');
        } finally {
            setRestoringId(null);
        }
    };

    // --- ACCIONES DE PROVEEDOR ---
    const handleToggleProveedorEstado = async (prov, nuevoEstado) => {
        if (!nuevoEstado) {
            setConfirmDeleteProveedor(prov);
            return;
        }

        // Reactivar
        setRestoringProveedorId(prov.id);
        try {
            const res = await fetch(`${API_URL}/proveedores/${prov.id}/reactivar`, {
                method: 'PATCH',
                headers: getHeaders()
            });
            if (!res.ok) throw new Error('Error al reactivar proveedor');
            toast.success('Proveedor reactivado');
            fetchProveedores();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setRestoringProveedorId(null);
        }
    };

    const confirmRemoveProveedor = async () => {
        const prov = confirmDeleteProveedor;
        if (!prov) return;
        setDeletingProveedorId(prov.id);

        try {
            const res = await fetch(`${API_URL}/proveedores/${prov.id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });
            if (!res.ok) throw new Error('Error al dar de baja al proveedor');
            toast.success('Proveedor dado de baja');
            setConfirmDeleteProveedor(null);
            fetchProveedores();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setDeletingProveedorId(null);
        }
    };

    // Filtros de Materiales
    const activeMaterials = materiales.filter((m) => m.activo !== false);
    const inactiveMaterials = materiales.filter((m) => m.activo === false);

    const filteredMateriales = materiales.filter(m => {
        const matchesView = materialView === 'todos'
            ? true
            : materialView === 'inactivos'
                ? m.activo === false
                : m.activo !== false;
        const nombre = (m.nombre || '').toLowerCase();
        const matchesSearch = !search || nombre.includes(search.toLowerCase());
        const lowStock = m.alerta_bajo_stock !== false && parseFloat(m.stock_actual) < parseFloat(m.stock_minimo);
        const matchesEstado = !filtroEstado || (filtroEstado === 'low' ? lowStock : !lowStock);
        return matchesView && matchesSearch && matchesEstado;
    });

    const totalMateriales = activeMaterials.length;
    const totalInactive = inactiveMaterials.length;
    const totalLowStock = activeMaterials.filter(m => m.alerta_bajo_stock !== false && parseFloat(m.stock_actual) < parseFloat(m.stock_minimo)).length;
    const totalStock = activeMaterials.reduce((acc, m) => acc + (parseFloat(m.stock_actual) || 0), 0);

    // Filtros de Proveedores
    const activeProveedores = proveedores.filter(p => p.activo !== false);
    const inactiveProveedores = proveedores.filter(p => p.activo === false);

    const filteredProveedores = proveedores.filter(p => {
        const matchesView = proveedorView === 'todos'
            ? true
            : proveedorView === 'inactivos'
                ? p.activo === false
                : p.activo !== false;
        const s = searchProveedor.toLowerCase().trim();
        const rubrosStr = Array.isArray(p.rubros) ? p.rubros.join(' ').toLowerCase() : '';
        const matchesSearch = !s || (
            (p.razon_social && p.razon_social.toLowerCase().includes(s)) ||
            (p.nombre_comercial && p.nombre_comercial.toLowerCase().includes(s)) ||
            (p.numero_documento && p.numero_documento.toLowerCase().includes(s)) ||
            (p.contacto_nombre && p.contacto_nombre.toLowerCase().includes(s)) ||
            rubrosStr.includes(s)
        );
        const matchesRubro = !filtroRubro || (
            Array.isArray(p.rubros) && p.rubros.some(r => r.toLowerCase().includes(filtroRubro.toLowerCase()))
        );
        return matchesView && matchesSearch && matchesRubro;
    });

    const totalProveedoresActivos = activeProveedores.length;
    const totalProvMateriales = activeProveedores.filter(p => p.tipo_proveedor === 'materiales').length;
    const totalProvServicios = activeProveedores.filter(p => p.tipo_proveedor === 'servicios' || p.tipo_proveedor === 'mixto').length;
    const totalItemsConPrecio = activeProveedores.reduce((acc, p) => acc + (parseInt(p.total_materiales, 10) || 0), 0);

    return (
        <div className="animate-fade-in page-container">
            {/* Header */}
            <div className="page-header">
                <div className="page-header-left">
                    <h1>
                        <i className="bi bi-box-seam-fill text-primary" aria-hidden="true"></i> Compras y Almacén
                    </h1>
                    <p>Gestión de materiales de laboratorio, existencias y catálogo de proveedores</p>
                </div>
                {activeTab === 'inventario' ? (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => openMovimiento(null, 'ingreso')}
                            title="Registrar compra o ingreso de material a almacén"
                        >
                            <i className="bi bi-box-arrow-in-down text-success"></i> + Ingreso / Compra
                        </button>
                        <button className="btn btn-primary" onClick={openNew}>
                            <i className="bi bi-plus-lg"></i> Nuevo Material
                        </button>
                    </div>
                ) : activeTab === 'movimientos' ? (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                            className="btn btn-primary"
                            onClick={() => openMovimiento(null, 'ingreso')}
                            title="Registrar compra o ingreso a almacén"
                        >
                            <i className="bi bi-box-arrow-in-down"></i> + Ingreso / Compra
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => openMovimiento(null, 'apertura_taller')}
                            title="Registrar movimiento o pase a laboratorio"
                        >
                            <i className="bi bi-arrow-left-right text-primary"></i> Movimiento Laboratorio
                        </button>
                    </div>
                ) : (
                    <button
                        className="btn btn-primary"
                        onClick={() => {
                            setEditingProveedor(null);
                            setProveedorModalOpen(true);
                        }}
                    >
                        <i className="bi bi-plus-lg"></i> Nuevo Proveedor
                    </button>
                )}
            </div>

            {/* Selector de Pestañas / Tabs */}
            <div className="section-tabs dashboard-view-switcher almacen-section-tabs" role="group" aria-label="Secciones de almacén">
                <button
                    type="button"
                    className={`btn section-tab dashboard-view-tab ${activeTab === 'inventario' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => handleTabChange('inventario')}
                    aria-pressed={activeTab === 'inventario'}
                >
                    <i className="bi bi-boxes" aria-hidden="true"></i>
                    <span className="almacen-tab-text-full">Inventario de Materiales</span>
                    <span className="almacen-tab-text-short">Materiales</span>
                    <span
                        style={{
                            background: activeTab === 'inventario' ? 'rgba(255,255,255,0.25)' : 'var(--color-bg-alt, #e2e8f0)',
                            color: activeTab === 'inventario' ? '#ffffff' : 'var(--color-text-secondary, #475569)',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            marginLeft: '6px'
                        }}
                    >
                        {totalMateriales}
                    </span>
                </button>
                <button
                    type="button"
                    className={`btn section-tab dashboard-view-tab ${activeTab === 'movimientos' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => handleTabChange('movimientos')}
                    aria-pressed={activeTab === 'movimientos'}
                >
                    <i className="bi bi-clock-history" aria-hidden="true"></i>
                    <span className="almacen-tab-text-full">Historial de Movimientos</span>
                    <span className="almacen-tab-text-short">Movimientos</span>
                    <span
                        style={{
                            background: activeTab === 'movimientos' ? 'rgba(255,255,255,0.25)' : 'var(--color-bg-alt, #e2e8f0)',
                            color: activeTab === 'movimientos' ? '#ffffff' : 'var(--color-text-secondary, #475569)',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            marginLeft: '6px'
                        }}
                    >
                        {historialMovimientos.length}
                    </span>
                </button>
                <button
                    type="button"
                    className={`btn section-tab dashboard-view-tab ${activeTab === 'proveedores' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => handleTabChange('proveedores')}
                    aria-pressed={activeTab === 'proveedores'}
                >
                    <i className="bi bi-truck" aria-hidden="true"></i>
                    <span className="almacen-tab-text-full">Proveedores e Insumos</span>
                    <span className="almacen-tab-text-short">Proveedores</span>
                    <span
                        style={{
                            background: activeTab === 'proveedores' ? 'rgba(255,255,255,0.25)' : 'var(--color-bg-alt, #e2e8f0)',
                            color: activeTab === 'proveedores' ? '#ffffff' : 'var(--color-text-secondary, #475569)',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            marginLeft: '6px'
                        }}
                    >
                        {totalProveedoresActivos}
                    </span>
                </button>
            </div>

            {/* TAB 1: INVENTARIO */}
            {activeTab === 'inventario' && (
                <>
                    <div className="grid grid-cols-4 almacen-kpi-grid">
                        <div className="card kpi-card almacen-kpi-card">
                            <div className="almacen-kpi-row">
                                <div className="kpi-icon" style={{ background: 'rgba(8,145,178,0.1)', color: 'var(--color-primary)' }}>
                                    <i className="bi bi-box-seam" aria-hidden="true"></i>
                                </div>
                                <div className="almacen-kpi-copy">
                                    <div className="kpi-label">Materiales</div>
                                    <div className="kpi-value">{totalMateriales}</div>
                                </div>
                            </div>
                        </div>
                        <div className="card kpi-card almacen-kpi-card">
                            <div className="almacen-kpi-row">
                                <div className="kpi-icon" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--color-warning)' }}>
                                    <i className="bi bi-exclamation-triangle" aria-hidden="true"></i>
                                </div>
                                <div className="almacen-kpi-copy">
                                    <div className="kpi-label">Bajo stock</div>
                                    <div className="kpi-value">{totalLowStock}</div>
                                </div>
                            </div>
                        </div>
                        <div className="card kpi-card almacen-kpi-card">
                            <div className="almacen-kpi-row">
                                <div className="kpi-icon" style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--color-success, #10b981)' }}>
                                    <i className="bi bi-archive" aria-hidden="true"></i>
                                </div>
                                <div className="almacen-kpi-copy">
                                    <div className="kpi-label">Stock en Almacén</div>
                                    <div className="kpi-value">{totalStock.toFixed(1)}</div>
                                </div>
                            </div>
                        </div>
                        <div className="card kpi-card almacen-kpi-card">
                            <div className="almacen-kpi-row">
                                <div className="kpi-icon" style={{ background: 'rgba(2,132,199,0.12)', color: '#0284c7' }}>
                                    <i className="bi bi-gear-wide-connected" aria-hidden="true"></i>
                                </div>
                                <div className="almacen-kpi-copy">
                                    <div className="kpi-label">En Laboratorio</div>
                                    <div className="kpi-value">
                                        {activeMaterials.reduce((acc, m) => acc + (parseFloat(m.stock_en_uso) || 0), 0).toFixed(1)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="inventory-toolbar">
                            <div className="inventory-toolbar-main">
                                <div className="search-box inventory-search-box">
                                    <i className="bi bi-search"></i>
                                    <input
                                        className="form-input"
                                        placeholder="Buscar material..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                    />
                                </div>
                                <div className="inventory-filters" role="group" aria-label="Nivel de stock">
                                    <button
                                        type="button"
                                        className={`btn btn-sm pedidos-filter-chip${!filtroEstado ? ' is-active' : ''}`}
                                        onClick={() => setFiltroEstado('')}
                                    >
                                        Cualquier stock
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn btn-sm pedidos-filter-chip${filtroEstado === 'low' ? ' is-active' : ''}`}
                                        onClick={() => setFiltroEstado(filtroEstado === 'low' ? '' : 'low')}
                                    >
                                        Bajo stock
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn btn-sm pedidos-filter-chip${filtroEstado === 'ok' ? ' is-active' : ''}`}
                                        onClick={() => setFiltroEstado(filtroEstado === 'ok' ? '' : 'ok')}
                                    >
                                        Normal
                                    </button>
                                </div>
                            </div>
                            <div className="segmented-control inventory-status-switch" role="group" aria-label="Estado del material">
                                <button
                                    type="button"
                                    className={`segmented-control__btn${materialView === 'activos' ? ' is-active' : ''}`}
                                    aria-pressed={materialView === 'activos'}
                                    onClick={() => setMaterialView('activos')}
                                >
                                    Activos
                                </button>
                                <button
                                    type="button"
                                    className={`segmented-control__btn${materialView === 'inactivos' ? ' is-active' : ''}`}
                                    aria-pressed={materialView === 'inactivos'}
                                    onClick={() => setMaterialView('inactivos')}
                                >
                                    Inactivos
                                </button>
                                <button
                                    type="button"
                                    className={`segmented-control__btn${materialView === 'todos' ? ' is-active' : ''}`}
                                    aria-pressed={materialView === 'todos'}
                                    onClick={() => setMaterialView('todos')}
                                >
                                    Todos
                                </button>
                            </div>
                        </div>

                        <div className="data-table-wrapper desktop-only" style={{ border: 'none' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Material</th>
                                        <th>Color</th>
                                        <th style={{ textAlign: 'right' }}>En Almacén</th>
                                        <th style={{ textAlign: 'right' }}>En Laboratorio</th>
                                        <th style={{ textAlign: 'center' }}>Stock Mínimo</th>
                                        <th style={{ textAlign: 'center' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="6" className="text-center">Cargando...</td></tr>
                                    ) : filteredMateriales.length === 0 ? (
                                        <tr><td colSpan="6" className="text-center">No hay materiales registrados</td></tr>
                                    ) : (
                                        filteredMateriales.map(m => {
                                            const lowStock = m.alerta_bajo_stock !== false && parseFloat(m.stock_actual) < parseFloat(m.stock_minimo);
                                            const maxValue = parseFloat(m.stock_minimo) || 0;
                                            const percent = maxValue > 0 ? Math.min((parseFloat(m.stock_actual) / maxValue) * 100, 100) : 100;
                                            const stockEnUso = parseFloat(m.stock_en_uso) || 0;

                                            return (
                                                <tr key={m.id} className={`${lowStock ? 'inventory-row-low' : ''} ${m.activo === false ? 'inventory-row-inactive' : ''}`.trim()}>
                                                    <td>
                                                        <div className="inventory-name" style={{ fontWeight: 600 }}>{m.nombre}</div>
                                                        <div style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                                            {m.unidad}{m.categoria ? ` • ${m.categoria}` : ''}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {m.color ? (
                                                            <span className="badge" style={{ background: 'var(--color-bg-alt, #f1f5f9)', color: 'var(--color-text)', fontWeight: 600 }}>
                                                                {m.color}
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
                                                        )}
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <div className="inventory-stock-value" style={{ fontWeight: 700, fontSize: '0.95rem', color: lowStock ? 'var(--color-error)' : 'inherit' }}>
                                                            {m.stock_actual} <span style={{ fontSize: '0.74rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{m.unidad}</span>
                                                        </div>
                                                        <div className="stock-bar" style={{ marginLeft: 'auto', maxWidth: '80px' }}>
                                                            <span className={`stock-bar-fill ${lowStock ? 'is-low' : ''}`} style={{ width: `${percent}%` }}></span>
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        {stockEnUso > 0 ? (
                                                            <span style={{ fontWeight: 700, color: '#0284c7', fontSize: '0.95rem' }}>
                                                                {stockEnUso} <span style={{ fontSize: '0.74rem', fontWeight: 500 }}>{m.unidad}</span>
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>0</span>
                                                        )}
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                                            <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>{m.stock_minimo}</span>
                                                            {m.activo === false ? (
                                                                <span className="badge badge-inactive" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>Inactivo</span>
                                                            ) : lowStock ? (
                                                                <span className="badge badge-error" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                                                                    <i className="bi bi-exclamation-triangle"></i> Bajo stock
                                                                </span>
                                                            ) : (
                                                                <span className="badge badge-success" style={{ fontSize: '0.68rem', padding: '1px 6px', background: 'rgba(16,185,129,0.1)', color: '#059669' }}>
                                                                    OK
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="table-actions" style={{ justifyContent: 'center', gap: '0.35rem' }}>
                                                            <button
                                                                className="btn btn-sm btn-secondary"
                                                                onClick={() => openMovimiento(m)}
                                                                title="Registrar movimiento (Ingreso, pasar a taller o consumo)"
                                                                style={{ fontSize: '0.74rem', padding: '0.28rem 0.6rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                            >
                                                                <i className="bi bi-arrow-left-right text-primary"></i> Movimiento
                                                            </button>

                                                            <button
                                                                className="btn btn-ghost btn-sm btn-icon"
                                                                onClick={() => openKardex(m)}
                                                                title="Ver Kárdex / Historial"
                                                                aria-label={`Ver Kárdex de ${m.nombre}`}
                                                            >
                                                                <i className="bi bi-journal-text"></i>
                                                            </button>

                                                            <button
                                                                className="btn btn-ghost btn-sm btn-icon"
                                                                onClick={() => openEdit(m)}
                                                                title="Editar material"
                                                                aria-label={`Editar ${m.nombre}`}
                                                            >
                                                                <i className="bi bi-pencil"></i>
                                                            </button>
                                                            {m.activo === false ? (
                                                                <button
                                                                    className="btn btn-ghost btn-sm btn-icon"
                                                                    onClick={() => restoreMaterial(m)}
                                                                    title="Restaurar material"
                                                                    aria-label={`Restaurar ${m.nombre}`}
                                                                    disabled={restoringId === m.id}
                                                                >
                                                                    <i className="bi bi-arrow-counterclockwise"></i>
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    className="btn btn-ghost btn-sm btn-icon"
                                                                    onClick={() => setConfirmDeleteMaterial(m)}
                                                                    title="Eliminar material"
                                                                    aria-label={`Eliminar ${m.nombre}`}
                                                                    disabled={deletingId === m.id}
                                                                >
                                                                    <i className="bi bi-trash"></i>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="mobile-cards mobile-only almacen-mobile-cards" style={{ marginTop: 'var(--space-4)' }}>
                            {loading ? (
                                [1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12 }} />)
                            ) : filteredMateriales.length === 0 ? (
                                <div className="mobile-card">
                                    <div className="mobile-field-value">No hay materiales registrados</div>
                                </div>
                            ) : (
                                filteredMateriales.map(m => {
                                    const lowStock = m.alerta_bajo_stock !== false && parseFloat(m.stock_actual) < parseFloat(m.stock_minimo);
                                    const stockEnUso = parseFloat(m.stock_en_uso) || 0;

                                    return (
                                        <div key={m.id} className="mobile-card">
                                            <div className="mobile-card-head">
                                                <div>
                                                    <div className="mobile-card-title">{m.nombre}</div>
                                                    <div style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                                        {m.unidad}{m.categoria ? ` • ${m.categoria}` : ''}
                                                    </div>
                                                </div>
                                                {m.activo === false ? (
                                                    <span className="badge badge-inactive">Inactivo</span>
                                                ) : lowStock ? (
                                                    <span className="badge badge-error">Bajo stock</span>
                                                ) : (
                                                    <span className="badge badge-success" style={{ background: 'rgba(16,185,129,0.1)', color: '#059669' }}>OK</span>
                                                )}
                                            </div>
                                            <div className="mobile-card-grid">
                                                <div className="mobile-field">
                                                    <span className="mobile-field-label">En Almacén</span>
                                                    <span className="mobile-field-value" style={{ fontWeight: 700, color: lowStock ? 'var(--color-error)' : 'inherit' }}>
                                                        {m.stock_actual} {m.unidad}
                                                    </span>
                                                </div>
                                                <div className="mobile-field">
                                                    <span className="mobile-field-label">En Laboratorio</span>
                                                    <span className="mobile-field-value" style={{ fontWeight: 700, color: stockEnUso > 0 ? '#0284c7' : 'var(--color-text-secondary)' }}>
                                                        {stockEnUso} {m.unidad}
                                                    </span>
                                                </div>
                                                <div className="mobile-field">
                                                    <span className="mobile-field-label">Mínimo</span>
                                                    <span className="mobile-field-value">{m.stock_minimo}</span>
                                                </div>
                                                <div className="mobile-field">
                                                    <span className="mobile-field-label">Color</span>
                                                    <span className="mobile-field-value">{m.color || '—'}</span>
                                                </div>
                                            </div>
                                            <div className="mobile-card-actions" style={{ flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'space-between' }}>
                                                <div style={{ display: 'flex', gap: '0.35rem' }}>
                                                    <button
                                                        className="btn btn-sm btn-secondary"
                                                        onClick={() => openMovimiento(m)}
                                                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                    >
                                                        <i className="bi bi-arrow-left-right text-primary"></i> Movimiento
                                                    </button>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => openKardex(m)}
                                                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                                                    >
                                                        <i className="bi bi-journal-text"></i> Kárdex
                                                    </button>
                                                </div>

                                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(m)} aria-label="Editar">
                                                        <i className="bi bi-pencil"></i>
                                                    </button>
                                                    {m.activo === false ? (
                                                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => restoreMaterial(m)} disabled={restoringId === m.id} aria-label="Restaurar">
                                                            <i className="bi bi-arrow-counterclockwise"></i>
                                                        </button>
                                                    ) : (
                                                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setConfirmDeleteMaterial(m)} disabled={deletingId === m.id} aria-label="Eliminar">
                                                            <i className="bi bi-trash"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* TAB 2: HISTORIAL DE MOVIMIENTOS */}
            {activeTab === 'movimientos' && (
                <>
                    <div className="grid grid-cols-4 almacen-kpi-grid">
                        <div className="card kpi-card almacen-kpi-card">
                            <div className="almacen-kpi-row">
                                <div className="kpi-icon" style={{ background: 'rgba(8,145,178,0.1)', color: 'var(--color-primary)' }}>
                                    <i className="bi bi-clock-history" aria-hidden="true"></i>
                                </div>
                                <div className="almacen-kpi-copy">
                                    <div className="kpi-label">Total Movimientos</div>
                                    <div className="kpi-value">{historialMovimientos.length}</div>
                                </div>
                            </div>
                        </div>
                        <div className="card kpi-card almacen-kpi-card">
                            <div className="almacen-kpi-row">
                                <div className="kpi-icon" style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--color-success, #10b981)' }}>
                                    <i className="bi bi-box-arrow-in-down" aria-hidden="true"></i>
                                </div>
                                <div className="almacen-kpi-copy">
                                    <div className="kpi-label">Ingresos Registrados</div>
                                    <div className="kpi-value">
                                        {historialMovimientos.filter(m => m.tipo === 'ingreso').length}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="card kpi-card almacen-kpi-card">
                            <div className="almacen-kpi-row">
                                <div className="kpi-icon" style={{ background: 'rgba(2,132,199,0.12)', color: '#0284c7' }}>
                                    <i className="bi bi-gear-wide-connected" aria-hidden="true"></i>
                                </div>
                                <div className="almacen-kpi-copy">
                                    <div className="kpi-label">Pases a Laboratorio</div>
                                    <div className="kpi-value">
                                        {historialMovimientos.filter(m => m.tipo === 'apertura_taller').length}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="card kpi-card almacen-kpi-card">
                            <div className="almacen-kpi-row">
                                <div className="kpi-icon" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--color-warning)' }}>
                                    <i className="bi bi-check2-circle" aria-hidden="true"></i>
                                </div>
                                <div className="almacen-kpi-copy">
                                    <div className="kpi-label">Terminados / Consumos</div>
                                    <div className="kpi-value">
                                        {historialMovimientos.filter(m => ['agotado_taller', 'consumo_unitario', 'merma_taller'].includes(m.tipo)).length}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="inventory-toolbar">
                            <div className="inventory-toolbar-main">
                                <div className="search-box inventory-search-box">
                                    <i className="bi bi-search"></i>
                                    <input
                                        className="form-input"
                                        placeholder="Buscar por material, comprobante, proveedor..."
                                        value={searchMovimiento}
                                        onChange={e => setSearchMovimiento(e.target.value)}
                                    />
                                    {searchMovimiento && (
                                        <button className="search-clear-btn" onClick={() => setSearchMovimiento('')} aria-label="Limpiar búsqueda">
                                            <i className="bi bi-x-circle-fill"></i>
                                        </button>
                                    )}
                                </div>

                                <div className="inventory-filters" role="group" aria-label="Filtro de tipo de movimiento">
                                    <button
                                        type="button"
                                        className={`btn btn-sm pedidos-filter-chip${filtroTipoMov === 'todos' ? ' is-active' : ''}`}
                                        onClick={() => setFiltroTipoMov('todos')}
                                    >
                                        Todos
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn btn-sm pedidos-filter-chip${filtroTipoMov === 'ingresos' ? ' is-active' : ''}`}
                                        onClick={() => setFiltroTipoMov('ingresos')}
                                    >
                                        <i className="bi bi-box-arrow-in-down"></i> Ingresos (Compras)
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn btn-sm pedidos-filter-chip${filtroTipoMov === 'egresos' ? ' is-active' : ''}`}
                                        onClick={() => setFiltroTipoMov('egresos')}
                                    >
                                        <i className="bi bi-box-arrow-up-right"></i> Salidas (Laboratorio)
                                    </button>
                                </div>
                            </div>

                            <div className="inventory-toolbar-actions">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => openMovimiento(null, 'ingreso')}
                                    style={{ gap: '0.45rem' }}
                                >
                                    <i className="bi bi-arrow-left-right"></i>
                                    <span>Registrar Movimiento</span>
                                </button>
                            </div>
                        </div>

                        {/* DESKTOP TABLE */}
                        <div className="data-table-wrapper desktop-only" style={{ border: 'none' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '125px' }}>Fecha / Hora</th>
                                        <th>Material</th>
                                        <th style={{ width: '175px' }}>Operación</th>
                                        <th style={{ textAlign: 'right', width: '100px' }}>Cantidad</th>
                                        <th style={{ width: '200px' }}>Trazabilidad de Stock</th>
                                        <th style={{ width: '150px' }}>Costo / Comprobante</th>
                                        <th>Proveedor / Responsable</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingMovimientos ? (
                                        <tr>
                                            <td colSpan={7} className="text-center" style={{ padding: '3rem' }}>
                                                <i className="bi bi-arrow-repeat spin" style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem', color: 'var(--color-primary)' }}></i>
                                                Cargando historial de movimientos...
                                            </td>
                                        </tr>
                                    ) : historialMovimientos.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center" style={{ padding: '3.5rem' }}>
                                                <i className="bi bi-clock-history" style={{ fontSize: '2.4rem', opacity: 0.35, display: 'block', marginBottom: '0.75rem' }}></i>
                                                No se encontraron movimientos registrados con los filtros aplicados.
                                            </td>
                                        </tr>
                                    ) : (
                                        historialMovimientos.map((mov) => {
                                            const fDate = mov.created_at ? new Date(mov.created_at) : null;
                                            const dateStr = fDate ? fDate.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
                                            const timeStr = fDate ? fDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '';
                                            
                                            // Badges de operación con colores del design system
                                            let badgeBg = 'var(--color-bg-alt, #f1f5f9)';
                                            let badgeColor = 'var(--color-text, #334155)';
                                            let icon = 'bi-circle';
                                            let label = mov.tipo;

                                            if (mov.tipo === 'ingreso') {
                                                badgeBg = 'rgba(16, 185, 129, 0.12)';
                                                badgeColor = '#059669';
                                                icon = 'bi-box-arrow-in-down';
                                                label = 'Ingreso a Almacén';
                                            } else if (mov.tipo === 'apertura_taller') {
                                                badgeBg = 'rgba(2, 132, 199, 0.12)';
                                                badgeColor = '#0284c7';
                                                icon = 'bi-gear-wide-connected';
                                                label = 'Pasar a Laboratorio';
                                            } else if (mov.tipo === 'agotado_taller') {
                                                badgeBg = 'rgba(245, 158, 11, 0.12)';
                                                badgeColor = '#d97706';
                                                icon = 'bi-check2-circle';
                                                label = 'Terminado en Lab';
                                            } else if (mov.tipo === 'consumo_unitario') {
                                                badgeBg = 'rgba(100, 116, 139, 0.12)';
                                                badgeColor = '#475569';
                                                icon = 'bi-box-arrow-up-right';
                                                label = 'Salida de Almacén';
                                            } else if (mov.tipo === 'merma_taller') {
                                                badgeBg = 'rgba(239, 68, 68, 0.12)';
                                                badgeColor = '#dc2626';
                                                icon = 'bi-x-circle';
                                                label = 'Merma / Rotura';
                                            }

                                            return (
                                                <tr key={mov.id}>
                                                    <td>
                                                        <div style={{ fontSize: '0.84rem', fontWeight: 650, color: 'var(--color-text)' }}>{dateStr}</div>
                                                        <div style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', marginTop: '1px' }}>{timeStr}</div>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 650, color: 'var(--color-text)' }}>
                                                            {mov.material_nombre}
                                                        </div>
                                                        <div style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '2px' }}>
                                                            {mov.material_color && (
                                                                <span className="badge" style={{ padding: '1px 6px', fontSize: '0.68rem', background: 'var(--color-bg-alt, #f1f5f9)' }}>
                                                                    Color: <strong>{mov.material_color}</strong>
                                                                </span>
                                                            )}
                                                            {mov.material_categoria && <span>• {mov.material_categoria}</span>}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '5px',
                                                                padding: '3px 9px',
                                                                borderRadius: '12px',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 600,
                                                                background: badgeBg,
                                                                color: badgeColor
                                                            }}
                                                        >
                                                            <i className={`bi ${icon}`}></i>
                                                            {label}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: mov.tipo === 'ingreso' ? 'var(--color-success, #10b981)' : 'var(--color-text)' }}>
                                                            {mov.tipo === 'ingreso' ? `+${mov.cantidad}` : `-${mov.cantidad}`}
                                                        </span>
                                                        <span style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', marginLeft: '3px', fontWeight: 500 }}>
                                                            {mov.material_unidad || 'ud'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <span style={{ color: 'var(--color-text-secondary)', minWidth: '54px' }}>Almacén:</span>
                                                                <span style={{ fontWeight: 650 }}>{mov.stock_almacen_anterior}</span>
                                                                <i className="bi bi-arrow-right" style={{ fontSize: '0.68rem', color: 'var(--color-text-tertiary)' }}></i>
                                                                <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{mov.stock_almacen_nuevo}</span>
                                                            </div>
                                                            {(mov.stock_en_uso_anterior !== null && mov.stock_en_uso_nuevo !== null && (mov.stock_en_uso_anterior > 0 || mov.stock_en_uso_nuevo > 0 || mov.tipo === 'apertura_taller' || mov.tipo === 'agotado_taller')) && (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <span style={{ color: 'var(--color-text-secondary)', minWidth: '54px' }}>Lab:</span>
                                                                    <span style={{ fontWeight: 650 }}>{mov.stock_en_uso_anterior}</span>
                                                                    <i className="bi bi-arrow-right" style={{ fontSize: '0.68rem', color: 'var(--color-text-tertiary)' }}></i>
                                                                    <span style={{ fontWeight: 700, color: '#0284c7' }}>{mov.stock_en_uso_nuevo}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {mov.costo_unitario ? (
                                                            <div style={{ fontWeight: 650, fontSize: '0.88rem', color: 'var(--color-success, #10b981)' }}>
                                                                S/ {parseFloat(mov.costo_unitario).toFixed(2)}
                                                                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', fontWeight: 400 }}> /ud</span>
                                                            </div>
                                                        ) : (
                                                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>—</div>
                                                        )}
                                                        {mov.referencia && (
                                                            <div style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                                <i className="bi bi-receipt"></i>
                                                                <span>{mov.referencia}</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div style={{ fontSize: '0.84rem', fontWeight: 650, color: 'var(--color-text)' }}>
                                                            {mov.proveedor_nombre || mov.proveedor_nombre_comercial || '—'}
                                                        </div>
                                                        <div style={{ fontSize: '0.73rem', color: 'var(--color-text-secondary)', display: 'flex', gap: '0.4rem', marginTop: '2px', flexWrap: 'wrap' }}>
                                                            {mov.usuario_nombre && <span><i className="bi bi-person"></i> {mov.usuario_nombre}</span>}
                                                            {mov.notas && <span title={mov.notas}>• {mov.notas.length > 30 ? `${mov.notas.substring(0, 30)}...` : mov.notas}</span>}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* MOBILE CARDS */}
                        <div className="mobile-cards mobile-only almacen-mobile-cards" style={{ marginTop: 'var(--space-4)' }}>
                            {loadingMovimientos ? (
                                [1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12 }} />)
                            ) : historialMovimientos.length === 0 ? (
                                <div className="mobile-card">
                                    <div className="mobile-field-value">No se encontraron movimientos registrados</div>
                                </div>
                            ) : (
                                historialMovimientos.map((mov) => {
                                    const fDate = mov.created_at ? new Date(mov.created_at) : null;
                                    const dateStr = fDate ? fDate.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
                                    const timeStr = fDate ? fDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '';

                                    return (
                                        <div key={mov.id} className="mobile-card">
                                            <div className="mobile-card-head">
                                                <div>
                                                    <div className="mobile-card-title">{mov.material_nombre}</div>
                                                    <div style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                                        {dateStr} {timeStr} {mov.material_color ? `• Color: ${mov.material_color}` : ''}
                                                    </div>
                                                </div>
                                                <span className={`badge ${mov.tipo === 'ingreso' ? 'badge-success' : 'badge-primary'}`} style={{ fontSize: '0.72rem' }}>
                                                    {mov.tipo === 'ingreso' ? `+${mov.cantidad}` : `-${mov.cantidad}`} {mov.material_unidad}
                                                </span>
                                            </div>
                                            <div className="mobile-card-grid">
                                                <div className="mobile-field">
                                                    <span className="mobile-field-label">Operación</span>
                                                    <span className="mobile-field-value" style={{ fontWeight: 600 }}>
                                                        {mov.tipo === 'ingreso' ? 'Ingreso Almacén' : mov.tipo === 'apertura_taller' ? 'Pasar a Lab' : mov.tipo === 'agotado_taller' ? 'Terminado Lab' : mov.tipo}
                                                    </span>
                                                </div>
                                                <div className="mobile-field">
                                                    <span className="mobile-field-label">Stock Almacén</span>
                                                    <span className="mobile-field-value">
                                                        {mov.stock_almacen_anterior} → <strong>{mov.stock_almacen_nuevo}</strong>
                                                    </span>
                                                </div>
                                                <div className="mobile-field">
                                                    <span className="mobile-field-label">Costo / Ref</span>
                                                    <span className="mobile-field-value">
                                                        {mov.costo_unitario ? `S/ ${parseFloat(mov.costo_unitario).toFixed(2)}` : (mov.referencia || '—')}
                                                    </span>
                                                </div>
                                                <div className="mobile-field">
                                                    <span className="mobile-field-label">Proveedor / Resp.</span>
                                                    <span className="mobile-field-value">
                                                        {mov.proveedor_nombre || mov.usuario_nombre || '—'}
                                                    </span>
                                                </div>
                                            </div>
                                            {mov.notas && (
                                                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', borderTop: '1px solid var(--color-border)', paddingTop: '0.35rem' }}>
                                                    {mov.notas}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* TAB 3: PROVEEDORES */}
            {activeTab === 'proveedores' && (
                <>
                    <div className="grid grid-cols-4 almacen-kpi-grid">
                        <div className="card kpi-card almacen-kpi-card">
                            <div className="almacen-kpi-row">
                                <div className="kpi-icon" style={{ background: 'rgba(8,145,178,0.1)', color: 'var(--color-primary)' }}>
                                    <i className="bi bi-truck" aria-hidden="true"></i>
                                </div>
                                <div className="almacen-kpi-copy">
                                    <div className="kpi-label">Proveedores Activos</div>
                                    <div className="kpi-value">{totalProveedoresActivos}</div>
                                </div>
                            </div>
                        </div>
                        <div className="card kpi-card almacen-kpi-card">
                            <div className="almacen-kpi-row">
                                <div className="kpi-icon" style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--color-success, #10b981)' }}>
                                    <i className="bi bi-box-seam" aria-hidden="true"></i>
                                </div>
                                <div className="almacen-kpi-copy">
                                    <div className="kpi-label">Insumos y Stock</div>
                                    <div className="kpi-value">{totalProvMateriales}</div>
                                </div>
                            </div>
                        </div>
                        <div className="card kpi-card almacen-kpi-card">
                            <div className="almacen-kpi-row">
                                <div className="kpi-icon" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
                                    <i className="bi bi-tools" aria-hidden="true"></i>
                                </div>
                                <div className="almacen-kpi-copy">
                                    <div className="kpi-label">Servicios / Soporte</div>
                                    <div className="kpi-value">{totalProvServicios}</div>
                                </div>
                            </div>
                        </div>
                        <div className="card kpi-card almacen-kpi-card">
                            <div className="almacen-kpi-row">
                                <div className="kpi-icon" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--color-warning)' }}>
                                    <i className="bi bi-tags-fill" aria-hidden="true"></i>
                                </div>
                                <div className="almacen-kpi-copy">
                                    <div className="kpi-label">Ítems con Precio</div>
                                    <div className="kpi-value">{totalItemsConPrecio}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="inventory-toolbar">
                            <div className="inventory-toolbar-main">
                                <div className="search-box inventory-search-box">
                                    <i className="bi bi-search"></i>
                                    <input
                                        className="form-input"
                                        placeholder="Buscar por razón social, rubro o contacto..."
                                        value={searchProveedor}
                                        onChange={e => setSearchProveedor(e.target.value)}
                                    />
                                </div>
                                <div className="pedidos-custom-select-wrap" ref={rubroDropdownRef}>
                                    <button
                                        type="button"
                                        className={`btn btn-sm pedidos-custom-select-trigger${filtroRubro ? ' is-active' : ''}${rubroDropdownOpen ? ' is-open' : ''}`}
                                        onClick={() => setRubroDropdownOpen((prev) => !prev)}
                                        aria-expanded={rubroDropdownOpen}
                                        aria-haspopup="listbox"
                                    >
                                        {filtroRubro ? (
                                            <>
                                                <i className="bi bi-tag-fill text-primary" aria-hidden="true"></i>
                                                <span className="pedidos-custom-select-text">
                                                    {filtroRubro}
                                                </span>
                                                <span
                                                    className="pedidos-chip-clear"
                                                    role="button"
                                                    tabIndex={0}
                                                    title="Limpiar filtro de rubro"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setFiltroRubro('');
                                                    }}
                                                >
                                                    ✕
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <i className="bi bi-funnel" aria-hidden="true"></i>
                                                <span className="pedidos-custom-select-text">Rubro / Especialidad</span>
                                                <i className={`bi bi-chevron-down pedidos-custom-select-chevron${rubroDropdownOpen ? ' is-rotated' : ''}`} aria-hidden="true"></i>
                                            </>
                                        )}
                                    </button>

                                    {rubroDropdownOpen && (
                                        <div className="pedidos-custom-select-menu" role="listbox">
                                            <button
                                                type="button"
                                                className={`pedidos-custom-select-item${!filtroRubro ? ' is-selected' : ''}`}
                                                onClick={() => {
                                                    setFiltroRubro('');
                                                    setRubroDropdownOpen(false);
                                                }}
                                                role="option"
                                                aria-selected={!filtroRubro}
                                            >
                                                <i className="bi bi-grid text-secondary" style={{ width: 14, textAlign: 'center' }}></i>
                                                <span>Todos los rubros</span>
                                                {!filtroRubro && <i className="bi bi-check2 text-primary" style={{ marginLeft: 'auto', fontWeight: 800 }}></i>}
                                            </button>
                                            <div className="pedidos-custom-select-divider" />
                                            {PRESET_RUBROS_FILTER.map((rub) => (
                                                <button
                                                    key={rub}
                                                    type="button"
                                                    className={`pedidos-custom-select-item${filtroRubro === rub ? ' is-selected' : ''}`}
                                                    onClick={() => {
                                                        setFiltroRubro(rub);
                                                        setRubroDropdownOpen(false);
                                                    }}
                                                    role="option"
                                                    aria-selected={filtroRubro === rub}
                                                >
                                                    <i className="bi bi-tag text-secondary" style={{ width: 14, textAlign: 'center', fontSize: '0.85rem' }}></i>
                                                    <span>{rub}</span>
                                                    {filtroRubro === rub && <i className="bi bi-check2 text-primary" style={{ marginLeft: 'auto', fontWeight: 800 }}></i>}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="segmented-control inventory-status-switch" role="group" aria-label="Estado del proveedor">
                                <button
                                    type="button"
                                    className={`segmented-control__btn${proveedorView === 'activos' ? ' is-active' : ''}`}
                                    aria-pressed={proveedorView === 'activos'}
                                    onClick={() => setProveedorView('activos')}
                                >
                                    Activos
                                </button>
                                <button
                                    type="button"
                                    className={`segmented-control__btn${proveedorView === 'inactivos' ? ' is-active' : ''}`}
                                    aria-pressed={proveedorView === 'inactivos'}
                                    onClick={() => setProveedorView('inactivos')}
                                >
                                    Inactivos
                                </button>
                                <button
                                    type="button"
                                    className={`segmented-control__btn${proveedorView === 'todos' ? ' is-active' : ''}`}
                                    aria-pressed={proveedorView === 'todos'}
                                    onClick={() => setProveedorView('todos')}
                                >
                                    Todos
                                </button>
                            </div>
                        </div>

                        {/* Desktop Table Proveedores */}
                        <div className="data-table-wrapper desktop-only" style={{ border: 'none' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Proveedor / Empresa</th>
                                        <th>Rubros / Especialidad</th>
                                        <th>Contacto Comercial</th>
                                        <th>Insumos & Precios</th>
                                        <th>Condición</th>
                                        <th style={{ textAlign: 'center' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingProveedores ? (
                                        <tr><td colSpan="6" className="text-center">Cargando proveedores...</td></tr>
                                    ) : filteredProveedores.length === 0 ? (
                                        <tr><td colSpan="6" className="text-center">No hay proveedores registrados</td></tr>
                                    ) : (
                                        filteredProveedores.map(p => (
                                            <tr key={p.id} className={p.activo === false ? 'inventory-row-inactive' : ''}>
                                                <td>
                                                    <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.92rem' }}>
                                                        {p.razon_social}
                                                    </div>
                                                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                                        {p.nombre_comercial && p.nombre_comercial !== p.razon_social ? `${p.nombre_comercial} • ` : ''}
                                                        {p.numero_documento ? `${p.tipo_documento || 'RUC'} ${p.numero_documento} • ` : ''}
                                                        {p.ciudad || 'Arequipa'}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '300px' }}>
                                                        {Array.isArray(p.rubros) && p.rubros.length > 0 ? (
                                                            p.rubros.map((r) => {
                                                                const isDisco = r.toLowerCase().includes('disco');
                                                                const isResina = r.toLowerCase().includes('resina');
                                                                const isFresa = r.toLowerCase().includes('fresa') && !r.toLowerCase().includes('fresadora');
                                                                const isEquipo = r.toLowerCase().includes('fresadora') || r.toLowerCase().includes('impresora');
                                                                const isMerch = r.toLowerCase().includes('merch');
                                                                const isServ = r.toLowerCase().includes('servicio') || r.toLowerCase().includes('tecnic');

                                                                let bg = 'var(--color-bg-alt, #f1f5f9)';
                                                                let color = 'var(--color-text, #334155)';
                                                                let border = 'rgba(0,0,0,0.06)';

                                                                if (isDisco) { bg = 'rgba(8,145,178,0.12)'; color = '#0891b2'; }
                                                                else if (isResina) { bg = 'rgba(168,85,247,0.12)'; color = '#9333ea'; }
                                                                else if (isFresa) { bg = 'rgba(245,158,11,0.12)'; color = '#d97706'; }
                                                                else if (isEquipo) { bg = 'rgba(59,130,246,0.12)'; color = '#2563eb'; }
                                                                else if (isMerch) { bg = 'rgba(236,72,153,0.12)'; color = '#db2777'; }
                                                                else if (isServ) { bg = 'rgba(99,102,241,0.12)'; color = '#6366f1'; }

                                                                return (
                                                                    <span
                                                                        key={r}
                                                                        style={{
                                                                            padding: '2px 8px',
                                                                            borderRadius: '12px',
                                                                            fontSize: '0.74rem',
                                                                            fontWeight: 600,
                                                                            background: bg,
                                                                            color: color,
                                                                            border: `1px solid ${border}`
                                                                        }}
                                                                    >
                                                                        {r}
                                                                    </span>
                                                                );
                                                            })
                                                        ) : (
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                                                {p.tipo_proveedor === 'servicios' ? '🛠️ Servicios' : '📦 Insumos'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ fontSize: '0.85rem' }}>
                                                        {p.contacto_nombre && <div>{p.contacto_nombre}</div>}
                                                        {p.telefono ? (
                                                            <a href={`tel:${p.telefono}`} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
                                                                <i className="bi bi-telephone-fill" style={{ fontSize: '0.7rem' }}></i> {p.telefono}
                                                            </a>
                                                        ) : (
                                                            <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => {
                                                            setSelectedProveedorId(p.id);
                                                            setMaterialesModalOpen(true);
                                                        }}
                                                        style={{
                                                            padding: '0.25rem 0.6rem',
                                                            borderRadius: '6px',
                                                            background: 'var(--color-bg-alt, #f1f5f9)',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 600
                                                        }}
                                                    >
                                                        <i className="bi bi-tags text-primary" style={{ marginRight: '4px' }}></i>
                                                        {p.total_materiales || 0} {(p.total_materiales === 1) ? 'precio' : 'precios'}
                                                    </button>
                                                </td>
                                                <td>
                                                    <span style={{ fontSize: '0.82rem', textTransform: 'capitalize' }}>
                                                        {p.condicion_pago?.replace('_', ' ') || 'Contado'}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'inline-flex', gap: '4px' }}>
                                                        <button
                                                            className="btn btn-primary btn-sm"
                                                            onClick={() => {
                                                                setSelectedProveedorId(p.id);
                                                                setMaterialesModalOpen(true);
                                                            }}
                                                            title="Ver catálogo de insumos y precios"
                                                            style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}
                                                        >
                                                            <i className="bi bi-card-checklist"></i> Precios
                                                        </button>
                                                        <button
                                                            className="btn btn-ghost btn-sm btn-icon"
                                                            onClick={() => {
                                                                setEditingProveedor(p);
                                                                setProveedorModalOpen(true);
                                                            }}
                                                            title="Editar datos del proveedor"
                                                        >
                                                            <i className="bi bi-pencil"></i>
                                                        </button>
                                                        {p.activo === false ? (
                                                            <button
                                                                className="btn btn-ghost btn-sm btn-icon"
                                                                onClick={() => handleToggleProveedorEstado(p, true)}
                                                                title="Reactivar proveedor"
                                                                disabled={restoringProveedorId === p.id}
                                                            >
                                                                <i className="bi bi-arrow-counterclockwise"></i>
                                                            </button>
                                                        ) : (
                                                            <button
                                                                className="btn btn-ghost btn-sm btn-icon"
                                                                onClick={() => handleToggleProveedorEstado(p, false)}
                                                                title="Dar de baja proveedor"
                                                                style={{ color: '#ef4444' }}
                                                                disabled={deletingProveedorId === p.id}
                                                            >
                                                                <i className="bi bi-trash"></i>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards Proveedores */}
                        <div className="mobile-cards mobile-only almacen-mobile-cards" style={{ marginTop: 'var(--space-4)' }}>
                            {loadingProveedores ? (
                                [1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12 }} />)
                            ) : filteredProveedores.length === 0 ? (
                                <div className="mobile-card">
                                    <div className="mobile-field-value">No hay proveedores registrados</div>
                                </div>
                            ) : (
                                filteredProveedores.map(p => (
                                    <div key={p.id} className="mobile-card">
                                        <div className="mobile-card-head">
                                            <div>
                                                <div className="mobile-card-title">{p.razon_social}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                                    {p.numero_documento ? `${p.tipo_documento || 'RUC'} ${p.numero_documento} • ` : ''}{p.ciudad || 'Arequipa'}
                                                </div>
                                            </div>
                                            {p.activo === false ? (
                                                <span className="badge badge-inactive">Inactivo</span>
                                            ) : p.tipo_proveedor === 'materiales' ? (
                                                <span className="badge badge-en_produccion">📦 Insumos</span>
                                            ) : (
                                                <span className="badge badge-terminado">🛠️ Servicios</span>
                                            )}
                                        </div>

                                        {/* Rubros en mobile */}
                                        {Array.isArray(p.rubros) && p.rubros.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '0.5rem 0' }}>
                                                {p.rubros.map(r => (
                                                    <span
                                                        key={r}
                                                        style={{
                                                            padding: '2px 7px',
                                                            borderRadius: '10px',
                                                            fontSize: '0.72rem',
                                                            fontWeight: 600,
                                                            background: 'var(--color-bg-alt, #f1f5f9)',
                                                            color: 'var(--color-text, #334155)',
                                                            border: '1px solid rgba(0,0,0,0.06)'
                                                        }}
                                                    >
                                                        {r}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        <div className="mobile-card-grid">
                                            <div className="mobile-field"><span className="mobile-field-label">Contacto</span><span className="mobile-field-value">{p.contacto_nombre || '—'}</span></div>
                                            <div className="mobile-field">
                                                <span className="mobile-field-label">Teléfono</span>
                                                <span className="mobile-field-value">
                                                    {p.telefono ? <a href={`tel:${p.telefono}`}>{p.telefono}</a> : '—'}
                                                </span>
                                            </div>
                                            <div className="mobile-field"><span className="mobile-field-label">Insumos vinculados</span><span className="mobile-field-value">{p.total_materiales || 0} ítems</span></div>
                                            <div className="mobile-field"><span className="mobile-field-label">Condición</span><span className="mobile-field-value">{p.condicion_pago || 'Contado'}</span></div>
                                        </div>
                                        <div className="mobile-card-actions">
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => {
                                                    setSelectedProveedorId(p.id);
                                                    setMaterialesModalOpen(true);
                                                }}
                                                style={{ flex: 1 }}
                                            >
                                                <i className="bi bi-card-checklist"></i> Insumos & Precios ({p.total_materiales || 0})
                                            </button>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => {
                                                    setEditingProveedor(p);
                                                    setProveedorModalOpen(true);
                                                }}
                                            >
                                                <i className="bi bi-pencil"></i>
                                            </button>
                                            {p.activo === false ? (
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => handleToggleProveedorEstado(p, true)}
                                                    disabled={restoringProveedorId === p.id}
                                                >
                                                    <i className="bi bi-arrow-counterclockwise"></i>
                                                </button>
                                            ) : (
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    style={{ color: '#ef4444' }}
                                                    onClick={() => handleToggleProveedorEstado(p, false)}
                                                    disabled={deletingProveedorId === p.id}
                                                >
                                                    <i className="bi bi-trash"></i>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* MODAL: MATERIAL (INVENTARIO) */}
            <Modal open={modalOpen} onClose={() => setModalOpen(false)}
                icon="bi-boxes"
                kicker="Inventario y Almacén"
                title={editing ? 'Editar Material' : 'Nuevo Material'}
                subtitle="Control de existencias, flujo de laboratorio y alertas de reposición"
                footer={<>
                    {editing && (
                        <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ color: '#ef4444', marginRight: 'auto' }}
                            onClick={() => {
                                setConfirmDeleteMaterial(editing);
                            }}
                            title="Eliminar este material del sistema"
                        >
                            <i className="bi bi-trash"></i> Eliminar
                        </button>
                    )}
                    <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                    <button className="btn btn-primary" onClick={save}><i className="bi bi-check-lg"></i> {editing ? 'Guardar Cambios' : 'Registrar Material'}</button>
                </>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Nombre del Material *</label>
                        <div className="form-input-box has-lead">
                            <i className="bi bi-box-seam-fill input-icon-lead"></i>
                            <input
                                className="form-input"
                                value={form.nombre}
                                onChange={e => setForm({ ...form, nombre: e.target.value })}
                                placeholder="Ej. Zirconia Multilayer 3D Pro"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Color / Tonalidad</label>
                            <div className="form-input-box has-lead">
                                <i className="bi bi-palette-fill input-icon-lead"></i>
                                <input
                                    className="form-input"
                                    placeholder="Ej. A1, A2, BL2 (o vacío)..."
                                    value={form.color}
                                    onChange={e => setForm({ ...form, color: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Unidad de Presentación</label>
                            <CustomSelect
                                value={form.unidad}
                                onChange={e => setForm({ ...form, unidad: e.target.value })}
                                options={units.map((unit) => ({
                                    value: unit.value,
                                    label: unit.label
                                }))}
                            />
                        </div>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Categoría de Almacén</label>
                        <CustomSelect
                            value={form.categoria}
                            onChange={e => setForm({ ...form, categoria: e.target.value })}
                            options={[
                                { value: 'disco', label: 'Disco (Fresado CAD/CAM)' },
                                { value: 'bloque', label: 'Bloque (Cerámica / PMMA)' },
                                { value: 'resina', label: 'Resina (Impresión 3D)' },
                                { value: 'fresa', label: 'Fresa (Fresadora)' },
                                { value: 'consumible', label: 'Consumible / Taller' },
                                { value: 'liquido', label: 'Líquido / Químico / Glaseador' }
                            ]}
                        />
                    </div>

                    <div className="grid grid-cols-3" style={{ gap: '0.85rem' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Stock en Almacén</label>
                            <div className="form-input-box has-lead">
                                <i className="bi bi-box-seam input-icon-lead"></i>
                                <input
                                    className="form-input"
                                    type="number"
                                    step="0.01"
                                    value={form.stock_actual}
                                    onChange={e => setForm({ ...form, stock_actual: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Stock en Laboratorio</label>
                            <div className="form-input-box has-lead">
                                <i className="bi bi-gear-wide-connected input-icon-lead"></i>
                                <input
                                    className="form-input"
                                    type="number"
                                    step="0.01"
                                    value={form.stock_en_uso}
                                    onChange={e => setForm({ ...form, stock_en_uso: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Stock Mínimo</label>
                            <div className="form-input-box has-lead">
                                <i className="bi bi-shield-exclamation input-icon-lead"></i>
                                <input
                                    className="form-input"
                                    type="number"
                                    step="0.01"
                                    value={form.stock_minimo}
                                    onChange={e => setForm({ ...form, stock_minimo: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-option-row" style={{ margin: '0.25rem 0 0 0' }}>
                        <div className="form-option-content">
                            <div className="form-option-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>
                                <i className="bi bi-bell-fill"></i>
                            </div>
                            <div>
                                <h4 className="form-option-title">Alerta de Reposición</h4>
                                <p className="form-option-desc">Notificar en el panel cuando las existencias alcancen o bajen del stock mínimo</p>
                            </div>
                        </div>
                        <label className="switch" style={{ margin: 0 }}>
                            <input type="checkbox" checked={!!form.alerta_bajo_stock} onChange={e => setForm({ ...form, alerta_bajo_stock: e.target.checked })} />
                            <span className="slider round"></span>
                        </label>
                    </div>

                    <div className="form-option-row" style={{ margin: '0.25rem 0 0 0' }}>
                        <div className="form-option-content">
                            <div className="form-option-icon" style={{ background: form.activo !== false ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)', color: form.activo !== false ? '#10b981' : '#64748b' }}>
                                <i className={`bi ${form.activo !== false ? 'bi-check-circle-fill' : 'bi-pause-circle-fill'}`}></i>
                            </div>
                            <div>
                                <h4 className="form-option-title">Material Activo</h4>
                                <p className="form-option-desc">
                                    {form.activo !== false
                                        ? 'Disponible para compras, asignación a productos y movimientos de laboratorio'
                                        : 'Inactivo temporalmente (sin reposición inmediata, oculto de listas principales)'}
                                </p>
                            </div>
                        </div>
                        <label className="switch" style={{ margin: 0 }}>
                            <input
                                type="checkbox"
                                checked={form.activo !== false}
                                onChange={e => setForm({ ...form, activo: e.target.checked })}
                            />
                            <span className="slider round"></span>
                        </label>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Notas y Observaciones Técnicas</label>
                        <textarea
                            className="form-textarea"
                            value={form.notas}
                            onChange={e => setForm({ ...form, notas: e.target.value })}
                            placeholder="Lote, proveedor habitual, características de uso..."
                            rows={2}
                        />
                    </div>
                </div>
            </Modal>

            {/* MODAL: MOVIMIENTO DE STOCK (INGRESO / ABRIR A TALLER / CONSUMO / AGOTAR / MERMA) */}
            <MaterialMovimientoModal
                isOpen={movimientoModalOpen}
                onClose={() => {
                    setMovimientoModalOpen(false);
                    setSelectedMaterialMovimiento(null);
                }}
                material={selectedMaterialMovimiento}
                materiales={activeMaterials}
                proveedores={proveedores.filter(p => p.activo !== false)}
                initialTipo={initialTipoMovimiento}
                onSuccess={() => {
                    fetchMateriales();
                    fetchMovimientos();
                }}
            />

            {/* MODAL: KÁRDEX / TRAZABILIDAD */}
            <MaterialKardexModal
                isOpen={kardexModalOpen}
                onClose={() => {
                    setKardexModalOpen(false);
                    setSelectedMaterialKardex(null);
                }}
                material={selectedMaterialKardex}
            />

            {/* MODAL: PROVEEDOR (NUEVO / EDITAR) */}
            <ProveedorModal
                isOpen={proveedorModalOpen}
                onClose={() => {
                    setProveedorModalOpen(false);
                    setEditingProveedor(null);
                }}
                proveedor={editingProveedor}
                onSaved={fetchProveedores}
            />

            {/* MODAL: CATÁLOGO DE INSUMOS & PRECIOS DEL PROVEEDOR */}
            <ProveedorMaterialesModal
                isOpen={materialesModalOpen}
                onClose={() => {
                    setMaterialesModalOpen(false);
                    setSelectedProveedorId(null);
                }}
                proveedorId={selectedProveedorId}
                materialesInventario={materiales}
                onUpdated={fetchProveedores}
            />

            {/* CONFIRM DIALOG: ELIMINAR MATERIAL */}
            <ConfirmDialog
                open={!!confirmDeleteMaterial}
                onClose={() => { if (!deletingId) setConfirmDeleteMaterial(null); }}
                onConfirm={confirmRemoveMaterial}
                confirming={!!deletingId}
                variant="danger"
                title="Eliminar material"
                confirmLabel="Eliminar definitivamente"
                cancelLabel="Cancelar"
                message={(
                    <div>
                        <p style={{ margin: 0 }}>
                            ¿Estás seguro de que deseas eliminar definitivamente el material <strong>{confirmDeleteMaterial?.nombre}</strong>?
                        </p>
                        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                            Si no tiene productos vinculados ni movimientos en kárdex, se borrará por completo de la base de datos. Si solo deseas pausarlo temporalmente, puedes editarlo y desactivar el switch <em>Material Activo</em>.
                        </p>
                    </div>
                )}
            />

            {/* CONFIRM DIALOG: ELIMINAR PROVEEDOR */}
            <ConfirmDialog
                open={!!confirmDeleteProveedor}
                onClose={() => { if (!deletingProveedorId) setConfirmDeleteProveedor(null); }}
                onConfirm={confirmRemoveProveedor}
                confirming={!!deletingProveedorId}
                variant="danger"
                title="Dar de baja proveedor"
                confirmLabel="Dar de Baja"
                cancelLabel="Cancelar"
                message={(
                    <p>
                        ¿Dar de baja al proveedor <strong>{confirmDeleteProveedor?.razon_social}</strong>? Se ocultará de la lista activa,
                        pero sus precios e histórico se conservarán y podrá reactivarse en cualquier momento desde la vista de inactivos.
                    </p>
                )}
            />
        </div>
    );
};

export default Almacen;
