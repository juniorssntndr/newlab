import React, { useEffect, useState } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { API_URL } from '../config.js';
import { isClientRole } from '../utils/accessControl.js';
import { useNotifications } from '../state/NotificationContext.jsx';

const Cuenta = () => {
    const { user, getHeaders, refreshUser, setUser } = useAuth();
    const {
        pushSupported,
        pushPermission,
        isPushSubscribed,
        isPushLoading,
        enablePushNotifications,
        disablePushNotifications,
        testPush,
        playNotificationTone
    } = useNotifications();
    const [form, setForm] = useState({ nombre: '', email: '', telefono: '', clinica_direccion: '' });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [passwordForm, setPasswordForm] = useState({ actual: '', nueva: '', confirmar: '' });
    const [savingPassword, setSavingPassword] = useState(false);
    const [showActual, setShowActual] = useState(false);
    const [showNueva, setShowNueva] = useState(false);
    const [showConfirmar, setShowConfirmar] = useState(false);

    const isClient = isClientRole(user);
    const hasClinic = user?.clinica_id != null && String(user.clinica_id) !== '';
    const canEditClinicAddress = isClient && hasClinic;
    const showClinicName = Boolean(user?.clinica_nombre) || canEditClinicAddress;

    const isProfileDirty = Boolean(
        user && (
            (form.nombre || '') !== (user.nombre || '') ||
            (form.email || '') !== (user.email || '') ||
            (form.telefono || '') !== (user.telefono || '') ||
            (canEditClinicAddress && (form.clinica_direccion || '') !== (user.clinica_direccion || ''))
        )
    );

    const initials = (user?.nombre || 'U')
        .split(' ')
        .filter(Boolean)
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    const passwordValidation = (() => {
        if (!passwordForm.nueva && !passwordForm.confirmar) return null;
        if (passwordForm.nueva && passwordForm.nueva.trim().length > 0 && passwordForm.nueva.trim().length < 6) {
            return { valid: false, message: 'La nueva contraseña debe tener mínimo 6 caracteres' };
        }
        if (passwordForm.confirmar && passwordForm.nueva !== passwordForm.confirmar) {
            return { valid: false, message: 'Las nuevas contraseñas no coinciden' };
        }
        if (passwordForm.nueva && passwordForm.confirmar && passwordForm.nueva === passwordForm.confirmar && passwordForm.nueva.length >= 6) {
            return { valid: true, message: 'Las contraseñas coinciden correctamente' };
        }
        return null;
    })();

    // Re-sincronizar perfil desde /me al entrar (recupera clinica_id / dirección si el estado local quedó incompleto).
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                await refreshUser();
            } catch {
                /* ignore: keep current session user */
            }
            if (cancelled) return;
        })();
        return () => {
            cancelled = true;
        };
    }, [refreshUser]);

    useEffect(() => {
        if (!user) return;
        setForm({
            nombre: user.nombre || '',
            email: user.email || '',
            telefono: user.telefono || '',
            clinica_direccion: user.clinica_direccion || '',
        });
    }, [user?.id, user?.clinica_direccion, user?.nombre, user?.email, user?.telefono]);

    const saveProfile = async () => {
        setSaving(true);
        setMessage(null);
        const previousUser = user;
        try {
            const payload = {
                nombre: form.nombre,
                email: form.email,
                telefono: form.telefono,
            };
            if (canEditClinicAddress) {
                payload.clinica_direccion = form.clinica_direccion;
            }
            const res = await fetch(`${API_URL}/auth/me`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al guardar');

            // Merge: nunca reemplazar el usuario entero (evita perder clinica_id/tipo si la respuesta viene incompleta).
            if (data?.id && typeof setUser === 'function') {
                setUser((prev) => ({ ...(prev || {}), ...data }));
            }
            setForm({
                nombre: data.nombre || form.nombre || '',
                email: data.email || form.email || '',
                telefono: data.telefono ?? form.telefono ?? '',
                clinica_direccion: data.clinica_direccion || form.clinica_direccion || '',
            });
            await refreshUser();
            setMessage({ type: 'success', text: 'Datos actualizados correctamente' });
        } catch (err) {
            if (previousUser && typeof setUser === 'function') {
                setUser(previousUser);
            }
            setMessage({ type: 'error', text: err.message });
        } finally {
            setSaving(false);
        }
    };

    const savePassword = async () => {
        if (!passwordForm.actual || !passwordForm.nueva) {
            setMessage({ type: 'error', text: 'Completa los campos de contraseña' });
            return;
        }
        if (passwordForm.nueva.trim().length < 6) {
            setMessage({ type: 'error', text: 'La nueva contraseña debe tener al menos 6 caracteres' });
            return;
        }
        if (passwordForm.nueva !== passwordForm.confirmar) {
            setMessage({ type: 'error', text: 'La nueva contraseña no coincide con la confirmación' });
            return;
        }
        setSavingPassword(true);
        setMessage(null);
        try {
            const res = await fetch(`${API_URL}/auth/password`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({
                    current_password: passwordForm.actual,
                    new_password: passwordForm.nueva
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al actualizar contraseña');
            setMessage({ type: 'success', text: 'Contraseña actualizada correctamente' });
            setPasswordForm({ actual: '', nueva: '', confirmar: '' });
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setSavingPassword(false);
        }
    };

    return (
        <div className="animate-fade-in page-container">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>
                        <i className="bi bi-person-circle text-primary" aria-hidden="true"></i> Mi Cuenta
                    </h1>
                    <p>Gestiona tus datos personales y seguridad</p>
                </div>
            </div>

            {message && (
                <div className={`alert ${message.type === 'error' ? 'alert-error' : 'alert-success'}`}>
                    <i className={`bi ${message.type === 'error' ? 'bi-exclamation-circle' : 'bi-check-circle'}`}></i>
                    {message.text}
                </div>
            )}

            <div className="cuenta-grid">
                <div className="card">
                    {/* Header lado a lado en desktop y mobile (nunca apilado ni centrado) */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 'var(--space-4)',
                        gap: 'var(--space-2)'
                    }}>
                        <h3 className="card-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Perfil</h3>
                        {user?.tipo && (
                            <span
                                className={`badge-role badge-role-${user.tipo}`}
                                style={{
                                    fontSize: '0.75rem',
                                    padding: '0.25rem 0.6rem',
                                    borderRadius: '6px',
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    flexShrink: 0
                                }}
                            >
                                <i className={
                                    user.tipo === 'admin' ? 'bi bi-shield-shaded' :
                                    user.tipo === 'socio' ? 'bi bi-briefcase-fill' :
                                    user.tipo === 'tecnico' ? 'bi bi-gear-fill' :
                                    user.tipo === 'operador' ? 'bi bi-wallet2' :
                                    user.tipo === 'visitador' ? 'bi bi-geo-alt-fill' : 'bi bi-building-check'
                                }></i>
                                {
                                    user.tipo === 'admin' ? 'Administrador' :
                                    user.tipo === 'socio' ? 'Socio / Gerencia' :
                                    user.tipo === 'tecnico' ? 'Protesista / Técnico' :
                                    user.tipo === 'operador' ? 'Recepcionista / Caja' :
                                    user.tipo === 'visitador' ? 'Visitador Comercial' : 'Cliente (Portal)'
                                }
                            </span>
                        )}
                    </div>

                    {/* Resumen visual de identidad con Avatar */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-md, 8px)',
                        background: 'var(--color-bg-secondary, #f8fafc)',
                        border: '1px solid var(--color-border)',
                        marginBottom: 'var(--space-4)'
                    }}>
                        <div style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--color-primary, #0284c7), var(--color-accent, #38bdf8))',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '1.1rem',
                            flexShrink: 0,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                            {initials}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {user?.nombre || 'Usuario'}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {user?.email || 'Sin correo registrado'}
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="cuenta-nombre">Nombre</label>
                        <input id="cuenta-nombre" className="form-input" value={form.nombre}
                            placeholder="Nombre y apellido"
                            onChange={e => setForm({ ...form, nombre: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="cuenta-email">Email</label>
                        <input id="cuenta-email" className="form-input" type="email" value={form.email}
                            placeholder="correo@ejemplo.com"
                            onChange={e => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="cuenta-telefono">Teléfono</label>
                        <input id="cuenta-telefono" className="form-input" value={form.telefono}
                            placeholder="Ej. 987654321"
                            onChange={e => setForm({ ...form, telefono: e.target.value })} />
                    </div>
                    {showClinicName && (
                        <div className="form-group">
                            <label className="form-label" htmlFor="cuenta-clinica">Clínica</label>
                            <input id="cuenta-clinica" className="form-input" value={user?.clinica_nombre || ''} disabled />
                        </div>
                    )}
                    {canEditClinicAddress && (
                        <div className="form-group">
                            <label className="form-label" htmlFor="cuenta-clinica-direccion">
                                Dirección del consultorio
                            </label>
                            <input
                                id="cuenta-clinica-direccion"
                                className="form-input"
                                value={form.clinica_direccion}
                                onChange={e => setForm({ ...form, clinica_direccion: e.target.value })}
                                placeholder="Calle, distrito, ciudad"
                                aria-describedby="cuenta-clinica-direccion-help"
                            />
                            <span id="cuenta-clinica-direccion-help" className="form-help">
                                Se usa para recolección en consultorio.
                            </span>
                        </div>
                    )}
                    <button
                        className="btn btn-primary"
                        onClick={saveProfile}
                        disabled={saving || !isProfileDirty}
                        style={{
                            opacity: (!isProfileDirty && !saving) ? 0.65 : 1,
                            transition: 'opacity 0.2s ease'
                        }}
                    >
                        {saving ? 'Guardando...' : isProfileDirty ? 'Guardar cambios' : 'Sin cambios pendientes'}
                    </button>
                </div>

                <div className="card">
                    <div style={{
                        display: 'flex',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 'var(--space-4)'
                    }}>
                        <h3 className="card-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Seguridad</h3>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <i className="bi bi-shield-lock"></i> Clave segura
                        </span>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="cuenta-pwd-actual">Contraseña actual</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                id="cuenta-pwd-actual"
                                className="form-input"
                                type={showActual ? "text" : "password"}
                                autoComplete="current-password"
                                value={passwordForm.actual}
                                onChange={e => setPasswordForm({ ...passwordForm, actual: e.target.value })}
                                style={{ paddingRight: '2.5rem' }}
                                placeholder="Tu contraseña actual"
                            />
                            <button
                                type="button"
                                onClick={() => setShowActual(!showActual)}
                                style={{
                                    position: 'absolute',
                                    right: '0.75rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--color-text-secondary)',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '1rem'
                                }}
                                aria-label={showActual ? "Ocultar contraseña" : "Ver contraseña"}
                            >
                                <i className={`bi ${showActual ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="cuenta-pwd-nueva">Nueva contraseña (mínimo 6 caracteres)</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                id="cuenta-pwd-nueva"
                                className="form-input"
                                type={showNueva ? "text" : "password"}
                                autoComplete="new-password"
                                value={passwordForm.nueva}
                                onChange={e => setPasswordForm({ ...passwordForm, nueva: e.target.value })}
                                style={{ paddingRight: '2.5rem' }}
                                placeholder="Mínimo 6 caracteres"
                            />
                            <button
                                type="button"
                                onClick={() => setShowNueva(!showNueva)}
                                style={{
                                    position: 'absolute',
                                    right: '0.75rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--color-text-secondary)',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '1rem'
                                }}
                                aria-label={showNueva ? "Ocultar contraseña" : "Ver contraseña"}
                            >
                                <i className={`bi ${showNueva ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="cuenta-pwd-confirmar">Confirmar nueva contraseña</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                id="cuenta-pwd-confirmar"
                                className="form-input"
                                type={showConfirmar ? "text" : "password"}
                                autoComplete="new-password"
                                value={passwordForm.confirmar}
                                onChange={e => setPasswordForm({ ...passwordForm, confirmar: e.target.value })}
                                style={{ paddingRight: '2.5rem' }}
                                placeholder="Repite la nueva contraseña"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmar(!showConfirmar)}
                                style={{
                                    position: 'absolute',
                                    right: '0.75rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--color-text-secondary)',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '1rem'
                                }}
                                aria-label={showConfirmar ? "Ocultar contraseña" : "Ver contraseña"}
                            >
                                <i className={`bi ${showConfirmar ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                            </button>
                        </div>
                    </div>

                    {/* Feedback en tiempo real sobre coincidencia y fortaleza */}
                    {passwordValidation && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.8125rem',
                            marginBottom: 'var(--space-3)',
                            color: passwordValidation.valid ? '#059669' : '#dc2626'
                        }}>
                            <i className={`bi ${passwordValidation.valid ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}`}></i>
                            <span>{passwordValidation.message}</span>
                        </div>
                    )}

                    <button
                        className="btn btn-primary"
                        onClick={savePassword}
                        disabled={savingPassword || (passwordValidation && !passwordValidation.valid)}
                    >
                        {savingPassword ? 'Actualizando...' : 'Actualizar contraseña'}
                    </button>
                </div>

                <div className="card col-span-2">
                    <div className="card-header">
                        <h3 className="card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                            <i className="bi bi-bell-fill text-primary" aria-hidden="true" />
                            Notificaciones y Alertas en este Dispositivo
                        </h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                            Recibe avisos inmediatos en este navegador cuando tu diseño 3D esté listo para aprobación, cuando un trabajo ingrese a producción o cuando tu pedido esté en camino.
                        </p>

                        <div className="cuenta-push-row">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '50%',
                                    background: isPushSubscribed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                                    color: isPushSubscribed ? '#10B981' : '#EF4444',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.1rem'
                                }}>
                                    <i className={`bi ${isPushSubscribed ? 'bi-check-circle-fill' : 'bi-bell-slash'}`} aria-hidden="true" />
                                </div>
                                <div>
                                    <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--color-text)' }}>
                                        {isPushSubscribed
                                            ? 'Alertas web activas'
                                            : pushPermission === 'denied'
                                                ? 'Permiso bloqueado en el navegador'
                                                : 'Notificaciones no activadas'}
                                    </strong>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                        {isPushSubscribed
                                            ? 'Este equipo recibirá avisos instantáneos de tus órdenes de trabajo.'
                                            : pushPermission === 'denied'
                                                ? 'Debes permitir notificaciones desde el icono de candado en la barra de direcciones.'
                                                : 'Haz clic en activar para recibir seguimiento en tiempo real.'}
                                    </span>
                                </div>
                            </div>

                            <div className="cuenta-push-actions">
                                {isPushSubscribed ? (
                                    <>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={testPush}
                                            title="Enviar notificación push de prueba con sonido"
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                                        >
                                            <i className="bi bi-volume-up" aria-hidden="true" />
                                            Probar sonido
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm text-danger"
                                            onClick={disablePushNotifications}
                                            disabled={isPushLoading}
                                        >
                                            Desactivar
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        onClick={enablePushNotifications}
                                        disabled={isPushLoading || pushPermission === 'denied' || !pushSupported}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                                    >
                                        <i className="bi bi-bell-fill" aria-hidden="true" />
                                        {isPushLoading ? 'Activando...' : 'Activar en este equipo'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Cuenta;
