import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import CustomSelect from './CustomSelect.jsx';
import { apiClient } from '../services/http/apiClient.js';
import { useAuth } from '../state/AuthContext.jsx';

export default function WheelOfFortune({ onGiroCompletado }) {
    const { getHeaders } = useAuth();
    const canvasRef = useRef(null);

    // Estado del formulario
    const [clinicas, setClinicas] = useState([]);
    const [premios, setPremios] = useState([]);
    const [loadingPremios, setLoadingPremios] = useState(true);
    const [form, setForm] = useState({
        doctor_nombre: '',
        clinica_id: '',
        doctor_telefono: '',
        evento_nombre: 'Visita Comercial'
    });

    // Estado del giro
    const [isSpinning, setIsSpinning] = useState(false);
    const [spinResult, setSpinResult] = useState(null);
    const [showResultModal, setShowResultModal] = useState(false);
    const currentAngleRef = useRef(0);
    const animationFrameRef = useRef(null);

    // Cargar clínicas y premios
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [clinicasRes, premiosRes] = await Promise.all([
                    apiClient.get('/api/clinicas', { headers: getHeaders() }).catch(() => []),
                    apiClient.get('/api/marketing/ruleta/premios', { headers: getHeaders() }).catch(() => ({ data: [] }))
                ]);

                const clinicsList = Array.isArray(clinicasRes) ? clinicasRes : (clinicasRes?.data || []);
                setClinicas(clinicsList);

                const rawPremios = premiosRes?.data !== undefined ? premiosRes.data : premiosRes;
                const prizeList = Array.isArray(rawPremios) ? rawPremios : [];
                setPremios(prizeList);
            } catch (err) {
                console.error('Error loading wheel config:', err);
                toast.error('Error al cargar configuración de la ruleta');
            } finally {
                setLoadingPremios(false);
            }
        };

        loadInitialData();
    }, []);

    // Dibujar ruleta en el Canvas
    const drawWheel = (angle = 0) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = width / 2 - 14;

        ctx.clearRect(0, 0, width, height);

        if (!premios.length) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Sin premios configurados', centerX, centerY);
            return;
        }

        const numSegments = premios.length;
        const arc = (2 * Math.PI) / numSegments;

        // Dibujar borde externo dorado/metálico
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 8, 0, 2 * Math.PI);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#f59e0b';
        ctx.stroke();
        ctx.restore();

        // Dibujar segmentos
        premios.forEach((premio, i) => {
            const startAngle = angle + i * arc;
            const endAngle = startAngle + arc;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = premio.color_hex || '#0284c7';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();

            // Texto en segmento
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(startAngle + arc / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = premio.texto_color || '#ffffff';
            ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 3;
            ctx.fillText(premio.titulo, radius - 20, 5);
            ctx.restore();

            ctx.restore();
        });

        // Pines exteriores de la ruleta
        for (let i = 0; i < numSegments * 2; i++) {
            const pinAngle = angle + (i * Math.PI) / numSegments;
            const pinX = centerX + Math.cos(pinAngle) * (radius + 2);
            const pinY = centerY + Math.sin(pinAngle) * (radius + 2);

            ctx.beginPath();
            ctx.arc(pinX, pinY, 3.5, 0, 2 * Math.PI);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.strokeStyle = '#cbd5e1';
            ctx.stroke();
        }

        // Centro de la ruleta (buje)
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, 28, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#0284c7';
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('AFINIX', centerX, centerY - 4);
        ctx.font = '9px system-ui, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText('LAB', centerX, centerY + 8);
        ctx.restore();
    };

    // Redibujar al cambiar premios o ángulo
    useEffect(() => {
        if (!loadingPremios) {
            drawWheel(currentAngleRef.current);
        }
    }, [premios, loadingPremios]);

    // Ejecutar el giro
    const handleSpin = async () => {
        if (isSpinning) return;
        if (!form.doctor_nombre.trim()) {
            toast.error('Por favor, ingresa el nombre del doctor participante');
            return;
        }

        setIsSpinning(true);
        setSpinResult(null);

        try {
            // 1. Llamar al backend para determinar el resultado
            const response = await apiClient.post('/api/marketing/ruleta/girar', form, {
                headers: getHeaders()
            });

            const resPayload = response?.data || response;
            const { premio, codigo_descuento, giro } = resPayload;

            // 2. Calcular ángulo de destino para que la flecha (apuntando hacia abajo en el tope) coincida
            const prizeIndex = premios.findIndex((p) => p.id === premio.id);
            const numSegments = premios.length;
            const segmentArc = (2 * Math.PI) / numSegments;

            // En un canvas estándar: el tope superior es 3π/2 (270 grados).
            // Para que el segmento i quede en el tope superior:
            // (startAngle + arc / 2) mod 2PI = 3PI/2  => angle = 3PI/2 - (i + 0.5) * segmentArc
            const targetSegmentCenter = 1.5 * Math.PI - (prizeIndex + 0.5) * segmentArc;
            const extraSpins = 5 * (2 * Math.PI); // 5 vueltas completas para emoción
            const currentMod = currentAngleRef.current % (2 * Math.PI);
            const totalDistance = extraSpins + (targetSegmentCenter - currentMod + 2 * Math.PI) % (2 * Math.PI);
            const targetAngle = currentAngleRef.current + totalDistance;

            const startTime = performance.now();
            const duration = 4500; // 4.5 segundos
            const startAngle = currentAngleRef.current;

            // Curva de desaceleración Ease-Out Cubic
            const animate = (now) => {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                // easeOutQuart: 1 - pow(1 - x, 4)
                const ease = 1 - Math.pow(1 - progress, 4);
                const currentAngle = startAngle + (targetAngle - startAngle) * ease;
                currentAngleRef.current = currentAngle;
                drawWheel(currentAngle);

                if (progress < 1) {
                    animationFrameRef.current = requestAnimationFrame(animate);
                } else {
                    setIsSpinning(false);
                    setSpinResult({ premio, codigo_descuento, giro });
                    setShowResultModal(true);
                    if (onGiroCompletado) onGiroCompletado();
                }
            };

            animationFrameRef.current = requestAnimationFrame(animate);
        } catch (err) {
            setIsSpinning(false);
            const msg = err.response?.data?.error || 'Error al conectar con el servidor de la ruleta';
            toast.error(msg);
        }
    };

    const copyCode = (code) => {
        navigator.clipboard.writeText(code);
        toast.success(`Código ${code} copiado al portapapeles`);
    };

    const getWhatsAppUrl = () => {
        if (!spinResult || !form.doctor_telefono) return '#';
        const cleanPhone = form.doctor_telefono.replace(/\D/g, '');
        const dr = form.doctor_nombre || 'Doctor(a)';
        const premio = spinResult.premio.titulo;
        const code = spinResult.codigo_descuento;

        let msg = `¡Hola Dr(a). ${dr}! Fue un placer visitarle de parte de AFINIX DENTAL LAB S.A.C.\n\nEn nuestra Ruleta de Beneficios ha ganado: *${premio}*.`;
        if (code) {
            msg += `\n\nSu código de descuento exclusivo es: *${code}*.\nPuede canjearlo ingresándolo al momento de realizar su orden en el portal o indicárselo a su asesor de confianza.`;
        }
        msg += `\n\n¡Esperamos seguir construyendo sonrisas junto a su clínica!`;

        return `https://wa.me/51${cleanPhone}?text=${encodeURIComponent(msg)}`;
    };

    const clinicOptions = [
        { value: '', label: 'Seleccionar clínica (opcional)' },
        ...clinicas.map((c) => ({ value: String(c.id), label: `${c.nombre} (${c.ciudad || 'Arequipa'})` }))
    ];

    return (
        <div className="card dashboard-ops-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i className="bi bi-disc text-primary" aria-hidden="true"></i>
                        Ruleta de Beneficios para Visitas y Eventos
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary, #64748b)' }}>
                        Herramienta comercial para activar en visitas a clínicas, congresos y reuniones de fidelización.
                    </p>
                </div>
                <span className="badge" style={{ background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7', border: '1px solid #0284c7' }}>
                    <i className="bi bi-shield-lock-fill" style={{ marginRight: '4px' }}></i> Exclusivo Equipo Afinix
                </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'center' }}>
                {/* Formulario de registro previo al giro */}
                <div style={{ background: 'var(--color-bg-secondary, #f8fafc)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--color-border, #e2e8f0)' }}>
                    <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-primary, #0284c7)' }}>
                        <i className="bi bi-person-badge" style={{ marginRight: '0.4rem' }}></i>
                        Datos del Doctor Participante
                    </h4>

                    <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                        <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 500 }}>
                            Nombre del Doctor(a) <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Ej. Dr. Carlos Valdivia"
                            value={form.doctor_nombre}
                            onChange={(e) => setForm((prev) => ({ ...prev, doctor_nombre: e.target.value }))}
                            disabled={isSpinning}
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                        <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 500 }}>
                            Clínica o Consultorio
                        </label>
                        <CustomSelect
                            options={clinicOptions}
                            value={form.clinica_id ? String(form.clinica_id) : ''}
                            onChange={(_, val) => setForm((prev) => ({ ...prev, clinica_id: val }))}
                            placeholder="Buscar clínica..."
                            searchable
                            disabled={isSpinning}
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                        <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 500 }}>
                            Teléfono / WhatsApp (para envío automático)
                        </label>
                        <input
                            type="tel"
                            className="form-input"
                            placeholder="Ej. 958123456"
                            value={form.doctor_telefono}
                            onChange={(e) => setForm((prev) => ({ ...prev, doctor_telefono: e.target.value }))}
                            disabled={isSpinning}
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                        <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 500 }}>
                            Motivo o Evento
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Ej. Visita Clínica San Juan / Expo Odonto"
                            value={form.evento_nombre}
                            onChange={(e) => setForm((prev) => ({ ...prev, evento_nombre: e.target.value }))}
                            disabled={isSpinning}
                        />
                    </div>

                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleSpin}
                        disabled={isSpinning || loadingPremios || !form.doctor_nombre.trim()}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            fontWeight: 600,
                            fontSize: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
                        }}
                    >
                        {isSpinning ? (
                            <>
                                <span className="spinner-border spinner-border-sm" role="status"></span>
                                ¡Girando la ruleta!
                            </>
                        ) : (
                            <>
                                <i className="bi bi-play-circle-fill"></i>
                                ¡Girar la Ruleta Ahora!
                            </>
                        )}
                    </button>
                </div>

                {/* Canvas de la Ruleta y Puntero */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'relative', width: '340px', height: '340px' }}>
                        {/* Puntero Superior */}
                        <div
                            style={{
                                position: 'absolute',
                                top: '-10px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: 0,
                                height: 0,
                                borderLeft: '14px solid transparent',
                                borderRight: '14px solid transparent',
                                borderTop: '28px solid #ef4444',
                                zIndex: 10,
                                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))'
                            }}
                        />

                        {/* Canvas */}
                        <canvas
                            ref={canvasRef}
                            width={340}
                            height={340}
                            style={{
                                width: '100%',
                                height: '100%',
                                borderRadius: '50%',
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)'
                            }}
                        />
                    </div>

                    <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--color-text-secondary, #64748b)' }}>
                        Probabilidad auditada y registrada en el sistema de fidelización de <strong>AFINIX DENTAL LAB</strong>.
                    </p>
                </div>
            </div>

            {/* Modal de Resultado y Entrega de Cupón */}
            {showResultModal && spinResult && (
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
                    backdropFilter: 'blur(4px)',
                    padding: '1rem'
                }}>
                    <div className="card" style={{
                        maxWidth: '450px',
                        width: '100%',
                        padding: '1.75rem',
                        textAlign: 'center',
                        borderRadius: '16px',
                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
                        animation: 'fadeIn 0.25s ease'
                    }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            backgroundColor: spinResult.premio.tipo_premio === 'sin_premio' ? '#f1f5f9' : 'rgba(16, 185, 129, 0.15)',
                            color: spinResult.premio.tipo_premio === 'sin_premio' ? '#64748b' : '#10b981',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1rem',
                            fontSize: '2rem'
                        }}>
                            <i className={spinResult.premio.tipo_premio === 'sin_premio' ? 'bi bi-emoji-neutral' : 'bi bi-gift-fill'}></i>
                        </div>

                        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 700 }}>
                            {spinResult.premio.tipo_premio === 'sin_premio' ? '¡Sigue Intentando!' : '¡Felicitaciones Dr(a)!'}
                        </h3>

                        <p style={{ color: 'var(--color-text-secondary, #64748b)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                            Para: <strong>{form.doctor_nombre}</strong>
                        </p>

                        <div style={{
                            background: 'var(--color-bg-secondary, #f8fafc)',
                            border: '2px dashed var(--color-primary, #0284c7)',
                            borderRadius: '12px',
                            padding: '1.25rem',
                            marginBottom: '1.5rem'
                        }}>
                            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
                                Premio Obtenido
                            </span>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary, #0284c7)', margin: '0.25rem 0' }}>
                                {spinResult.premio.titulo}
                            </div>
                            <p style={{ fontSize: '0.82rem', margin: 0, color: '#475569' }}>
                                {spinResult.premio.descripcion}
                            </p>

                            {spinResult.codigo_descuento && (
                                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>CÓDIGO EXCLUSIVO GENERADO:</span>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        marginTop: '0.4rem'
                                    }}>
                                        <code style={{
                                            fontSize: '1.2rem',
                                            fontWeight: 700,
                                            background: '#0f172a',
                                            color: '#38bdf8',
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '6px'
                                        }}>
                                            {spinResult.codigo_descuento}
                                        </code>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-secondary"
                                            onClick={() => copyCode(spinResult.codigo_descuento)}
                                            title="Copiar código"
                                        >
                                            <i className="bi bi-clipboard"></i>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Botones de acción del Modal */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {form.doctor_telefono && spinResult.codigo_descuento && (
                                <a
                                    href={getWhatsAppUrl()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-success"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        backgroundColor: '#25D366',
                                        borderColor: '#25D366',
                                        color: '#ffffff',
                                        fontWeight: 600
                                    }}
                                >
                                    <i className="bi bi-whatsapp"></i>
                                    Enviar Cupón por WhatsApp al Doctor
                                </a>
                            )}

                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => {
                                    setShowResultModal(false);
                                    setForm((prev) => ({ ...prev, doctor_nombre: '', doctor_telefono: '' }));
                                }}
                            >
                                Registrar Siguiente Participante
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
