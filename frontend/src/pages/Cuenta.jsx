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
    const isClient = isClientRole(user);
    const hasClinic = user?.clinica_id != null && String(user.clinica_id) !== '';
    const canEditClinicAddress = isClient && hasClinic;
    const showClinicName = Boolean(user?.clinica_nombre) || canEditClinicAddress;

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
            setMessage({ type: 'error', text: 'Completa los campos de contrasena' });
            return;
        }
        if (passwordForm.nueva !== passwordForm.confirmar) {
            setMessage({ type: 'error', text: 'La nueva contrasena no coincide' });
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
            if (!res.ok) throw new Error(data.error || 'Error al actualizar contrasena');
            setMessage({ type: 'success', text: 'Contrasena actualizada' });
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
                    <div className="card-header"><h3 className="card-title">Perfil</h3></div>
                    <div className="form-group">
                        <label className="form-label">Nombre</label>
                        <input className="form-input" value={form.nombre}
                            onChange={e => setForm({ ...form, nombre: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input className="form-input" type="email" value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Telefono</label>
                        <input className="form-input" value={form.telefono}
                            onChange={e => setForm({ ...form, telefono: e.target.value })} />
                    </div>
                    {showClinicName && (
                        <div className="form-group">
                            <label className="form-label">Clinica</label>
                            <input className="form-input" value={user?.clinica_nombre || ''} disabled />
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
                    <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
                        {saving ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                </div>

                <div className="card">
                    <div className="card-header"><h3 className="card-title">Seguridad</h3></div>
                    <div className="form-group">
                        <label className="form-label">Contrasena actual</label>
                        <input className="form-input" type="password" value={passwordForm.actual}
                            onChange={e => setPasswordForm({ ...passwordForm, actual: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Nueva contrasena</label>
                        <input className="form-input" type="password" value={passwordForm.nueva}
                            onChange={e => setPasswordForm({ ...passwordForm, nueva: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Confirmar nueva contrasena</label>
                        <input className="form-input" type="password" value={passwordForm.confirmar}
                            onChange={e => setPasswordForm({ ...passwordForm, confirmar: e.target.value })} />
                    </div>
                    <button className="btn btn-accent" onClick={savePassword} disabled={savingPassword}>
                        {savingPassword ? 'Actualizando...' : 'Actualizar contrasena'}
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
