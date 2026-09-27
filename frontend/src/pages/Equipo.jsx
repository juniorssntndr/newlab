import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../state/AuthContext.jsx';
import {
    isAdminRole,
    isVisitorRole,
    SYSTEM_MODULES,
    DEFAULT_ROLE_MODULES
} from '../utils/accessControl.js';
import { API_URL } from '../config.js';
import Modal from '../components/Modal.jsx';
import CustomSelect from '../components/CustomSelect.jsx';
import '../styles/equipo-modal.css';

const ROLE_CONFIG = {
    admin: { label: 'Administrador', icon: 'bi-shield-shaded', badgeClass: 'badge-role badge-role-admin', desc: 'Control total del sistema' },
    socio: { label: 'Socio / Gerencia', icon: 'bi-briefcase-fill', badgeClass: 'badge-role badge-role-socio', desc: 'Métricas, finanzas y control gerencial' },
    tecnico: { label: 'Protesista / Técnico', icon: 'bi-gear-fill', badgeClass: 'badge-role badge-role-tecnico', desc: 'Producción dental, catálogo y almacén' },
    operador: { label: 'Recepcionista / Caja', icon: 'bi-wallet2', badgeClass: 'badge-role badge-role-operador', desc: 'Caja, pedidos y mostrador' },
    visitador: { label: 'Visitador Comercial', icon: 'bi-geo-alt-fill', badgeClass: 'badge-role badge-role-visitador', desc: 'CRM y captación clínica en Arequipa' },
    cliente: { label: 'Cliente (Portal)', icon: 'bi-building-check', badgeClass: 'badge-role badge-role-cliente', desc: 'Acceso exclusivo a portal de pedidos' }
};

const ROL_OPTIONS = [
    { value: 'admin', label: 'Administrador (Control Total del Sistema)', icon: 'bi-shield-shaded' },
    { value: 'socio', label: 'Socio / Gerencia (Finanzas, Reportes y Auditoría)', icon: 'bi-briefcase-fill' },
    { value: 'tecnico', label: 'Protesista / Técnico Dental (Producción y Tareas)', icon: 'bi-gear-fill' },
    { value: 'operador', label: 'Recepcionista / Operador de Caja (Mostrador y Finanzas)', icon: 'bi-wallet2' },
    { value: 'visitador', label: 'Visitador Comercial (CRM y Clínicas)', icon: 'bi-geo-alt-fill' },
];

const ESTADO_OPTIONS = [
    { value: 'activo', label: 'Activo (Permitir Ingreso)', dotColor: '#10b981' },
    { value: 'inactivo', label: 'Inactivo (Bloquear Acceso)', dotColor: '#ef4444' },
];

const FORM_EMPTY = {
    nombre: '',
    email: '',
    telefono: '',
    tipo: 'tecnico',
    estado: 'activo',
    password: '',
    clinica_id: '',
    permisos_modulos: DEFAULT_ROLE_MODULES.tecnico
};

