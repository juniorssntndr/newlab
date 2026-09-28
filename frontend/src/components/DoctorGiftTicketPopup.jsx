import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Modal from './Modal.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import { useNotifications } from '../state/NotificationContext.jsx';

export default function DoctorGiftTicketPopup() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const notificationsContext = useNotifications();

    const [activeTicketNotif, setActiveTicketNotif] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    // Solo aplica para usuarios tipo 'cliente' (Doctores / Clínicas con portal)
    useEffect(() => {
        if (!user || user.tipo !== 'cliente' || !notificationsContext) return;

        const unreadGift = notificationsContext.notifications.find(
            (n) => n.tipo === 'premio_ruleta' && !n.leida
        );

        if (unreadGift) {
            let parsedData = null;
            try {
                parsedData = typeof unreadGift.data === 'string' ? JSON.parse(unreadGift.data) : unreadGift.data;
            } catch {
                parsedData = null;
            }

            setActiveTicketNotif({
                ...unreadGift,
                ticketData: parsedData
            });
            setIsOpen(true);
        }
    }, [user, notificationsContext?.notifications]);

    if (!activeTicketNotif) return null;

    const ticket = activeTicketNotif.ticketData || {};
    const code = ticket.codigo;
    const title = ticket.premio_titulo || activeTicketNotif.titulo || 'Regalo Exclusivo';
    const drName = ticket.doctor_nombre || user?.nombre || 'Doctor(a)';
    const expiryDate = ticket.fecha_vencimiento
        ? new Date(ticket.fecha_vencimiento).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })
        : '30 días desde la emisión';

    const handleCopy = () => {
        if (code) {
            navigator.clipboard.writeText(code);
            setCopied(true);
            toast.success(`Código ${code} copiado al portapapeles`);
            setTimeout(() => setCopied(false), 3000);
        }
    };

    const handleClose = () => {
        setIsOpen(false);
        if (activeTicketNotif?.id && notificationsContext?.markAsRead) {
            notificationsContext.markAsRead(activeTicketNotif.id);
        }
    };

    const handleUseNow = () => {
        handleClose();
        if (code) {
            // Guardar código temporalmente para que NuevoPedido lo pueda autocompletar si lo desea
            sessionStorage.setItem('afinix_pending_coupon', code);
        }
        navigate('/pedidos/nuevo');
    };

    return (
        <Modal
            open={isOpen}
            onClose={handleClose}
            title="¡Tienes un Regalo Exclusivo!"
            subtitle="AFINIX DENTAL LAB S.A.C. premia tu preferencia"
            icon="bi-gift-fill"
            size="md"
        >
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.25rem',
                    fontSize: '2rem',
                    boxShadow: '0 8px 20px rgba(2, 132, 199, 0.35)'
                }}>
                    <i className="bi bi-stars"></i>
                </div>

                <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                    ¡Felicitaciones, Dr(a). {drName}!
                </h3>
                <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5 }}>
                    Durante nuestra visita o evento comercial fue premiado(a) con un beneficio especial de laboratorio:
                </p>

                {/* Ticket Visual Oficial */}
                <div style={{
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    border: '2px dashed #0284c7',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    position: 'relative',
                    marginBottom: '1.5rem',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.05)'
                }}>
                    <span style={{
                        display: 'inline-block',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: '#0284c7',
                        background: 'rgba(2, 132, 199, 0.1)',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        marginBottom: '0.5rem'
                    }}>
                        Ticket de Beneficio Oficial · AFINIX LAB
                    </span>

                    <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: '0.35rem 0' }}>
                        {title}
                    </div>

                    {code && (
                        <div style={{
                            margin: '1rem auto 0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.6rem'
                        }}>
                            <div style={{
                                background: '#0f172a',
                                color: '#38bdf8',
                                padding: '0.5rem 1.25rem',
                                borderRadius: '10px',
                                fontSize: '1.5rem',
                                fontWeight: 800,
                                letterSpacing: '0.15em',
                                fontFamily: 'monospace',
                                border: '1px solid #1e293b'
                            }}>
                                {code}
                            </div>
                            <button
                                type="button"
                                className="btn btn-outline-primary"
                                onClick={handleCopy}
                                style={{ padding: '0.5rem 0.85rem' }}
                                title="Copiar código"
                            >
                                <i className={`bi ${copied ? 'bi-check-lg text-success' : 'bi-clipboard'}`}></i>
                            </button>
                        </div>
                    )}

                    <div style={{
                        marginTop: '0.85rem',
                        paddingTop: '0.85rem',
                        borderTop: '1px dashed #cbd5e1',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.3rem',
                        fontSize: '0.78rem',
                        color: '#475569'
                    }}>
                        <div>
                            <strong>Condición:</strong> Válido para 1 solo trabajo / producto dental.
                        </div>
                        <div>
                            <strong>Vigencia:</strong> Hasta el {expiryDate} (1 mes de validez).
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleClose}
                    >
                        Cerrar y Usar Luego
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleUseNow}
                        style={{
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
                        }}
                    >
                        <i className="bi bi-cart-plus-fill"></i>
                        Crear Pedido y Aplicar Ahora
                    </button>
                </div>
            </div>
        </Modal>
    );
}
