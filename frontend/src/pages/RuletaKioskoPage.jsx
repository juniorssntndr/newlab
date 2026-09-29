import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiClient } from '../services/http/apiClient.js';
import { useAuth } from '../state/AuthContext.jsx';
import Modal from '../components/Modal.jsx';

export default function RuletaKioskoPage() {
    const { getHeaders } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const canvasRef = useRef(null);
    const currentAngleRef = useRef(0);
    const animationFrameRef = useRef(null);
    const lastTickSegmentRef = useRef(-1);

    // Estado de la ruleta y premios
    const [premios, setPremios] = useState([]);
    const [loadingPremios, setLoadingPremios] = useState(true);
    const [isSpinning, setIsSpinning] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Datos del participante cargados desde sessionStorage o URL
    const [participant, setParticipant] = useState({
        doctor_nombre: '',
        clinica_id: '',
        doctor_telefono: '',
        evento_nombre: 'Visita Comercial'
    });

    // Estado del resultado ganador
    const [spinResult, setSpinResult] = useState(null);
    const [showResultModal, setShowResultModal] = useState(false);
    const [copiedCode, setCopiedCode] = useState(false);

    // Cargar participante preconfigurado desde sessionStorage
    useEffect(() => {
        try {
            const saved = sessionStorage.getItem('afinix_ruleta_participante');
            if (saved) {
                const parsed = JSON.parse(saved);
                setParticipant((prev) => ({
                    ...prev,
                    doctor_nombre: parsed.doctor_nombre || searchParams.get('doctor') || '',
                    clinica_id: parsed.clinica_id || searchParams.get('clinica_id') || '',
                    doctor_telefono: parsed.doctor_telefono || searchParams.get('telefono') || '',
                    evento_nombre: parsed.evento_nombre || searchParams.get('evento') || 'Visita Comercial'
                }));
            } else {
                setParticipant((prev) => ({
                    ...prev,
                    doctor_nombre: searchParams.get('doctor') || '',
                    clinica_id: searchParams.get('clinica_id') || '',
                    doctor_telefono: searchParams.get('telefono') || '',
                    evento_nombre: searchParams.get('evento') || 'Visita Comercial'
                }));
            }
        } catch {
            // default
        }
    }, [searchParams]);

    // Escuchar estado de pantalla completa
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement));
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    };

    // Sonidos de la Ruleta (Tick & Win)
    const playTickSound = () => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(650, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.035);
            gain.gain.setValueAtTime(0.18, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.04);
            setTimeout(() => ctx.close().catch(() => {}), 80);
        } catch {
            // Silencioso
        }
    };

    const playWinSound = () => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
                gain.gain.setValueAtTime(0.25, ctx.currentTime + idx * 0.12);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.4);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + idx * 0.12);
                osc.stop(ctx.currentTime + idx * 0.12 + 0.42);
            });
            setTimeout(() => ctx.close().catch(() => {}), 1500);
        } catch {
            // Silencioso
        }
    };

    // Cargar premios activos
    const loadPremios = async () => {
        try {
            setLoadingPremios(true);
            const res = await apiClient.get('/api/marketing/ruleta/premios', { headers: getHeaders() });
            const list = res?.data !== undefined ? res.data : (Array.isArray(res) ? res : []);
            setPremios(list);
        } catch (err) {
            toast.error('Error al sincronizar premios de la ruleta');
        } finally {
            setLoadingPremios(false);
        }
    };

    useEffect(() => {
        loadPremios();
    }, []);

    // Dibujar ruleta en el Canvas grande (Interacty style)
    const drawWheel = (angle = 0) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = width / 2 - 20;

        ctx.clearRect(0, 0, width, height);

        if (!premios.length) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Sin premios configurados', centerX, centerY);
            return;
        }

        const numSegments = premios.length;
        const arc = (2 * Math.PI) / numSegments;

        // Sonido de tick al pasar por el puntero superior (1.5 * PI)
        const currentNormalized = (angle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        const activeSegment = Math.floor(((1.5 * Math.PI - currentNormalized + 2 * Math.PI) % (2 * Math.PI)) / arc);
        if (activeSegment !== lastTickSegmentRef.current && isSpinning) {
            lastTickSegmentRef.current = activeSegment;
            playTickSound();
        }

        // Borde exterior metálico dorado con luces de feria
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 12, 0, 2 * Math.PI);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.lineWidth = 10;
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
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();

            // Texto del sector
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(startAngle + arc / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = premio.texto_color || '#ffffff';
            ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 4;

            const displayTitle = premio.titulo.length > 22 ? `${premio.titulo.substring(0, 20)}…` : premio.titulo;
            ctx.fillText(displayTitle, radius - 28, 6);
            ctx.restore();

            ctx.restore();
        });

        // Luces / Pines exteriores alrededor de la ruleta (Interacty style)
        for (let i = 0; i < numSegments * 2; i++) {
            const pinAngle = angle + (i * Math.PI) / numSegments;
            const pinX = centerX + Math.cos(pinAngle) * (radius + 2);
            const pinY = centerY + Math.sin(pinAngle) * (radius + 2);

            ctx.beginPath();
            ctx.arc(pinX, pinY, 5, 0, 2 * Math.PI);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#f59e0b';
            ctx.stroke();
        }

        // Centro de la ruleta (Buje interactivo)
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, 42, 0, 2 * Math.PI);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#38bdf8';
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('AFINIX', centerX, centerY - 6);
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('LAB', centerX, centerY + 9);
        ctx.restore();
    };

    useEffect(() => {
        if (!loadingPremios) {
            drawWheel(currentAngleRef.current);
        }
    }, [premios, loadingPremios]);

    // Ejecución del giro al hacer clic
    const handleSpin = async () => {
        if (isSpinning || loadingPremios || !premios.length) return;

        setIsSpinning(true);
        setSpinResult(null);

        try {
            // Mandar solicitud de giro (el backend usa participante si existe, o default "Participante Invitado")
            const response = await apiClient.post('/api/marketing/ruleta/girar', {
                doctor_nombre: participant.doctor_nombre || 'Participante Invitado',
                clinica_id: participant.clinica_id || null,
                doctor_telefono: participant.doctor_telefono || null,
                evento_nombre: participant.evento_nombre || 'Visita Comercial'
            }, {
                headers: getHeaders()
            });

            const resPayload = response?.data || response;
            const { premio, codigo_descuento, giro, ticket } = resPayload;

            // Calcular ángulo para que el segmento ganador quede exactamente bajo el puntero superior (1.5 * PI)
            const prizeIndex = premios.findIndex((p) => p.id === premio.id);
            const numSegments = premios.length;
            const segmentArc = (2 * Math.PI) / numSegments;

            const targetSegmentCenter = 1.5 * Math.PI - (prizeIndex + 0.5) * segmentArc;
            const extraSpins = 7 * (2 * Math.PI); // 7 giros completos de alta velocidad
            const currentMod = currentAngleRef.current % (2 * Math.PI);
            const totalDistance = extraSpins + (targetSegmentCenter - currentMod + 2 * Math.PI) % (2 * Math.PI);
            const targetAngle = currentAngleRef.current + totalDistance;

            const startTime = performance.now();
            const duration = 5200; // 5.2 segundos de animación emocionante
            const startAngle = currentAngleRef.current;

            const animate = (now) => {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                // Quartic ease-out para desaceleración natural
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
                    loadPremios(); // Recargar premios para reflejar stock actualizado
                }
            };

            animationFrameRef.current = requestAnimationFrame(animate);
        } catch (err) {
            setIsSpinning(false);
            const msg = err.response?.data?.error || 'Error al conectar con la ruleta';
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

    // Imprimir ticket físico/térmico oficial de 80mm
    const handlePrintTicket = () => {
        if (!spinResult) return;
        const { premio, codigo_descuento, ticket } = spinResult;
        const dr = participant.doctor_nombre || 'Participante Invitado';
        const fechaEmision = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const fechaVence = ticket?.fecha_vencimiento 
            ? new Date(ticket.fecha_vencimiento).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '30 días desde hoy';

        const printWindow = window.open('', '_blank', 'width=380,height=600');
        if (!printWindow) {
            toast.error('Permite ventanas emergentes para imprimir');
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
                        width: 270px;
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
                <div><strong>EVENTO:</strong> ${participant.evento_nombre || 'Visita Comercial'}</div>
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

    const getWhatsAppUrl = () => {
        if (!spinResult || !participant.doctor_telefono) return '#';
        const cleanPhone = participant.doctor_telefono.replace(/\D/g, '');
        const dr = participant.doctor_nombre || 'Doctor(a)';
        const premio = spinResult.premio.titulo;
        const code = spinResult.codigo_descuento;

        let msg = `¡Hola Dr(a). ${dr}! Fue un placer visitarle de parte de *AFINIX DENTAL LAB S.A.C.*\n\nEn nuestra Ruleta de Beneficios ha ganado: *${premio}*.`;
        if (code) {
            msg += `\n\n🎟️ *Su código exclusivo de 6 dígitos es:* \`${code}\`\n\n📌 *Condiciones:* Válido por 1 mes (30 días) para 1 solo trabajo/producto dental.\nPuede canjearlo al registrar su pedido en el portal o indicárselo a su asesor comercial.`;
        }
        msg += `\n\n¡Esperamos seguir construyendo sonrisas junto a su clínica!`;

        return `https://wa.me/51${cleanPhone}?text=${encodeURIComponent(msg)}`;
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'radial-gradient(ellipse at 50% 30%, #0c192c 0%, #020617 100%)',
            color: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1.25rem',
            position: 'relative',
            overflow: 'hidden',
            userSelect: 'none'
        }}>
            {/* Cabecera Superior Interacty Style */}
            <header style={{
                width: '100%',
                maxWidth: '1200px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 20
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        color: '#ffffff',
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.35rem',
                        boxShadow: '0 4px 15px rgba(2, 132, 199, 0.4)'
                    }}>
                        <i className="bi bi-disc-fill"></i>
                    </div>
                    <div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '0.04em', color: '#ffffff' }}>
                            AFINIX <span style={{ color: '#38bdf8' }}>LAB</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            {participant.doctor_nombre ? `Turno: Dr(a). ${participant.doctor_nombre}` : 'Ruleta de Beneficios Comercial'}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button
                        type="button"
                        className="btn btn-outline-light btn-sm"
                        onClick={toggleFullscreen}
                        title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                        style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.45rem 0.8rem',
                            borderRadius: '8px'
                        }}
                    >
                        <i className={`bi ${isFullscreen ? 'bi-fullscreen-exit' : 'bi-fullscreen'}`}></i>
                        <span style={{ fontSize: '0.82rem' }}>{isFullscreen ? 'Salir' : 'Pantalla Completa'}</span>
                    </button>

                    <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => navigate('/marketing')}
                        style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderColor: 'rgba(255, 255, 255, 0.15)',
                            color: '#cbd5e1',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.45rem 0.8rem',
                            borderRadius: '8px'
                        }}
                    >
                        <i className="bi bi-x-circle"></i>
                        <span style={{ fontSize: '0.82rem' }}>Cerrar</span>
                    </button>
                </div>
            </header>

            {/* Centro de la Pantalla: Ruleta Gigante Interactiva estilo Interacty */}
            <main style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                margin: 'auto 0',
                position: 'relative',
                zIndex: 10
            }}>
                <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                    <span style={{
                        display: 'inline-block',
                        background: 'rgba(56, 189, 248, 0.12)',
                        color: '#38bdf8',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        borderRadius: '20px',
                        padding: '0.25rem 0.9rem',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        marginBottom: '0.35rem'
                    }}>
                        ¡GIRA LA RULETA AFINIX!
                    </span>
                    <h2 style={{
                        margin: 0,
                        fontSize: '1.75rem',
                        fontWeight: 900,
                        background: 'linear-gradient(to right, #ffffff, #7dd3fc)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        Premios y Beneficios Exclusivos en Trabajos Dentales
                    </h2>
                </div>

                {/* Contenedor Ruleta y Puntero */}
                <div style={{
                    position: 'relative',
                    width: '460px',
                    height: '460px',
                    maxWidth: '85vw',
                    maxHeight: '85vw',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isSpinning ? 'wait' : 'pointer'
                }}
                onClick={handleSpin}
                >
                    {/* Puntero Superior Triángulo */}
                    <div style={{
                        position: 'absolute',
                        top: '-16px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 0,
                        height: 0,
                        borderLeft: '18px solid transparent',
                        borderRight: '18px solid transparent',
                        borderTop: '36px solid #ef4444',
                        zIndex: 30,
                        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.6))'
                    }} />

                    {/* Canvas */}
                    <canvas
                        ref={canvasRef}
                        width={460}
                        height={460}
                        style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: '50%',
                            boxShadow: '0 0 50px rgba(2, 132, 199, 0.35), 0 20px 40px rgba(0,0,0,0.6)',
                            transition: 'transform 0.2s ease'
                        }}
                    />

                    {/* Botón Central Pulsante '¡GIRAR!' (Interacty Style) */}
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '92px',
                        height: '92px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        boxShadow: '0 0 25px rgba(56, 189, 248, 0.7), inset 0 2px 4px rgba(255,255,255,0.4)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontWeight: 900,
                        fontSize: '1rem',
                        letterSpacing: '0.05em',
                        border: '4px solid #ffffff',
                        zIndex: 25,
                        pointerEvents: 'none',
                        animation: isSpinning ? 'none' : 'pulse 2s infinite'
                    }}>
                        {isSpinning ? (
                            <span className="spinner-border spinner-border-sm" role="status"></span>
                        ) : (
                            <>
                                <span>GIRAR</span>
                                <i className="bi bi-play-fill" style={{ fontSize: '1.2rem', marginTop: '-4px' }}></i>
                            </>
                        )}
                    </div>
                </div>

                {/* Llamado a la acción grande inferior */}
                <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleSpin}
                        disabled={isSpinning || loadingPremios}
                        style={{
                            padding: '0.85rem 2.5rem',
                            fontSize: '1.15rem',
                            fontWeight: 800,
                            borderRadius: '30px',
                            background: 'linear-gradient(135deg, #0284c7 0%, #024873 100%)',
                            border: '1px solid #38bdf8',
                            boxShadow: '0 8px 24px rgba(2, 132, 199, 0.45)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.6rem'
                        }}
                    >
                        {isSpinning ? (
                            <>
                                <span className="spinner-border spinner-border-sm" role="status"></span>
                                Girando la Suerte...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-play-circle-fill" style={{ fontSize: '1.3rem' }}></i>
                                ¡Haz Clic para Girar Ahora!
                            </>
                        )}
                    </button>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                        ¡Ruleta infinita! Puedes girar cuantas veces desees durante la visita.
                    </p>
                </div>
            </main>

            {/* Footer */}
            <footer style={{
                textAlign: 'center',
                fontSize: '0.78rem',
                color: '#64748b',
                paddingTop: '0.5rem',
                zIndex: 20
            }}>
                AFINIX DENTAL LAB S.A.C. · RUC 20616033973 · Calle Piura 316, Mariano Melgar, Arequipa
            </footer>

            {/* Modal de Victoria / Ticket de 6 Dígitos */}
            <Modal
                open={showResultModal && Boolean(spinResult)}
                onClose={() => setShowResultModal(false)}
                title={spinResult?.premio?.tipo_premio === 'sin_premio' ? '¡Sigue Intentando!' : '¡FELICITACIONES!'}
                subtitle={`Beneficio otorgado por AFINIX DENTAL LAB S.A.C.`}
                icon={spinResult?.premio?.tipo_premio === 'sin_premio' ? 'bi-emoji-neutral' : 'bi-trophy-fill'}
                size="md"
            >
                {spinResult && (
                    <div style={{ textAlign: 'center', padding: '0.25rem 0' }}>
                        {/* Icono de Trofeo */}
                        <div style={{
                            width: '70px',
                            height: '70px',
                            borderRadius: '50%',
                            backgroundColor: spinResult.premio.tipo_premio === 'sin_premio' ? '#f1f5f9' : 'rgba(16, 185, 129, 0.15)',
                            color: spinResult.premio.tipo_premio === 'sin_premio' ? '#64748b' : '#10b981',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1rem',
                            fontSize: '2.2rem',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.08)'
                        }}>
                            <i className={spinResult.premio.tipo_premio === 'sin_premio' ? 'bi bi-emoji-neutral' : 'bi bi-gift-fill'}></i>
                        </div>

                        {/* Card del Premio Ganado */}
                        <div style={{
                            background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
                            border: '2px dashed var(--color-primary, #0284c7)',
                            borderRadius: '16px',
                            padding: '1.25rem',
                            marginBottom: '1.25rem',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.05)'
                        }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0284c7' }}>
                                AFINIX LAB · RESULTADO DE RULETA
                            </div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--color-primary, #0284c7)', margin: '0.35rem 0' }}>
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
                                            fontSize: '1.6rem',
                                            fontWeight: 900,
                                            background: '#0f172a',
                                            color: '#38bdf8',
                                            padding: '0.35rem 1.1rem',
                                            borderRadius: '8px',
                                            fontFamily: 'monospace',
                                            letterSpacing: '0.15em',
                                            border: '1px solid #1e293b'
                                        }}>
                                            {spinResult.codigo_descuento}
                                        </code>

                                        <button
                                            type="button"
                                            className={`btn ${copiedCode ? 'btn-success' : 'btn-outline-primary'}`}
                                            onClick={() => copyCode(spinResult.codigo_descuento)}
                                            title="Copiar código rápido"
                                            style={{
                                                padding: '0.5rem 0.9rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.35rem',
                                                fontWeight: 700
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
                        </div>

                        {/* Botones de acción del Modal */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            {spinResult.codigo_descuento && (
                                <>
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        onClick={handlePrintTicket}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 600 }}
                                    >
                                        <i className="bi bi-printer"></i>
                                        Imprimir Ticket
                                    </button>

                                    {participant.doctor_telefono && (
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
                                            WhatsApp
                                        </a>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Botón de Siguiente Giro (Ruleta Infinita) */}
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => {
                                setShowResultModal(false);
                                setSpinResult(null);
                            }}
                            style={{
                                width: '100%',
                                fontWeight: 700,
                                padding: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                fontSize: '1rem',
                                boxShadow: '0 4px 15px rgba(2, 132, 199, 0.3)'
                            }}
                        >
                            <i className="bi bi-arrow-repeat"></i>
                            ¡Siguiente Giro / Girar de Nuevo!
                        </button>
                    </div>
                )}
            </Modal>
        </div>
    );
}