const Equipo = () => {
    const { user, getHeaders } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const isVisitor = isVisitorRole(user);
    const isAdmin = isAdminRole(user);

    // Si es visitador, su vista predeterminada y única es clientes
    const initialTab = isVisitor ? 'clientes' : (searchParams.get('tab') || 'equipo');
    const [activeTab, setActiveTab] = useState(initialTab);
    const [searchQuery, setSearchQuery] = useState('');

    const [usuarios, setUsuarios] = useState([]);
    const [clinicas, setClinicas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(FORM_EMPTY);
    const [saving, setSaving] = useState(false);

    const handleTabChange = (newTab) => {
        if (isVisitor && newTab === 'equipo') return;
        setActiveTab(newTab);
        setSearchParams({ tab: newTab });
    };

    const fetchUsuarios = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/usuarios`, { headers: getHeaders() });
            if (!res.ok) throw new Error('Error al cargar usuarios');
            const data = await res.json();
            setUsuarios(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
            toast.error('No se pudo cargar la lista de usuarios');
        } finally {
            setLoading(false);
        }
    };

    const fetchClinicas = async () => {
        try {
            const res = await fetch(`${API_URL}/clinicas`, { headers: getHeaders() });
            if (res.ok) {
                const data = await res.json();
                setClinicas(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error('Error fetching clinicas:', err);
        }
    };

    useEffect(() => {
        if (isAdmin || isVisitor) {
            fetchUsuarios();
            fetchClinicas();
        }
    }, [isAdmin, isVisitor]);

    // Filtrar listas por pestaña
    const equipoUsuarios = useMemo(() => {
        return usuarios.filter(u => ['admin', 'socio', 'operador', 'tecnico', 'visitador'].includes(u.tipo));
    }, [usuarios]);

    const clienteUsuarios = useMemo(() => {
        return usuarios.filter(u => u.tipo === 'cliente' && u.estado !== 'pendiente');
    }, [usuarios]);

    const pendientesUsuarios = useMemo(() => {
        return usuarios.filter(u => u.tipo === 'cliente' && u.estado === 'pendiente');
    }, [usuarios]);

    const filteredList = useMemo(() => {
        let baseList = [];
        if (activeTab === 'equipo') baseList = equipoUsuarios;
        else if (activeTab === 'clientes') baseList = clienteUsuarios;
        else if (activeTab === 'pendientes') baseList = pendientesUsuarios;

        if (!searchQuery.trim()) return baseList;
        const q = searchQuery.toLowerCase();
        return baseList.filter(u =>
            (u.nombre && u.nombre.toLowerCase().includes(q)) ||
            (u.email && u.email.toLowerCase().includes(q)) ||
            (u.clinica_nombre && u.clinica_nombre.toLowerCase().includes(q)) ||
            (u.clinica_ruc && u.clinica_ruc.includes(q))
        );
    }, [activeTab, equipoUsuarios, clienteUsuarios, pendientesUsuarios, searchQuery]);

    const handleRoleChange = (newTipo) => {
        const defaultMods = DEFAULT_ROLE_MODULES[newTipo] || [];
        setForm(prev => ({
            ...prev,
            tipo: newTipo,
            permisos_modulos: defaultMods
        }));
    };

    const handleModuleToggle = (moduleId) => {
        setForm(prev => {
            const current = Array.isArray(prev.permisos_modulos)
                ? prev.permisos_modulos
                : (DEFAULT_ROLE_MODULES[prev.tipo] || []);
            const exists = current.includes(moduleId);
            const updated = exists ? current.filter(m => m !== moduleId) : [...current, moduleId];
            return { ...prev, permisos_modulos: updated };
        });
    };

    const handleActivarCliente = async (id, nombre, clinicaNombre) => {
        try {
            const res = await fetch(`${API_URL}/usuarios/${id}/activar-cliente`, {
                method: 'POST',
                headers: getHeaders()
            });
            if (!res.ok) throw new Error('Error al activar cuenta');
            toast.success(`Cuenta de ${nombre} (${clinicaNombre || 'Clínica'}) activada exitosamente`);
            fetchUsuarios();
            fetchClinicas();
        } catch (err) {
            toast.error(err.message || 'No se pudo activar la cuenta');
        }
    };

    const handleInactivarCliente = async (id) => {
        if (!window.confirm('¿Seguro que deseas inactivar esta solicitud de cuenta?')) return;
        try {
            const res = await fetch(`${API_URL}/usuarios/${id}`, {
                method: 'PATCH',
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: 'inactivo' })
            });
            if (!res.ok) throw new Error('Error al actualizar estado');
            toast.success('Solicitud inactivada');
            fetchUsuarios();
        } catch (err) {
            toast.error(err.message || 'Error al inactivar');
        }
    };

    const openNew = (forTipo = null) => {
        setEditing(null);
        const tipoDefault = forTipo || (activeTab === 'clientes' ? 'cliente' : 'tecnico');
        const defaultMods = DEFAULT_ROLE_MODULES[tipoDefault] || [];
        setForm({
            ...FORM_EMPTY,
            tipo: tipoDefault,
            password: tipoDefault === 'cliente' ? 'cliente123' : '',
            permisos_modulos: defaultMods
        });
        setModalOpen(true);
    };

    const openEdit = (u) => {
        setEditing(u);
        const defaultMods = DEFAULT_ROLE_MODULES[u.tipo] || [];
        setForm({
            nombre: u.nombre || '',
            email: u.email || '',
            telefono: u.telefono || '',
            tipo: u.tipo || 'tecnico',
            estado: u.estado || 'activo',
            password: '',
            clinica_id: u.clinica_id || '',
            permisos_modulos: u.permisos_modulos || defaultMods
        });
        setModalOpen(true);
    };

    const handleClinicaChange = (e) => {
        const cId = e.target.value;
        const selected = clinicas.find(c => String(c.id) === String(cId));
        setForm(prev => {
            const next = { ...prev, clinica_id: cId };
            if (selected) {
                if (!next.nombre || next.nombre.startsWith('Dr.') || next.nombre === '') {
                    next.nombre = selected.contacto_nombre || selected.nombre;
                }
                if (!next.email) {
                    next.email = selected.email || '';
                }
                if (!next.telefono) {
                    next.telefono = selected.telefono || '';
                }
            }
            return next;
        });
    };

    const save = async () => {
        if (!form.nombre.trim() || !form.email.trim()) {
            toast.error('Nombre y Email son obligatorios');
            return;
        }

        if (form.tipo === 'cliente' && !form.clinica_id) {
            toast.error('Debe seleccionar la clínica dental asociada');
            return;
        }

        if (!editing && !form.password) {
            toast.error('Debe asignar una contraseña para la cuenta');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                nombre: form.nombre.trim(),
                email: form.email.trim(),
                telefono: form.telefono?.trim() || null,
                tipo: form.tipo,
                estado: form.estado,
                clinica_id: form.tipo === 'cliente' ? Number(form.clinica_id) : null,
                permisos_modulos: form.tipo === 'cliente' ? null : form.permisos_modulos
            };
            if (form.password) {
                payload.password = form.password;
            }

            const url = editing ? `${API_URL}/usuarios/${editing.id}` : `${API_URL}/usuarios`;
            const method = editing ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    ...getHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al guardar usuario');

            setModalOpen(false);
            toast.success(
                editing
                    ? 'Usuario actualizado correctamente'
                    : form.tipo === 'cliente'
                        ? 'Cuenta de portal otorgada exitosamente'
                        : 'Nuevo integrante registrado con éxito'
            );
            fetchUsuarios();
            fetchClinicas();
        } catch (err) {
            toast.error(err.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    if (!isAdmin && !isVisitor) {
        return (
            <div className="card">
                <div className="empty-state">
                    <i className="bi bi-shield-lock empty-state-icon"></i>
                    <h3 className="empty-state-title">Acceso restringido</h3>
                    <p className="empty-state-text">Solo personal autorizado puede gestionar usuarios y accesos.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div className="page-header-left">
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="bi bi-people-fill text-primary"></i> Gestión de Usuarios
                    </h1>
                    <p>Control de roles del equipo interno y otorgamiento de cuentas de portal a clientes</p>
                </div>
                <div>
                    {activeTab === 'equipo' && (
                        <button className="btn btn-primary" onClick={() => openNew('tecnico')}>
                            <i className="bi bi-person-plus-fill"></i> Nuevo Integrante de Equipo
                        </button>
                    )}
                    {activeTab === 'clientes' && (
                        <button className="btn btn-primary" onClick={() => openNew('cliente')} style={{ background: '#059669', borderColor: '#059669' }}>
                            <i className="bi bi-key-fill"></i> Otorgar Cuenta a Clínica
                        </button>
                    )}
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="section-tabs dashboard-view-switcher" role="group" aria-label="Secciones de usuarios" style={{ marginBottom: 'var(--space-6)' }}>
                {!isVisitor && (
                    <button
                        type="button"
                        className={`btn section-tab dashboard-view-tab ${activeTab === 'equipo' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => handleTabChange('equipo')}
                        aria-pressed={activeTab === 'equipo'}
                    >
                        <i className="bi bi-building" aria-hidden="true"></i>
                        <span>Equipo del Laboratorio</span>
                        <span
                            style={{
                                background: activeTab === 'equipo' ? 'rgba(255,255,255,0.25)' : 'var(--color-bg-alt, #e2e8f0)',
                                color: activeTab === 'equipo' ? '#ffffff' : 'var(--color-text-secondary, #475569)',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                marginLeft: '4px'
                            }}
                        >
                            {equipoUsuarios.length}
                        </span>
                    </button>
                )}
                <button
                    type="button"
                    className={`btn section-tab dashboard-view-tab ${activeTab === 'clientes' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => handleTabChange('clientes')}
                    aria-pressed={activeTab === 'clientes'}
                >
                    <i className="bi bi-hospital" aria-hidden="true"></i>
                    <span>Clientes con Portal</span>
                    <span
                        style={{
                            background: activeTab === 'clientes' ? 'rgba(255,255,255,0.25)' : 'var(--color-bg-alt, #e2e8f0)',
                            color: activeTab === 'clientes' ? '#ffffff' : 'var(--color-text-secondary, #475569)',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            marginLeft: '4px'
                        }}
                    >
                        {clienteUsuarios.length}
                    </span>
                </button>
                {!isVisitor && (
                    <button
                        type="button"
                        className={`btn section-tab dashboard-view-tab ${activeTab === 'pendientes' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => handleTabChange('pendientes')}
                        aria-pressed={activeTab === 'pendientes'}
                    >
                        <i className="bi bi-clock-history" aria-hidden="true"></i>
                        <span>Solicitudes Pendientes</span>
                        <span
                            style={{
                                background: pendientesUsuarios.length > 0
                                    ? (activeTab === 'pendientes' ? '#ffffff' : '#f59e0b')
                                    : (activeTab === 'pendientes' ? 'rgba(255,255,255,0.25)' : 'var(--color-bg-alt, #e2e8f0)'),
                                color: pendientesUsuarios.length > 0
                                    ? (activeTab === 'pendientes' ? '#b45309' : '#ffffff')
                                    : (activeTab === 'pendientes' ? '#ffffff' : 'var(--color-text-secondary, #475569)'),
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                marginLeft: '4px'
                            }}
                        >
                            {pendientesUsuarios.length}
                        </span>
                    </button>
                )}
            </div>

            <div className="card">
                {/* Search box */}
                <div style={{ marginBottom: 'var(--space-4)' }}>
                    <div className="search-box">
                        <i className="bi bi-search"></i>
                        <input
                            className="form-input"
                            placeholder={activeTab === 'equipo' ? "Buscar por nombre, email o rol..." : "Buscar por doctor, clínica o RUC..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {loading ? (
                    <div>{[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8, borderRadius: 8 }} />)}</div>
                ) : filteredList.length === 0 ? (
                    <div className="empty-state">
                        <i className={`bi ${activeTab === 'equipo' ? 'bi-people' : 'bi-hospital'} empty-state-icon`}></i>
                        <h3 className="empty-state-title">
                            {searchQuery ? 'No se encontraron usuarios' : activeTab === 'equipo' ? 'Sin integrantes en el equipo' : 'No hay clientes con cuenta de portal'}
                        </h3>
                        <p className="empty-state-text">
                            {searchQuery
                                ? 'Prueba con otros términos de búsqueda.'
                                : activeTab === 'equipo'
                                    ? 'Agrega al personal técnico, administradores o visitadores.'
                                    : 'Otorga credenciales de acceso a las clínicas registradas para que usen el portal.'}
                        </p>
                        {!searchQuery && (
                            <button
                                className="btn btn-primary"
                                style={{ marginTop: '12px', background: activeTab === 'clientes' ? '#059669' : undefined, borderColor: activeTab === 'clientes' ? '#059669' : undefined }}
                                onClick={() => openNew(activeTab === 'clientes' ? 'cliente' : 'tecnico')}
                            >
                                <i className={`bi ${activeTab === 'clientes' ? 'bi-key-fill' : 'bi-plus-lg'}`}></i>{' '}
                                {activeTab === 'clientes' ? 'Otorgar Primera Cuenta' : 'Agregar Integrante'}
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="data-table-wrapper desktop-only" style={{ border: 'none' }}>
                            <table className="data-table">
                                <thead>
                                    {activeTab === 'equipo' ? (
                                        <tr>
                                            <th>Integrante</th>
                                            <th>Email de Acceso</th>
                                            <th>Rol Interno</th>
                                            <th>Módulos Asignados</th>
                                            <th>Estado</th>
                                            <th>Último Acceso</th>
                                            <th style={{ width: '60px' }}></th>
                                        </tr>
                                    ) : activeTab === 'clientes' ? (
                                        <tr>
                                            <th>Doctor / Responsable</th>
                                            <th>Clínica Vinculada</th>
                                            <th>Email de Acceso</th>
                                            <th>Teléfono</th>
                                            <th>Estado</th>
                                            <th>Último Acceso</th>
                                            <th style={{ width: '60px' }}></th>
                                        </tr>
                                    ) : (
                                        <tr>
                                            <th>Doctor / Solicitante</th>
                                            <th>Consultorio / Clínica</th>
                                            <th>Contacto</th>
                                            <th>Fecha Solicitud</th>
                                            <th>Estado</th>
                                            <th style={{ minWidth: '180px' }}>Acciones</th>
                                        </tr>
                                    )}
                                </thead>
                                <tbody>
                                    {filteredList.map(u => {
                                        const roleMeta = ROLE_CONFIG[u.tipo] || { label: u.tipo, icon: 'bi-person', badgeClass: 'badge-role badge-role-socio' };
                                        const activeModuleCount = u.tipo === 'admin'
                                            ? SYSTEM_MODULES.length
                                            : (Array.isArray(u.permisos_modulos) ? u.permisos_modulos.length : (DEFAULT_ROLE_MODULES[u.tipo] || []).length);

                                        return (
                                            <tr key={u.id}>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div style={{
                                                            width: '34px',
                                                            height: '34px',
                                                            borderRadius: '50%',
                                                            background: u.estado === 'pendiente' ? '#fef3c7' : (u.tipo === 'cliente' ? '#ecfdf5' : 'var(--color-bg-secondary)'),
                                                            color: u.estado === 'pendiente' ? '#d97706' : (u.tipo === 'cliente' ? '#059669' : 'var(--color-primary)'),
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontWeight: 'bold',
                                                            fontSize: '0.875rem'
                                                        }}>
                                                            {u.nombre ? u.nombre.charAt(0).toUpperCase() : 'U'}
                                                        </div>
                                                        <div>
                                                            <strong>{u.nombre}</strong>
                                                            {u.tipo === 'cliente' && u.telefono && activeTab !== 'pendientes' && (
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                                                    <i className="bi bi-telephone"></i> {u.telefono}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {activeTab === 'clientes' && (
                                                    <td>
                                                        <div>
                                                            <strong style={{ color: 'var(--color-primary)' }}>
                                                                {u.clinica_nombre || 'Sin clínica asignada'}
                                                            </strong>
                                                            {u.clinica_ruc && (
                                                                <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                                                                    RUC: {u.clinica_ruc}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}

                                                {activeTab === 'pendientes' && (
                                                    <td>
                                                        <div>
                                                            <strong style={{ color: 'var(--color-text-primary)' }}>
                                                                {u.clinica_nombre || 'Consultorio Dental'}
                                                            </strong>
                                                            {u.clinica_ruc && (
                                                                <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                                                                    RUC: {u.clinica_ruc}
                                                                </div>
                                                            )}
                                                            {u.clinica_direccion && (
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                                                    <i className="bi bi-geo-alt"></i> {u.clinica_direccion}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}

                                                {activeTab !== 'pendientes' && (
                                                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                                                        {u.email}
                                                    </td>
                                                )}

                                                {activeTab === 'pendientes' && (
                                                    <td>
                                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{u.email}</div>
                                                        {u.telefono && (
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                                <i className="bi bi-telephone"></i> {u.telefono}
                                                            </div>
                                                        )}
                                                    </td>
                                                )}

                                                {activeTab === 'equipo' && (
                                                    <td>
                                                        <span className={roleMeta.badgeClass}>
                                                            <i className={`bi ${roleMeta.icon}`}></i> {roleMeta.label}
                                                        </span>
                                                    </td>
                                                )}

                                                {activeTab === 'equipo' && (
                                                    <td>
                                                        <span style={{
                                                            fontSize: '0.75rem',
                                                            fontWeight: 600,
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            background: u.tipo === 'admin' ? '#e0e7ff' : '#f1f5f9',
                                                            color: u.tipo === 'admin' ? '#4338ca' : 'var(--color-text-secondary)'
                                                        }}>
                                                            {u.tipo === 'admin' ? 'Total (9 módulos)' : `${activeModuleCount} de ${SYSTEM_MODULES.length} módulos`}
                                                        </span>
                                                    </td>
                                                )}

                                                {activeTab === 'clientes' && (
                                                    <td>{u.telefono || '—'}</td>
                                                )}

                                                {activeTab === 'pendientes' && (
                                                    <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                                                        {u.created_at ? new Date(u.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Reciente'}
                                                    </td>
                                                )}

                                                <td>
                                                    <span className={`badge ${u.estado === 'activo' ? 'badge-terminado' : (u.estado === 'pendiente' ? 'badge-advertencia' : 'badge-enviado')}`}>
                                                        {u.estado === 'pendiente' ? 'Pendiente' : u.estado}
                                                    </span>
                                                </td>

                                                {activeTab !== 'pendientes' && (
                                                    <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                                                        {u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString('es-PE') : 'Nunca ingresó'}
                                                    </td>
                                                )}

                                                <td>
                                                    {activeTab === 'pendientes' ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <button
                                                                className="btn btn-sm btn-primary"
                                                                style={{ background: '#059669', borderColor: '#059669', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
                                                                onClick={() => handleActivarCliente(u.id, u.nombre, u.clinica_nombre)}
                                                                title="Aprobar solicitud y activar cuenta"
                                                            >
                                                                <i className="bi bi-check-circle-fill"></i> Aprobar
                                                            </button>
                                                            {u.telefono && (
                                                                <a
                                                                    className="btn btn-sm btn-ghost"
                                                                    style={{ color: '#25D366' }}
                                                                    href={`https://wa.me/51${u.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola Dr. ${u.nombre}, le escribimos de AFINIX Dental Lab sobre su solicitud de registro.`)}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    title="Contactar vía WhatsApp"
                                                                >
                                                                    <i className="bi bi-whatsapp"></i>
                                                                </a>
                                                            )}
                                                            <button
                                                                className="btn btn-sm btn-ghost text-danger"
                                                                onClick={() => handleInactivarCliente(u.id)}
                                                                title="Rechazar solicitud"
                                                            >
                                                                <i className="bi bi-x-circle"></i>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(u)} title="Editar cuenta">
                                                            <i className="bi bi-pencil"></i>
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile view */}
                        <div className="mobile-cards mobile-only">
                            {filteredList.map(u => {
                                const roleMeta = ROLE_CONFIG[u.tipo] || { label: u.tipo, icon: 'bi-person', badgeClass: 'badge-role badge-role-socio' };
                                const activeModuleCount = u.tipo === 'admin'
                                    ? SYSTEM_MODULES.length
                                    : (Array.isArray(u.permisos_modulos) ? u.permisos_modulos.length : (DEFAULT_ROLE_MODULES[u.tipo] || []).length);

                                if (activeTab === 'pendientes') {
                                    return (
                                        <div key={u.id} className="mobile-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                                            <div className="mobile-card-head">
                                                <div className="mobile-card-title">{u.nombre}</div>
                                                <span className="badge badge-advertencia">Pendiente</span>
                                            </div>
                                            <div className="mobile-card-grid">
                                                <div className="mobile-field">
                                                    <span className="mobile-field-label">Clínica</span>
                                                    <span className="mobile-field-value">{u.clinica_nombre || 'N/A'}</span>
                                                </div>
                                                <div className="mobile-field">
                                                    <span className="mobile-field-label">Email</span>
                                                    <span className="mobile-field-value">{u.email}</span>
                                                </div>
                                                <div className="mobile-field">
                                                    <span className="mobile-field-label">Teléfono</span>
                                                    <span className="mobile-field-value">{u.telefono || '—'}</span>
                                                </div>
                                                <div className="mobile-field">
                                                    <span className="mobile-field-label">Fecha</span>
                                                    <span className="mobile-field-value">
                                                        {u.created_at ? new Date(u.created_at).toLocaleDateString('es-PE') : 'Reciente'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="mobile-card-actions" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                                <button
                                                    className="btn btn-sm btn-primary"
                                                    style={{ flex: 1, background: '#059669', borderColor: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                                    onClick={() => handleActivarCliente(u.id, u.nombre, u.clinica_nombre)}
                                                >
                                                    <i className="bi bi-check-circle-fill"></i> Aprobar y Activar
                                                </button>
                                                {u.telefono && (
                                                    <a
                                                        className="btn btn-sm btn-secondary"
                                                        href={`https://wa.me/51${u.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola Dr. ${u.nombre}, le escribimos de AFINIX Dental Lab sobre su solicitud de registro.`)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <i className="bi bi-whatsapp" style={{ color: '#25D366' }}></i>
                                                    </a>
                                                )}
                                                <button
                                                    className="btn btn-sm btn-ghost text-danger"
                                                    onClick={() => handleInactivarCliente(u.id)}
                                                    title="Rechazar"
                                                >
                                                    <i className="bi bi-x-circle"></i>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={u.id} className="mobile-card">
                                        <div className="mobile-card-head">
                                            <div className="mobile-card-title">{u.nombre}</div>
                                            <span className={`badge ${u.estado === 'activo' ? 'badge-terminado' : 'badge-enviado'}`}>{u.estado}</span>
                                        </div>
                                        <div className="mobile-card-grid">
                                            {u.tipo === 'cliente' && (
                                                <div className="mobile-field">
                                                    <span className="mobile-field-label">Clínica</span>
                                                    <span className="mobile-field-value">{u.clinica_nombre || 'N/A'}</span>
                                                </div>
                                            )}
                                            <div className="mobile-field"><span className="mobile-field-label">Email</span><span className="mobile-field-value">{u.email}</span></div>
                                            <div className="mobile-field">
                                                <span className="mobile-field-label">Rol</span>
                                                <span className="mobile-field-value">
                                                    <span className={roleMeta.badgeClass}>
                                                        <i className={`bi ${roleMeta.icon}`}></i> {roleMeta.label}
                                                    </span>
                                                </span>
                                            </div>
                                            {u.tipo !== 'cliente' && (
                                                <div className="mobile-field">
                                                    <span className="mobile-field-label">Módulos</span>
                                                    <span className="mobile-field-value">{u.tipo === 'admin' ? 'Total (9)' : `${activeModuleCount} activos`}</span>
                                                </div>
                                            )}
                                            <div className="mobile-field"><span className="mobile-field-label">Último acceso</span><span className="mobile-field-value">{u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleDateString('es-PE') : 'Nunca'}</span></div>
                                        </div>
                                        <div className="mobile-card-actions">
                                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>
                                                Editar <i className="bi bi-pencil"></i>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Modal de Creación / Edición */}
            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title={
                    editing
                        ? (form.tipo === 'cliente' ? 'Editar Cuenta de Cliente' : 'Editar Integrante del Equipo')
                        : (form.tipo === 'cliente' ? 'Otorgar Cuenta de Portal a Clínica' : 'Nuevo Integrante del Equipo')
                }
                kicker={form.tipo === 'cliente' ? 'Portal de Clínicas • Accesos' : 'Equipo y Seguridad • Accesos'}
                subtitle={form.tipo === 'cliente' ? 'Credenciales de acceso para portal de clientes y clínicas' : 'Gestión de roles y permisos técnicos'}
                icon={form.tipo === 'cliente' ? 'bi-key-fill' : 'bi-people'}
                size="lg"
                footer={
                    <>
                        <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={save}
                            disabled={saving}
                            style={{
                                background: form.tipo === 'cliente' ? '#059669' : undefined,
                                borderColor: form.tipo === 'cliente' ? '#059669' : undefined
                            }}
                        >
                            {saving ? (
                                <><span className="spinner equipo-modal-footer-spinner" aria-hidden="true" /> Guardando...</>
                            ) : (
                                <><i className="bi bi-check-lg" aria-hidden="true" /> {editing ? 'Actualizar' : 'Otorgar / Crear'}</>
                            )}
                        </button>
                    </>
                }
            >
                <div className="equipo-modal-fields">
                    {/* Selector de Tipo (solo visible para admin si no está editando) */}
                    {isAdmin && !editing && (
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="form-label">Tipo de Cuenta a Crear</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <button
                                    type="button"
                                    className={`btn btn-sm ${form.tipo !== 'cliente' ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setForm({ ...form, tipo: 'tecnico' })}
                                    style={{ borderRadius: '8px', padding: '10px' }}
                                >
                                    <i className="bi bi-building"></i> Equipo Interno
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-sm ${form.tipo === 'cliente' ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setForm({ ...form, tipo: 'cliente', password: form.password || 'cliente123' })}
                                    style={{ borderRadius: '8px', padding: '10px', background: form.tipo === 'cliente' ? '#059669' : undefined, borderColor: form.tipo === 'cliente' ? '#059669' : undefined }}
                                >
                                    <i className="bi bi-key-fill"></i> Cuenta Cliente (Portal)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Si es cliente: Selección de Clínica */}
                    {form.tipo === 'cliente' && (
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="form-label" htmlFor="user-clinica">
                                Clínica Dental <span className="equipo-modal-required">*</span>
                            </label>
                            <CustomSelect
                                id="user-clinica"
                                value={form.clinica_id ? String(form.clinica_id) : ''}
                                onChange={handleClinicaChange}
                                placeholder="-- Seleccionar Clínica --"
                                disabled={editing && isVisitor}
                                searchable={clinicas.length > 5}
                                options={[
                                    { value: '', label: '-- Seleccionar Clínica --' },
                                    ...clinicas.map(c => ({
                                        value: String(c.id),
                                        label: `${c.nombre}${c.ruc ? ` (RUC: ${c.ruc})` : ''}${c.tiene_portal ? ' • [Ya tiene portal]' : ''}`,
                                        icon: 'bi-hospital'
                                    }))
                                ]}
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px', display: 'block' }}>
                                Al vincular la clínica, el usuario podrá ingresar al portal y ver únicamente sus órdenes de trabajo.
                            </span>
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label" htmlFor="user-nombre">
                            {form.tipo === 'cliente' ? 'Nombre del Doctor / Contacto' : 'Nombre Completo'}{' '}
                            <span className="equipo-modal-required">*</span>
                        </label>
                        <div className="form-input-box has-lead">
                            <i className="bi bi-person form-input-lead" aria-hidden="true" />
                            <input
                                id="user-nombre"
                                className="form-input"
                                value={form.nombre}
                                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                                placeholder={form.tipo === 'cliente' ? "Ej. Dr. Carlos Mendoza" : "Ej. Juan Pérez"}
                                autoComplete="name"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="user-email">
                            Email de Acceso (Usuario) <span className="equipo-modal-required">*</span>
                        </label>
                        <div className="form-input-box has-lead">
                            <i className="bi bi-envelope form-input-lead" aria-hidden="true" />
                            <input
                                id="user-email"
                                className="form-input"
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                placeholder="correo@ejemplo.pe"
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="user-tel">Teléfono / WhatsApp</label>
                        <div className="form-input-box has-lead">
                            <i className="bi bi-telephone form-input-lead" aria-hidden="true" />
                            <input
                                id="user-tel"
                                className="form-input"
                                value={form.telefono}
                                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                                placeholder="Ej. 987654321"
                                autoComplete="tel"
                            />
                        </div>
                    </div>

                    {/* Si es equipo: Rol y Permisos Granulares */}
                    {form.tipo !== 'cliente' && (
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="form-label" htmlFor="user-tipo">Rol Predeterminado</label>
                            <CustomSelect
                                id="user-tipo"
                                value={form.tipo}
                                onChange={(e) => handleRoleChange(e.target.value)}
                                disabled={isVisitor}
                                options={ROL_OPTIONS}
                                placeholder="Seleccionar rol..."
                            />
                        </div>
                    )}

                    {/* Módulos Granulares por Cuenta */}
                    {form.tipo !== 'cliente' && (
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <label className="form-label" style={{ marginBottom: 0, fontWeight: 600 }}>
                                    Permisos de Acceso a Módulos
                                </label>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                    {(Array.isArray(form.permisos_modulos) ? form.permisos_modulos : (DEFAULT_ROLE_MODULES[form.tipo] || [])).filter(m => SYSTEM_MODULES.some(sm => sm.id === m)).length} de {SYSTEM_MODULES.length} módulos habilitados
                                </span>
                            </div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                gap: '8px',
                                background: 'var(--color-bg-secondary, #f8fafc)',
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid var(--color-border, #e2e8f0)'
                            }}>
                                {SYSTEM_MODULES.map(mod => {
                                    const activeMods = Array.isArray(form.permisos_modulos)
                                        ? form.permisos_modulos
                                        : (DEFAULT_ROLE_MODULES[form.tipo] || []);
                                    const checked = activeMods.includes(mod.id);
                                    return (
                                        <label
                                            key={mod.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                cursor: 'pointer',
                                                fontSize: '0.8125rem',
                                                padding: '6px 8px',
                                                borderRadius: '6px',
                                                background: checked ? 'var(--color-bg-surface, #ffffff)' : 'transparent',
                                                boxShadow: checked ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => handleModuleToggle(mod.id)}
                                                style={{ cursor: 'pointer' }}
                                            />
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <i className={`bi ${mod.icon}`} style={{ color: checked ? 'var(--color-primary)' : 'inherit' }}></i>
                                                <span style={{ fontWeight: checked ? 600 : 400 }}>{mod.label}</span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '6px', display: 'block' }}>
                                Puedes personalizar los accesos marcando o desmarcando módulos para esta cuenta específica.
                            </span>
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label" htmlFor="user-estado">Estado de Cuenta</label>
                        <CustomSelect
                            id="user-estado"
                            value={form.estado}
                            onChange={(e) => setForm({ ...form, estado: e.target.value })}
                            options={ESTADO_OPTIONS}
                            placeholder="Seleccionar estado..."
                        />
                    </div>

                    <div className="form-group" style={{ gridColumn: form.tipo === 'cliente' ? 'span 2' : 'auto' }}>
                        <label className="form-label" htmlFor="user-password">
                            Contraseña {editing ? '(Dejar en blanco para conservar)' : <span className="equipo-modal-required">*</span>}
                        </label>
                        <div className="form-input-box has-lead">
                            <i className="bi bi-lock form-input-lead" aria-hidden="true" />
                            <input
                                id="user-password"
                                className="form-input"
                                type="text"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                placeholder={editing ? "Conservar contraseña actual" : "Ej. cliente123"}
                            />
                        </div>
                        {!editing && form.tipo === 'cliente' && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px', display: 'block' }}>
                                Sugerencia: <code>cliente123</code> (el doctor podrá cambiarla luego en su perfil).
                            </span>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Equipo;
