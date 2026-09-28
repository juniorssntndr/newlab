import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import CustomSelect from './CustomSelect.jsx';
import Modal from './Modal.jsx';
import { apiClient } from '../services/http/apiClient.js';
import { useAuth } from '../state/AuthContext.jsx';

export default function WheelOfFortune({ onGiroCompletado, isKiosk = false }) {
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
    const [copiedCode, setCopiedCode] = useState(false);
    const currentAngleRef = useRef(0);
    const animationFrameRef = useRef(null);
    const lastTickSegmentRef = useRef(-1);

    // Sonido sintético de click/tick de ruleta
    const playTickSound = () => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.04);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.05);
            setTimeout(() => ctx.close().catch(() => {}), 100);
        } catch {
            // Silencioso si no hay soporte de audio
        }
    };

    // Sonido festivo de victoria
    const playWinSound = () => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
                gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.12);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.35);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + idx * 0.12);
                osc.stop(ctx.currentTime + idx * 0.12 + 0.38);
            });
            setTimeout(() => ctx.close().catch(() => {}), 1200);
        } catch {
            // Silencioso
        }
    };

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
        const radius = width / 2 - 16;

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

        // Detección de tick sonoro cuando un pin pasa por el puntero superior (1.5 * PI)
        const currentNormalized = (angle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        const activeSegment = Math.floor(((1.5 * Math.PI - currentNormalized + 2 * Math.PI) % (2 * Math.PI)) / arc);
        if (activeSegment !== lastTickSegmentRef.current && isSpinning) {
            lastTickSegmentRef.current = activeSegment;
            playTickSound();
        }

        // Borde exterior dorado / premium
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 10, 0, 2 * Math.PI);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#f59e0b';
        ctx.stroke();
        ctx.restore();

        // Dibujar sectores
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

            // Texto en el sector
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(startAngle + arc / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = premio.texto_color || '#ffffff';
            ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 4;
            
            // Si el texto es largo, truncar elegantemente
            const displayTitle = premio.titulo.length > 20 ? `${premio.titulo.substring(0, 19)}…` : premio.titulo;
            ctx.fillText(displayTitle, radius - 22, 5);
            ctx.restore();

            ctx.restore();
        });

        // Pines exteriores de la ruleta (estilo Interacty / rueda de feria)
        for (let i = 0; i < numSegments * 2; i++) {
            const pinAngle = angle + (i * Math.PI) / numSegments;
            const pinX = centerX + Math.cos(pinAngle) * (radius + 2);
            const pinY = centerY + Math.sin(pinAngle) * (radius + 2);

            ctx.beginPath();
            ctx.arc(pinX, pinY, 4, 0, 2 * Math.PI);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#cbd5e1';
            ctx.stroke();
        }

        // Centro de la ruleta (buje con sello oficial AFINIX LAB)
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
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
        ctx.font = '8px system-ui, sans-serif';
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
            const { premio, codigo_descuento, giro, ticket } = resPayload;

            // 2. Calcular ángulo de destino para que la flecha superior (3π/2) coincida con el segmento ganador
            const prizeIndex = premios.findIndex((p) => p.id === premio.id);
            const numSegments = premios.length;
            const segmentArc = (2 * Math.PI) / numSegments;

            // (startAngle + arc / 2) mod 2PI = 3PI/2 => angle = 3PI/2 - (prizeIndex + 0.5) * segmentArc
            const targetSegmentCenter = 1.5 * Math.PI - (prizeIndex + 0.5) * segmentArc;
            const extraSpins = 6 * (2 * Math.PI); // 6 vueltas completas
            const currentMod = currentAngleRef.current % (2 * Math.PI);
            const totalDistance = extraSpins + (targetSegmentCenter - currentMod + 2 * Math.PI) % (2 * Math.PI);
            const targetAngle = currentAngleRef.current + totalDistance;

            const startTime = performance.now();
            const duration = 5000; // 5 segundos
            const startAngle = currentAngleRef.current;

            // Curva de desaceleración suave Quartic
            const animate = (now) => {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const ease = 1 - Math.pow(1 - progress, 4);
                const currentAngle = startAngle + (targetAngle - startAngle) * ease;
                currentAngleRef.current = currentAngle;
                drawWheel(currentAngle);

                if (progress < 1) {
                    animationFrameRef.current = requestAnimationFrame(animate);
                } else {
                    setIsSpinning(false);
                    setSpinResult({ premio, codigo_descuento, giro, ticket });
                    setShowResultModal(true);
                    playWinSound();
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
        if (!code) return;
        navigator.clipboard.writeText(code);
        setCopiedCode(true);
        toast.success(`Código de 6 dígitos "${code}" copiado al portapapeles`);
        setTimeout(() => setCopiedCode(false), 3000);
    };

    const getWhatsAppUrl = () => {
        if (!spinResult || !form.doctor_telefono) return '#';
        const cleanPhone = form.doctor_telefono.replace(/\D/g, '');
        const dr = form.doctor_nombre || 'Doctor(a)';
        const premio = spinResult.premio.titulo;
        const code = spinResult.codigo_descuento;

        let msg = `¡Hola Dr(a). ${dr}! Fue un placer visitarle de parte de *AFINIX DENTAL LAB S.A.C.*\n\nEn nuestra Ruleta de Beneficios ha ganado: *${premio}*.`;
        if (code) {
            msg += `\n\n🎟️ *Su código exclusivo de 6 dígitos es:* \`${code}\`\n\n📌 *Condiciones:* Válido por 1 mes (30 días) para 1 solo trabajo/producto dental.\nPuede canjearlo al registrar su pedido en el portal o indicárselo a su asesor comercial.`;
        }
        msg += `\n\n¡Esperamos seguir fabricando sonrisas con la máxima precisión para sus pacientes!`;

        return `https://wa.me/51${cleanPhone}?text=${encodeURIComponent(msg)}`;
    };

    // Imprimir ticket físico/térmico oficial de 80mm
    const handlePrintTicket = () => {
        if (!spinResult) return;
        const { premio, codigo_descuento, ticket } = spinResult;
        const dr = form.doctor_nombre || 'Doctor(a)';
        const clinica = clinicas.find((c) => String(c.id) === String(form.clinica_id))?.nombre || 'Uso Libre / Clínicas Afiliadas';
        const fechaEmision = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const fechaVence = ticket?.fecha_vencimiento 
            ? new Date(ticket.fecha_vencimiento).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '30 días desde hoy';

        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (!printWindow) {
            toast.error('Por favor permite ventanas emergentes para imprimir el ticket');
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Ticket de Regalo - AFINIX DENTAL LAB S.A.C.</title>
                <style>
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        font-size: 13px;
                        color: #000;
                        width: 280px;
                        margin: 0 auto;
                        padding: 10px;
                        line-height: 1.35;
                    }
                    .text-center { text-align: center; }
                    .bold { font-weight: bold; }
                    .dashed { border-top: 1px dashed #000; margin: 8px 0; }
                    .code-box {
                        border: 2px solid #000;
                        padding: 8px;
                        font-size: 20px;
                        font-weight: 900;
                        letter-spacing: 4px;
                        text-align: center;
                        margin: 10px 0;
                    }
                    .terms { font-size: 10px; text-align: justify; margin-top: 8px; }
                </style>
            </head>
            <body>
                <div class="text-center bold" style="font-size: 15px;">AFINIX DENTAL LAB S.A.C.</div>
                <div class="text-center" style="font-size: 11px;">RUC: 20616033973</div>
                <div class="text-center" style="font-size: 10px;">Calle Piura 316, Mariano Melgar, Arequipa</div>
                <div class="dashed"></div>
                <div class="text-center bold">*** TICKET DE BENEFICIO EXCLUSIVO ***</div>
                <div class="text-center" style="font-size: 11px;">RULETA DE LA SUERTE · EVENTOS & VISITAS</div>
                <div class="dashed"></div>
                <div><strong>FECHA:</strong> ${fechaEmision}</div>
                <div><strong>DOCTOR(A):</strong> ${dr}</div>
                <div><strong>CLÍNICA:</strong> ${clinica}</div>
                <div class="dashed"></div>
                <div class="text-center bold" style="font-size: 14px; margin: 4px 0;">
                    ${premio.titulo}
                </div>
                ${codigo_descuento ? `
                    <div class="text-center" style="font-size: 11px;">CÓDIGO DE 6 DÍGITOS:</div>
                    <div class="code-box">${codigo_descuento}</div>
                ` : ''}
                <div class="dashed"></div>
                <div class="terms">
                    <strong>CONDICIONES:</strong><br>
                    • Válido exactamente por 30 días (hasta: ${fechaVence}).<br>
                    • Válido para 1 solo trabajo o producto dental.<br>
                    • Presentar este ticket o ingresar el código de 6 dígitos en el portal web de pedidos.
                </div>
                <div class="dashed"></div>
                <div class="text-center" style="font-size: 11px; margin-top: 10px;">
                    ¡Construyendo sonrisas de alta precisión!
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(() => window.close(), 1000);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    const clinicOptions = [
        { value: '', label: 'Uso Libre (Cualquier Doctor / Sin Cuenta)' },
        ...clinicas.map((c) => ({ value: String(c.id), label: `${c.nombre} (${c.ciudad || 'Arequipa'})` }))
    ];

    const selectedClinicName = clinicas.find((c) => String(c.id) === String(form.clinica_id))?.nombre;

    return (
        <div className={`card ${isKiosk ? 'kiosk-mode-card' : 'dashboard-ops-panel'}`} style={{
            padding: isKiosk ? '2rem' : '1.5rem',
            marginBottom: '1.5rem',
            borderRadius: isKiosk ? '20px' : '12px'
        }}>
            {!isKiosk && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <i className="bi bi-disc text-primary" aria-hidden="true"></i>
                            Ruleta de Beneficios y Premios
                        </h3>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary, #64748b)' }}>
                            Herramienta para visitas clínicas, congresos odontológicos y eventos comerciales.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span className="badge" style={{ background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7', border: '1px solid #0284c7' }}>
                            <i className="bi bi-shield-lock-fill" style={{ marginRight: '4px' }}></i> Exclusivo Equipo Afinix
                        </span>
                    </div>
                </div>
            )}

            <div style={{
                display: 'grid',
                gridTemplateColumns: isKiosk ? 'repeat(auto-fit, minmax(360px, 1fr))' : 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: isKiosk ? '3rem' : '2rem',
                alignItems: 'center'
            }}>
                {/* Formulario de registro previo al giro */}
                <div style={{
                    background: 'var(--color-bg-secondary, #f8fafc)',
                    padding: isKiosk ? '1.75rem' : '1.25rem',
                    borderRadius: '16px',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.03)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-primary, #0284c7)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <i className="bi bi-person-bounding-box"></i>
                            Datos del Participante
                        </h4>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', background: '#e2e8f0', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                            {form.clinica_id ? 'Con Cuenta Portal' : 'Uso Libre'}
                        </span>
                    </div>

                    <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                        <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                            Nombre del Doctor(a) <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Ej. Dr. Carlos Valdivia"
                            value={form.doctor_nombre}
                            onChange={(e) => setForm((prev) => ({ ...prev, doctor_nombre: e.target.value }))}
                            disabled={isSpinning}
                            style={{ fontSize: isKiosk ? '1.05rem' : '0.9rem', padding: '0.65rem 0.75rem' }}
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                        <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                            Clínica / Consultorio (Asignación)
                        </label>
                        <CustomSelect
                            options={clinicOptions}
                            value={form.clinica_id ? String(form.clinica_id) : ''}
                            onChange={(_, val) => setForm((prev) => ({ ...prev, clinica_id: val }))}
                            placeholder="Uso Libre (o vincular con cuenta en portal)"
                            searchable
                            disabled={isSpinning}
                        />
                        <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: '3px' }}>
                            {form.clinica_id 
                                ? '✨ Se enviará notificación con pop-up automático al portal del doctor.' 
                                : '🎟️ Generará código de 6 dígitos libre para escribir en ticket o enviar por WhatsApp.'}
                        </span>
                    </div>

                    <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                        <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                            Teléfono / WhatsApp (para entrega digital)
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
                        <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                            Evento o Motivo
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Ej. Visita Clínica San Juan / Congreso Arequipa"
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
                            padding: isKiosk ? '1rem' : '0.85rem',
                            fontWeight: 700,
                            fontSize: isKiosk ? '1.15rem' : '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.6rem',
                            boxShadow: '0 6px 16px rgba(2, 132, 199, 0.35)',
                            borderRadius: '10px'
                        }}
                    >
                        {isSpinning ? (
                            <>
                                <span className="spinner-border spinner-border-sm" role="status"></span>
                                ¡Girando la ruleta! Suerte...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-play-circle-fill" style={{ fontSize: '1.2rem' }}></i>
                                ¡Girar la Ruleta Ahora!
                            </>
                        )}
                    </button>
                </div>

                {/* Canvas de la Ruleta y Puntero */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{
                        position: 'relative',
                        width: isKiosk ? '380px' : '340px',
                        height: isKiosk ? '380px' : '340px',
                        maxWidth: '90vw'
                    }}>
                        {/* Puntero Superior Triángulo */}
                        <div
                            style={{
                                position: 'absolute',
                                top: '-14px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: 0,
                                height: 0,
                                borderLeft: '16px solid transparent',
                                borderRight: '16px solid transparent',
                                borderTop: '32px solid #ef4444',
                                zIndex: 10,
                                filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.45))'
                            }}
                        />

                        {/* Canvas */}
                        <canvas
                            ref={canvasRef}
                            width={isKiosk ? 380 : 340}
                            height={isKiosk ? 380 : 340}
                            style={{
                                width: '100%',
                                height: '100%',
                                borderRadius: '50%',
                                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.25)',
                                cursor: isSpinning ? 'wait' : 'pointer'
                            }}
                            onClick={() => {
                                if (!isSpinning && form.doctor_nombre.trim()) handleSpin();
                            }}
                        />
                    </div>

                    <p style={{ marginTop: '1.25rem', fontSize: '0.82rem', color: 'var(--color-text-secondary, #64748b)', textAlign: 'center' }}>
                        Probabilidad auditada y registrada en el sistema de fidelización de <strong>AFINIX DENTAL LAB S.A.C.</strong>
                    </p>
                </div>
            </div>

            {/* Modal de Resultado y Entrega de Ticket Flotante */}
            <Modal
                open={showResultModal && Boolean(spinResult)}
                onClose={() => {
                    setShowResultModal(false);
                    setForm((prev) => ({ ...prev, doctor_nombre: '', doctor_telefono: '' }));
                }}
                title={spinResult?.premio?.tipo_premio === 'sin_premio' ? '¡Sigue Intentando!' : '¡Premio Otorgado con Éxito!'}
                subtitle={`Doctor(a): ${form.doctor_nombre || 'Participante'} ${selectedClinicName ? `· ${selectedClinicName}` : ''}`}
                icon={spinResult?.premio?.tipo_premio === 'sin_premio' ? 'bi-emoji-neutral' : 'bi-gift-fill'}
                size="md"
            >
                {spinResult && (
                    <div style={{ textAlign: 'center', padding: '0.25rem 0' }}>
                        {/* Icono de Trofeo / Regalo */}
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
                            fontSize: '2rem',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                        }}>
                            <i className={spinResult.premio.tipo_premio === 'sin_premio' ? 'bi bi-emoji-neutral' : 'bi bi-trophy-fill'}></i>
                        </div>

                        {/* Card Oficial del Ticket de Regalo */}
                        <div style={{
                            background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
                            border: '2px dashed var(--color-primary, #0284c7)',
                            borderRadius: '16px',
                            padding: '1.25rem',
                            marginBottom: '1.25rem',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0284c7' }}>
                                AFINIX DENTAL LAB S.A.C. · TICKET DE BENEFICIO
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary, #0284c7)', margin: '0.35rem 0' }}>
                                {spinResult.premio.titulo}
                            </div>
                            <p style={{ fontSize: '0.85rem', margin: 0, color: '#475569' }}>
                                {spinResult.premio.descripcion || 'Beneficio comercial exclusivo entregado en visita/evento'}
                            </p>

                            {/* CÓDIGO DE 6 DÍGITOS EXCLUSIVO */}
                            {spinResult.codigo_descuento && (
                                <div style={{
                                    marginTop: '1rem',
                                    paddingTop: '1rem',
                                    borderTop: '1px dashed #cbd5e1',
                                    background: 'rgba(2, 132, 199, 0.04)',
                                    padding: '0.85rem',
                                    borderRadius: '10px'
                                }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                                        Código de Descuento (6 Dígitos):
                                    </span>
                                    
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.6rem',
                                        marginTop: '0.4rem'
                                    }}>
                                        <code style={{
                                            fontSize: '1.5rem',
                                            fontWeight: 800,
                                            background: '#0f172a',
                                            color: '#38bdf8',
                                            padding: '0.35rem 1rem',
                                            borderRadius: '8px',
                                            fontFamily: 'monospace',
                                            letterSpacing: '0.15em',
                                            border: '1px solid #1e293b'
                                        }}>
                                            {spinResult.codigo_descuento}
                                        </code>

                                        {/* Botón Flotante / Rápido de Copiado */}
                                        <button
                                            type="button"
                                            className={`btn ${copiedCode ? 'btn-success' : 'btn-outline-primary'}`}
                                            onClick={() => copyCode(spinResult.codigo_descuento)}
                                            title="Copiar código rápido"
                                            style={{
                                                padding: '0.45rem 0.85rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.35rem',
                                                fontWeight: 600
                                            }}
                                        >
                                            <i className={`bi ${copiedCode ? 'bi-check-lg' : 'bi-clipboard'}`}></i>
                                            {copiedCode ? 'Copiado' : 'Copiar'}
                                        </button>
                                    </div>

                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        gap: '1rem',
                                        marginTop: '0.6rem',
                                        fontSize: '0.75rem',
                                        color: '#64748b'
                                    }}>
                                        <span><i className="bi bi-clock-history"></i> Vigencia: <strong>30 días (1 mes)</strong></span>
                                        <span><i className="bi bi-check-circle-fill text-success"></i> <strong>1 solo producto</strong></span>
                                    </div>
                                </div>
                            )}

                            {/* Alerta de notificación si se vinculó a una clínica */}
                            {form.clinica_id && (
                                <div style={{
                                    marginTop: '0.85rem',
                                    fontSize: '0.78rem',
                                    color: '#059669',
                                    background: '#ecfdf5',
                                    padding: '0.45rem 0.75rem',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.4rem'
                                }}>
                                    <i className="bi bi-bell-fill"></i>
                                    ¡Notificación y pop-up de ticket enviados automáticamente al portal de la clínica!
                                </div>
                            )}
                        </div>

                        {/* Botones de acción del Modal */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            {spinResult.codigo_descuento && (
                                <>
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        onClick={handlePrintTicket}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 600 }}
                                    >
                                        <i className="bi bi-printer"></i>
                                        Imprimir Ticket Físico
                                    </button>

                                    {form.doctor_telefono && (
                                        <a
                                            href={getWhatsAppUrl()}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-success"
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.4rem',
                                                backgroundColor: '#25D366',
                                                borderColor: '#25D366',
                                                color: '#ffffff',
                                                fontWeight: 600
                                            }}
                                        >
                                            <i className="bi bi-whatsapp"></i>
                                            Enviar por WhatsApp
                                        </a>
                                    )}
                                </>
                            )}
                        </div>

                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => {
                                setShowResultModal(false);
                                setForm((prev) => ({ ...prev, doctor_nombre: '', doctor_telefono: '' }));
                            }}
                            style={{ width: '100%', fontWeight: 600, padding: '0.7rem' }}
                        >
                            Registrar Siguiente Participante
                        </button>
                    </div>
                )}
            </Modal>
        </div>
    );
}
