import { resolveImageUrl } from '../utils/resolveImageUrl.js';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiClient } from '../services/http/apiClient.js';
import { useAuth } from '../state/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import CustomSelect from '../components/CustomSelect.jsx';
import isoLight from '../assets/branding/iso-light.png';
import logoDark from '../assets/branding/logo-dark.png';
import { fireConfetti } from '../utils/confetti.js';

export default function RuletaKioskoPage() {
    const { getHeaders } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const canvasRef = useRef(null);
    const confettiCanvasRef = useRef(null);
    const currentAngleRef = useRef(0);
    const animationFrameRef = useRef(null);
    const lastTickSegmentRef = useRef(-1);

    // Estado de la ruleta y premios
    const [premios, setPremios] = useState([]);
    const [loadingPremios, setLoadingPremios] = useState(true);
    const [isSpinning, setIsSpinning] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Lista de clínicas para asignación rápida
    const [clinicas, setClinicas] = useState([]);

    // Modal de Asignación de Turno (Modo Stand vs Visita Médica)
    const [showTurnModal, setShowTurnModal] = useState(false);
    const [turnTab, setTurnTab] = useState('stand'); // 'stand' | 'doctor'

    // Datos del participante cargados desde sessionStorage o URL
    const [participant, setParticipant] = useState({
        doctor_nombre: '',
        clinica_id: '',
        doctor_telefono: '',
        evento_nombre: 'Modo Stand / Feria Dental'
    });

    // Formulario de edición rápida de turno
    const [doctorForm, setDoctorForm] = useState({
        doctor_nombre: '',
        clinica_id: '',
        doctor_telefono: '',
        evento_nombre: 'Visita Comercial'
    });

    // Estado del resultado ganador
    const [spinResult, setSpinResult] = useState(null);
    const [showResultModal, setShowResultModal] = useState(false);
    const [copiedCode, setCopiedCode] = useState(false);
    const [instantPhone, setInstantPhone] = useState('');

    // Cargar participante preconfigurado desde sessionStorage
    useEffect(() => {
        try {
            const saved = sessionStorage.getItem('afinix_ruleta_participante');
            if (saved) {
                const parsed = JSON.parse(saved);
                const loaded = {
                    doctor_nombre: parsed.doctor_nombre || searchParams.get('doctor') || '',
                    clinica_id: parsed.clinica_id || searchParams.get('clinica_id') || '',
                    doctor_telefono: parsed.doctor_telefono || searchParams.get('telefono') || '',
                    evento_nombre: parsed.evento_nombre || searchParams.get('evento') || 'Modo Stand / Feria Dental'
                };
                setParticipant(loaded);
                setDoctorForm(loaded);
                if (loaded.doctor_nombre) setTurnTab('doctor');
            } else {
                const urlData = {
                    doctor_nombre: searchParams.get('doctor') || '',
                    clinica_id: searchParams.get('clinica_id') || '',
                    doctor_telefono: searchParams.get('telefono') || '',
                    evento_nombre: searchParams.get('evento') || 'Modo Stand / Feria Dental'
                };
                setParticipant(urlData);
                setDoctorForm(urlData);
                if (urlData.doctor_nombre) setTurnTab('doctor');
            }
        } catch {
            // default
        }
    }, [searchParams]);

    // Cargar clínicas disponibles para el selector rápido
    useEffect(() => {
        const fetchClinicas = async () => {
            try {
                const res = await apiClient.get('/marketing/campanas/clinicas', { headers: getHeaders() });
                const list = res?.data || (Array.isArray(res) ? res : []);
                setClinicas(list);
            } catch {
                // Silencioso
            }
        };
        fetchClinicas();
    }, []);

    // Opciones para CustomSelect de clínicas
    const clinicOptions = useMemo(() => {
        const list = [
            { value: '', label: 'Cualquier clínica / doctor (Uso Libre)' }
        ];
        clinicas.forEach((c) => {
            list.push({
                value: String(c.id),
                label: `${c.nombre} ${c.provincia ? `(${c.provincia})` : ''}`
            });
        });
        return list;
    }, [clinicas]);

    // Nombre de clínica actualmente seleccionada para el badge de cabecera
    const activeClinicaNombre = useMemo(() => {
        if (!participant.clinica_id) return '';
        const found = clinicas.find((c) => String(c.id) === String(participant.clinica_id));
        return found ? found.nombre : '';
    }, [participant.clinica_id, clinicas]);

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

    // Estado de configuración visual de la ruleta (nl_ruleta_config)
    const [wheelConfig, setWheelConfig] = useState({
        fondo_url: null,
        pasador_url: null,
        tiempo_animacion_segundos: 4
    });
    const loadedSectorImagesRef = useRef(new Map());

    // Cargar premios activos y configuración visual
    const loadPremios = async () => {
        try {
            setLoadingPremios(true);
            const [premiosRes, configRes] = await Promise.allSettled([
                apiClient.get('/marketing/ruleta/premios', { headers: getHeaders() }),
                apiClient.get('/marketing/ruleta/config', { headers: getHeaders() })
            ]);

            if (premiosRes.status === 'fulfilled') {
                const res = premiosRes.value;
                const list = res?.data !== undefined ? res.data : (Array.isArray(res) ? res : []);
                setPremios(list);
            }

            if (configRes.status === 'fulfilled' && configRes.value?.data) {
                setWheelConfig(configRes.value.data);
            }
        } catch (err) {
            toast.error('Error al sincronizar premios de la ruleta');
        } finally {
            setLoadingPremios(false);
        }
    };

    useEffect(() => {
        loadPremios();
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    // Helper para cachear imágenes de sectores y logo
    const getCachedImage = (url) => {
        if (!url) return null;
        if (loadedSectorImagesRef.current.has(url)) {
            const cached = loadedSectorImagesRef.current.get(url);
            return cached.complete && cached.naturalWidth > 0 ? cached : null;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = resolveImageUrl(url);
        img.onload = () => {
            loadedSectorImagesRef.current.set(url, img);
            drawWheel(currentAngleRef.current);
        };
        loadedSectorImagesRef.current.set(url, img);
        return null;
    };

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

        // Borde exterior AFINIX LAB (Neón celeste con base azul cobalto profundo)
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 14, 0, 2 * Math.PI);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#38bdf8';
        ctx.stroke();

        // Aro de base azul AFINIX
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#0284c7';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.restore();

        // Helper para dibujar piña vectorial 100% simétrica, estética y centrada en el eje radial
        const drawSymmetricPineapple = (c, size) => {
            c.save();
            const w = size * 0.54;
            const h = size * 0.74;

            // 1. Sombra suave de contacto
            c.save();
            c.beginPath();
            c.ellipse(h * 0.58, 0, h * 0.14, w * 0.46, 0, 0, 2 * Math.PI);
            c.fillStyle = 'rgba(15, 23, 42, 0.08)';
            c.fill();
            c.restore();

            // 2. Corona de hojas tropicales estilizadas (multicapa con nervaduras)
            c.save();
            // Capa trasera (verde bosque oscuro para profundidad)
            c.fillStyle = '#047857';
            c.strokeStyle = '#064e3b';
            c.lineWidth = 1.1;

            // Hoja trasera superior
            c.beginPath();
            c.moveTo(-h * 0.22, -w * 0.12);
            c.quadraticCurveTo(-h * 0.65, -w * 0.60, -h * 0.84, -w * 0.58);
            c.quadraticCurveTo(-h * 0.55, -w * 0.25, -h * 0.20, -w * 0.05);
            c.fill();
            c.stroke();

            // Hoja trasera inferior (simetría perfecta)
            c.beginPath();
            c.moveTo(-h * 0.22, w * 0.12);
            c.quadraticCurveTo(-h * 0.65, w * 0.60, -h * 0.84, w * 0.58);
            c.quadraticCurveTo(-h * 0.55, w * 0.25, -h * 0.20, w * 0.05);
            c.fill();
            c.stroke();

            // Capa intermedia (verde esmeralda brillante)
            c.fillStyle = '#059669';
            c.strokeStyle = '#047857';

            // Hoja intermedia superior
            c.beginPath();
            c.moveTo(-h * 0.24, -w * 0.10);
            c.quadraticCurveTo(-h * 0.72, -w * 0.38, -h * 0.94, -w * 0.34);
            c.quadraticCurveTo(-h * 0.62, -w * 0.12, -h * 0.22, 0);
            c.fill();
            c.stroke();

            // Hoja intermedia inferior (simetría perfecta)
            c.beginPath();
            c.moveTo(-h * 0.24, w * 0.10);
            c.quadraticCurveTo(-h * 0.72, w * 0.38, -h * 0.94, w * 0.34);
            c.quadraticCurveTo(-h * 0.62, w * 0.12, -h * 0.22, 0);
            c.fill();
            c.stroke();

            // Capa frontal: Hoja central majestuosa
            c.fillStyle = '#10b981';
            c.strokeStyle = '#047857';
            c.lineWidth = 1.3;
            c.beginPath();
            c.moveTo(-h * 0.26, -w * 0.14);
            c.quadraticCurveTo(-h * 0.70, -w * 0.16, -h * 1.05, 0);
            c.quadraticCurveTo(-h * 0.70, w * 0.16, -h * 0.26, w * 0.14);
            c.closePath();
            c.fill();
            c.stroke();

            // Nervadura / resplandor de hojas en verde lima
            c.strokeStyle = '#6ee7b7';
            c.lineWidth = 1.1;
            c.beginPath();
            c.moveTo(-h * 0.26, 0);
            c.lineTo(-h * 0.96, 0);
            c.moveTo(-h * 0.24, -w * 0.08);
            c.quadraticCurveTo(-h * 0.58, -w * 0.22, -h * 0.86, -w * 0.28);
            c.moveTo(-h * 0.24, w * 0.08);
            c.quadraticCurveTo(-h * 0.58, w * 0.22, -h * 0.86, w * 0.28);
            c.stroke();
            c.restore();

            // 3. Cuerpo de la piña (silueta curva orgánica y gradiente cálido con volumen)
            c.save();
            c.beginPath();
            c.moveTo(-h * 0.22, 0);
            c.bezierCurveTo(-h * 0.22, -w * 0.52, h * 0.18, -w * 0.55, h * 0.54, -w * 0.26);
            c.bezierCurveTo(h * 0.66, -w * 0.12, h * 0.66, w * 0.12, h * 0.54, w * 0.26);
            c.bezierCurveTo(h * 0.18, w * 0.55, -h * 0.22, w * 0.52, -h * 0.22, 0);
            c.closePath();

            const grad = c.createLinearGradient(-h * 0.22, -w * 0.35, h * 0.65, w * 0.35);
            grad.addColorStop(0, '#fef08a'); // resplandor amarillo superior
            grad.addColorStop(0.3, '#fbbf24'); // ámbar cálido
            grad.addColorStop(0.7, '#f59e0b'); // dorado miel
            grad.addColorStop(1, '#d97706'); // sombra caramelo
            c.fillStyle = grad;
            c.shadowColor = 'rgba(180, 83, 9, 0.25)';
            c.shadowBlur = 6;
            c.fill();
            c.shadowBlur = 0;
            c.lineWidth = 1.4;
            c.strokeStyle = '#b45309';
            c.stroke();

            // Textura y escamas internas (recortadas al cuerpo)
            c.save();
            c.clip();

            // Rejilla de escamas biseladas
            c.strokeStyle = 'rgba(180, 83, 9, 0.45)';
            c.lineWidth = 1.2;
            const step = w * 0.28;
            for (let off = -h; off <= h * 1.6; off += step) {
                c.beginPath();
                c.moveTo(off, -w);
                c.lineTo(off + w * 0.9, w);
                c.stroke();

                c.beginPath();
                c.moveTo(off + w * 0.9, -w);
                c.lineTo(off, w);
                c.stroke();
            }

            // Ojos / acentos dorados simétricos en cada escama
            const scalePoints = [
                { x: 0, y: 0 },
                { x: h * 0.22, y: 0 },
                { x: h * 0.42, y: 0 },
                { x: -h * 0.05, y: -w * 0.22 },
                { x: -h * 0.05, y: w * 0.22 },
                { x: h * 0.18, y: -w * 0.24 },
                { x: h * 0.18, y: w * 0.24 },
                { x: h * 0.38, y: -w * 0.18 },
                { x: h * 0.38, y: w * 0.18 }
            ];
            scalePoints.forEach(pt => {
                c.beginPath();
                c.arc(pt.x, pt.y, Math.max(1.1, size * 0.024), 0, 2 * Math.PI);
                c.fillStyle = 'rgba(180, 83, 9, 0.75)';
                c.fill();

                c.beginPath();
                c.arc(pt.x - 0.7, pt.y - 0.7, Math.max(0.6, size * 0.013), 0, 2 * Math.PI);
                c.fillStyle = 'rgba(254, 240, 138, 0.95)';
                c.fill();
            });

            // Brillo especular lateral superior (look moderno)
            c.beginPath();
            c.ellipse(h * 0.08, -w * 0.26, h * 0.28, w * 0.12, -0.2, 0, 2 * Math.PI);
            c.fillStyle = 'rgba(255, 255, 255, 0.25)';
            c.fill();

            c.restore();

            // Corona collar en la base de las hojas
            c.fillStyle = '#047857';
            c.beginPath();
            c.moveTo(-h * 0.25, -w * 0.16);
            c.lineTo(-h * 0.16, -w * 0.08);
            c.lineTo(-h * 0.25, 0);
            c.lineTo(-h * 0.16, w * 0.08);
            c.lineTo(-h * 0.25, w * 0.16);
            c.lineTo(-h * 0.20, 0);
            c.closePath();
            c.fill();

            c.restore();
            c.restore();
        };

        // Dibujar sectores alternados (Azul AFINIX y Blanco)
        premios.forEach((premio, i) => {
            const startAngle = angle + i * arc;
            const endAngle = startAngle + arc;

            const isPina = premio.tipo_premio === 'sin_premio' || (premio.titulo && premio.titulo.toUpperCase().includes('PIÑA'));

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();

            if (!isPina) {
                const grad = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius);
                grad.addColorStop(0, '#0284c7');
                grad.addColorStop(1, '#0369a1');
                ctx.fillStyle = grad;
            } else {
                const grad = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius);
                grad.addColorStop(0, '#ffffff');
                grad.addColorStop(1, '#f8fafc');
                ctx.fillStyle = grad;
            }
            ctx.fill();
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = '#ffffff'; // divisor blanco nítido
            ctx.stroke();

            // Contenido en el sector
            ctx.translate(centerX, centerY);
            ctx.rotate(startAngle + arc / 2);

            const sectorImg = getCachedImage(premio.imagen_url);

            if (!isPina) {
                // SECTOR CON PREMIO: Descuento explícito en alto contraste
                const dist = radius * 0.77;
                ctx.translate(dist, 0);
                ctx.rotate(Math.PI / 2); // perpendicular al radio

                // Extraer el monto limpio para jerarquía visual
                const rawTitle = (premio.titulo || '').trim();
                let amountText = rawTitle;
                if (rawTitle.toUpperCase().includes('DCTO')) {
                    amountText = rawTitle.replace(/DCTO\.?/i, '').trim();
                } else if (rawTitle.toUpperCase().includes('DESCUENTO')) {
                    amountText = rawTitle.replace(/DESCUENTO/i, '').trim();
                }
                if (!amountText) amountText = `S/. ${premio.valor || 0}`;

                // 1. Monto grande y destacado
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const fontSize = Math.max(16, Math.round(radius * 0.082));
                ctx.font = `900 ${fontSize}px system-ui, -apple-system, sans-serif`;
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
                ctx.shadowBlur = 5;
                ctx.fillText(amountText, 0, -fontSize * 0.88);

                // 2. Badge cápsula "DESCUENTO" (aclara 100% que no es dinero regalado)
                ctx.shadowBlur = 0;
                const badgeW = Math.max(68, Math.round(fontSize * 3.4));
                const badgeH = Math.max(15, Math.round(fontSize * 0.78));
                const bx = -badgeW / 2;
                const by = -badgeH * 0.35;

                ctx.save();
                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(bx, by, badgeW, badgeH, badgeH / 2);
                } else {
                    ctx.rect(bx, by, badgeW, badgeH);
                }
                ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
                ctx.fill();
                ctx.lineWidth = 1.2;
                ctx.strokeStyle = '#38bdf8';
                ctx.stroke();

                ctx.font = `800 ${Math.max(9, Math.round(fontSize * 0.44))}px system-ui, sans-serif`;
                ctx.fillStyle = '#e0f2fe';
                ctx.letterSpacing = '0.05em';
                ctx.fillText('DESCUENTO', 0, by + badgeH / 2 + 0.8);
                ctx.restore();

                // 3. Ícono abajo hacia el centro
                if (sectorImg) {
                    const imgSize = Math.max(26, Math.round(radius * 0.15));
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(0, imgSize * 0.85, imgSize / 2, 0, 2 * Math.PI);
                    ctx.clip();
                    ctx.drawImage(sectorImg, -imgSize / 2, imgSize * 0.35, imgSize, imgSize);
                    ctx.restore();
                } else {
                    const val = Number(premio.valor) || 0;
                    let icon = '💰';
                    if (val >= 100) icon = '🏆';
                    else if (val >= 50) icon = '🎉';
                    else if (val >= 30) icon = '💰';
                    else icon = '⭐';

                    const iconSize = Math.max(20, Math.round(radius * 0.12));
                    ctx.font = `${iconSize}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
                    ctx.fillText(icon, 0, iconSize * 1.15);
                }
            } else {
                // SECTOR PIÑA: 100% alineada en su eje central con el centro de la ruleta y situada en el tercio exterior
                const dist = radius * 0.73;
                ctx.translate(dist, 0);
                // Invertimos para que las hojas apunten hacia el exterior y la base al centro
                ctx.rotate(Math.PI);

                const pinaSize = Math.max(38, Math.round(radius * 0.20));
                drawSymmetricPineapple(ctx, pinaSize);
            }

            ctx.restore();
        });

        // Luces / Pines exteriores alrededor de la ruleta (24 bombillas neón)
        for (let i = 0; i < numSegments * 2; i++) {
            const pinAngle = angle + (i * Math.PI) / numSegments;
            const pinX = centerX + Math.cos(pinAngle) * (radius + 8);
            const pinY = centerY + Math.sin(pinAngle) * (radius + 8);

            ctx.save();
            ctx.beginPath();
            ctx.arc(pinX, pinY, 5, 0, 2 * Math.PI);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#38bdf8';
            ctx.stroke();
            ctx.restore();
        }

        // Centro de la ruleta (Buje Blanco Oficial con Logo / Texto AFINIX)
        const hubRadius = Math.round(radius * 0.22);
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, hubRadius, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(2, 132, 199, 0.4)';
        ctx.shadowBlur = 16;
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#0284c7';
        ctx.stroke();

        // Aro interno celeste en el buje blanco
        ctx.beginPath();
        ctx.arc(centerX, centerY, hubRadius - 6, 0, 2 * Math.PI);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#bae6fd';
        ctx.stroke();

        const hubImg = getCachedImage(isoLight);
        if (hubImg) {
            const logoW = hubRadius * 1.35;
            ctx.drawImage(hubImg, centerX - logoW / 2, centerY - logoW / 2, logoW, logoW);
        } else {
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#0f172a';
            ctx.font = `900 ${Math.round(hubRadius * 0.38)}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('AFINIX', centerX, centerY - hubRadius * 0.18);
            ctx.font = `800 ${Math.round(hubRadius * 0.26)}px system-ui, sans-serif`;
            ctx.fillStyle = '#0284c7';
            ctx.fillText('LAB', centerX, centerY + hubRadius * 0.24);
        }
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
            const response = await apiClient.post('/marketing/ruleta/girar', {
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
            const duration = ((wheelConfig?.tiempo_animacion_segundos || 4) * 1000) + 400; // configurable (ej. 3-4s)
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
                    if (premio?.tipo_premio !== 'sin_premio') {
                        fireConfetti(confettiCanvasRef.current);
                    }
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

    // Generar mensaje cálido y orgánico de WhatsApp (sin sonar a robot ni "Dr. Invitado")
    const buildWhatsAppMessage = () => {
        const raw = (participant.doctor_nombre || '').trim();
        const isGuest = !raw || /invitado|participante|stand|visitante/i.test(raw);
        const saludo = isGuest ? '¡Hola Doctor(a)! 👋' : `¡Hola Dr(a). ${raw}! 👋`;
        const premio = spinResult?.premio?.titulo || 'Beneficio';
        const code = spinResult?.codigo_descuento;

        let msg = `${saludo} Un gusto saludarte de parte de *AFINIX Dental Lab*.\n\n`;
        msg += `🎉 ¡Felicitaciones por tu beneficio en la ruleta: *${premio}*!\n\n`;
        if (code) {
            msg += `🎟️ *Tu código de canje es:* \`${code}\`\n`;
            msg += `⏳ *Vigencia:* Válido por 30 días para tu próximo trabajo técnico.\n\n`;
        }
        msg += `¡Quedamos atentos para coordinar tu caso clínico! ✨`;
        return msg;
    };

    // Enviar WhatsApp (detecta si es móvil para app nativa, y en desktop abre api.whatsapp.com que invoca la app de WhatsApp Desktop / Store)
    const sendWhatsApp = (overridePhone) => {
        const targetPhone = overridePhone || participant.doctor_telefono || instantPhone;
        if (!targetPhone) {
            toast.error('Por favor ingresa un número de WhatsApp');
            return;
        }
        const cleanPhone = targetPhone.replace(/\D/g, '');
        if (cleanPhone.length < 8) {
            toast.error('Ingresa un número telefónico válido (ej. 958123456)');
            return;
        }

        const msg = buildWhatsAppMessage();
        const encoded = encodeURIComponent(msg);
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

        if (isMobile) {
            // Intentar abrir app nativa con fallback rápido a web
            window.location.href = `whatsapp://send?phone=51${cleanPhone}&text=${encoded}`;
            setTimeout(() => {
                window.open(`https://api.whatsapp.com/send?phone=51${cleanPhone}&text=${encoded}`, '_blank');
            }, 600);
        } else {
            // En desktop, api.whatsapp.com invoca el deep link a la app de Microsoft Store de WhatsApp con fallback
            window.open(`https://api.whatsapp.com/send?phone=51${cleanPhone}&text=${encoded}`, '_blank');
        }
    };

    // Aplicar Modo Stand (Giro Libre en Ferias / Eventos)
    const handleApplyStandMode = () => {
        const standData = {
            doctor_nombre: '',
            clinica_id: '',
            doctor_telefono: '',
            evento_nombre: 'Modo Stand / Feria Dental'
        };
        setParticipant(standData);
        setDoctorForm(standData);
        sessionStorage.setItem('afinix_ruleta_participante', JSON.stringify(standData));
        setShowTurnModal(false);
        toast.success('Modo Stand / Feria Dental activado');
    };

    // Aplicar Turno para Doctor Específico
    const handleSaveDoctorTurn = (e) => {
        e.preventDefault();
        if (!doctorForm.doctor_nombre.trim()) {
            toast.error('Por favor ingresa el nombre del doctor(a)');
            return;
        }
        setParticipant(doctorForm);
        sessionStorage.setItem('afinix_ruleta_participante', JSON.stringify(doctorForm));
        setShowTurnModal(false);
        toast.success(`Turno asignado a Dr(a). ${doctorForm.doctor_nombre}`);
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: `radial-gradient(circle at center, rgba(2, 6, 23, 0.25) 0%, rgba(2, 6, 23, 0.7) 100%), url(${wheelConfig.fondo_url || '/images/ruleta/ruleta-stage-bg.png'}) center center / cover no-repeat fixed`,
            color: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 'clamp(0.5rem, 1.8vh, 1.25rem) clamp(0.75rem, 2.5vw, 1.25rem)',
            position: 'relative',
            overflowX: 'hidden',
            overflowY: 'auto',
            userSelect: 'none'
        }}>
            {/* Animaciones CSS Neón Kiosko y Reglas Responsivas Fluidas */}
            <style>{`
                :root {
                    --kiosko-wheel-size: min(580px, 86vw, 54vh);
                }
                @media (min-width: 1024px) and (min-height: 800px) {
                    :root {
                        --kiosko-wheel-size: min(620px, 86vw, 58vh);
                    }
                }
                @media (min-width: 1400px) and (min-height: 900px) {
                    :root {
                        --kiosko-wheel-size: min(660px, 86vw, 60vh);
                    }
                }
                @media (max-width: 640px) {
                    :root {
                        --kiosko-wheel-size: min(390px, 88vw, 48vh);
                    }
                    .kiosko-header {
                        gap: 0.35rem !important;
                    }
                    .kiosko-header-btn {
                        padding: 0.35rem 0.6rem !important;
                        font-size: 0.75rem !important;
                        min-height: 44px !important;
                        min-width: 44px !important;
                        display: inline-flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                    }
                    .kiosko-label-optional {
                        display: none !important;
                    }
                }
                @media (max-height: 700px) {
                    :root {
                        --kiosko-wheel-size: min(340px, 84vw, 44vh);
                    }
                }
                @media (max-height: 580px) {
                    :root {
                        --kiosko-wheel-size: min(290px, 80vw, 42vh);
                    }
                }
                @keyframes ruletaPulseGlow {
                    0%, 100% {
                        opacity: 0.45;
                        transform: scale(0.96);
                    }
                    50% {
                        opacity: 0.85;
                        transform: scale(1.05);
                    }
                }
                @keyframes ruletaPulseCenter {
                    0%, 100% {
                        transform: translate(-50%, -50%) scale(1);
                        box-shadow: 0 0 26px rgba(56, 189, 248, 0.75), 0 6px 20px rgba(0, 0, 0, 0.35), inset 0 2px 5px #ffffff, inset 0 -3px 8px rgba(15, 23, 42, 0.14);
                    }
                    50% {
                        transform: translate(-50%, -50%) scale(1.04);
                        box-shadow: 0 0 40px rgba(56, 189, 248, 0.95), 0 8px 26px rgba(2, 132, 199, 0.6), inset 0 2px 5px #ffffff, inset 0 -3px 8px rgba(15, 23, 42, 0.18);
                    }
                }
                @keyframes sonarRadarWave {
                    0% {
                        transform: translate(-50%, -50%) scale(0.95);
                        opacity: 0.8;
                    }
                    100% {
                        transform: translate(-50%, -50%) scale(1.75);
                        opacity: 0;
                    }
                }
                @keyframes pointerSpinWobble {
                    0% { transform: translateX(-50%) rotate(0deg); }
                    25% { transform: translateX(-50%) rotate(-4.5deg); }
                    75% { transform: translateX(-50%) rotate(4.5deg); }
                    100% { transform: translateX(-50%) rotate(0deg); }
                }
                @keyframes ctaPulseBreath {
                    0%, 100% {
                        transform: scale(1);
                        box-shadow: 0 0 32px rgba(14, 165, 233, 0.65), 0 8px 25px rgba(0, 0, 0, 0.5);
                    }
                    50% {
                        transform: scale(1.032);
                        box-shadow: 0 0 52px rgba(56, 189, 248, 0.9), 0 10px 32px rgba(2, 132, 199, 0.75);
                    }
                }
                @keyframes playBadgePulse {
                    0%, 100% {
                        transform: scale(1);
                        box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.6);
                    }
                    50% {
                        transform: scale(1.08);
                        box-shadow: 0 0 0 8px rgba(255, 255, 255, 0);
                    }
                }
                @keyframes playIconNudge {
                    0%, 100% { transform: translateX(0); }
                    50% { transform: translateX(2.5px); }
                }
                @keyframes orbitalSlowRotate {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes orbitalReverseRotate {
                    0% { transform: rotate(360deg); }
                    100% { transform: rotate(0deg); }
                }
                @keyframes ctaSheenSweep {
                    0% { transform: translateX(-150%) skewX(-25deg); }
                    22%, 100% { transform: translateX(250%) skewX(-25deg); }
                }
                @keyframes spinSlow {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                /* Backdrop y Modal Kiosko Neón Glassmorphism */
                .modal-backdrop:has(.ruleta-modal-kiosko) {
                    background: rgba(2, 6, 23, 0.88) !important;
                    backdrop-filter: blur(14px) !important;
                    -webkit-backdrop-filter: blur(14px) !important;
                }
                .ruleta-modal-kiosko {
                    background: linear-gradient(155deg, #0b1329 0%, #061938 45%, #020617 100%) !important;
                    border: 1.5px solid rgba(56, 189, 248, 0.5) !important;
                    box-shadow: 0 0 60px rgba(2, 132, 199, 0.45), 0 25px 70px rgba(0, 0, 0, 0.95) !important;
                    border-radius: 26px !important;
                    color: #f8fafc !important;
                    overflow: hidden !important;
                    max-width: 530px !important;
                    width: 92vw !important;
                }
                .ruleta-modal-kiosko .modal-header {
                    border-bottom: 1px solid rgba(56, 189, 248, 0.18) !important;
                    padding: 1.15rem 1.5rem !important;
                    background: rgba(15, 23, 42, 0.75) !important;
                }
                .ruleta-modal-kiosko .modal-title {
                    color: #ffffff !important;
                    font-size: 1.25rem !important;
                    font-weight: 900 !important;
                    letter-spacing: -0.01em !important;
                }
                .ruleta-modal-kiosko .modal-subtitle {
                    color: #94a3b8 !important;
                    font-size: 0.8rem !important;
                }
                .ruleta-modal-kiosko .modal-close {
                    color: #94a3b8 !important;
                    background: rgba(255, 255, 255, 0.08) !important;
                    border: 1px solid rgba(255, 255, 255, 0.12) !important;
                    border-radius: 50% !important;
                    transition: all 0.2s ease !important;
                }
                .ruleta-modal-kiosko .modal-close:hover {
                    color: #ffffff !important;
                    background: rgba(56, 189, 248, 0.25) !important;
                    border-color: #38bdf8 !important;
                }
                .ruleta-modal-kiosko .modal-body {
                    padding: 1.5rem 1.6rem !important;
                    color: #f8fafc !important;
                }
            `}</style>

            {/* Canvas overlay para confeti de celebración */}
            <canvas
                ref={confettiCanvasRef}
                style={{
                    position: 'fixed',
                    inset: 0,
                    width: '100vw',
                    height: '100vh',
                    pointerEvents: 'none',
                    zIndex: 9999
                }}
            />

            {/* Cabecera Superior (Compacta y Optimizada Mobile Vertical) */}
            <header className="kiosko-header" style={{
                width: '100%',
                maxWidth: '1240px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.5rem',
                zIndex: 30
            }}>
                {/* Logo Oficial AFINIX DENTAL LAB (Versión Dark para Fondo Oscuro) */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <img
                        src={logoDark}
                        alt="AFINIX DENTAL LAB"
                        style={{
                            height: 'clamp(26px, 5.5vw, 36px)',
                            width: 'auto',
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 2px 10px rgba(56, 189, 248, 0.3))'
                        }}
                    />
                </div>

                {/* Acciones Superiores: Asignar Doctor, Pantalla Completa y Cerrar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <button
                        type="button"
                        className="btn btn-sm kiosko-header-btn"
                        onClick={() => setShowTurnModal(true)}
                        style={{
                            background: 'rgba(15, 23, 42, 0.65)',
                            border: '1px solid rgba(56, 189, 248, 0.45)',
                            backdropFilter: 'blur(10px)',
                            color: '#38bdf8',
                            borderRadius: '8px',
                            padding: '0.4rem 0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            boxShadow: '0 0 15px rgba(56, 189, 248, 0.2)'
                        }}
                        title="Asignar doctor o cambiar a modo stand"
                    >
                        <i className="bi bi-person-gear"></i>
                        <span>{participant.doctor_nombre ? 'Doctor' : 'Doctor / Modo'}</span>
                    </button>

                    <button
                        type="button"
                        className="btn btn-sm kiosko-header-btn"
                        onClick={toggleFullscreen}
                        title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                        style={{
                            background: 'rgba(15, 23, 42, 0.65)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            backdropFilter: 'blur(10px)',
                            color: '#ffffff',
                            borderRadius: '8px',
                            padding: '0.4rem 0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontWeight: 600,
                            fontSize: '0.8rem'
                        }}
                    >
                        <i className={`bi ${isFullscreen ? 'bi-fullscreen-exit' : 'bi-fullscreen'}`}></i>
                        <span className="kiosko-label-optional">{isFullscreen ? 'Salir' : 'Pantalla'}</span>
                    </button>

                    <button
                        type="button"
                        className="btn btn-sm kiosko-header-btn"
                        onClick={() => navigate('/marketing')}
                        style={{
                            background: 'rgba(15, 23, 42, 0.65)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            backdropFilter: 'blur(10px)',
                            color: '#ffffff',
                            borderRadius: '8px',
                            padding: '0.4rem 0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontWeight: 600,
                            fontSize: '0.8rem'
                        }}
                    >
                        <i className="bi bi-x-circle"></i>
                        <span className="kiosko-label-optional">Cerrar</span>
                    </button>
                </div>
            </header>

            {/* Centro de la Pantalla: Escenario Neón Holográfico con Ruleta (Distribución Equilibrada) */}
            <main style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-evenly',
                flex: 1,
                width: '100%',
                position: 'relative',
                zIndex: 10,
                padding: 'clamp(0.6rem, 2vh, 1.4rem) 0'
            }}>
                {/* Título Principal Tipográfico (Separado del puntero con aire superior) */}
                <h1 style={{
                    margin: 0,
                    fontSize: 'clamp(1.35rem, 3.2vw, 2.75rem)',
                    fontWeight: 900,
                    lineHeight: 1.16,
                    textAlign: 'center',
                    letterSpacing: '-0.02em',
                    color: '#ffffff',
                    textShadow: '0 4px 20px rgba(0, 0, 0, 0.85)'
                }}>
                    Premios y Beneficios <span style={{
                        color: '#38bdf8',
                        textShadow: '0 0 25px rgba(56, 189, 248, 0.85), 0 0 50px rgba(2, 132, 199, 0.7)'
                    }}>Exclusivos</span>
                    <br />
                    en Trabajos Dentales
                </h1>

                {/* Contenedor Ruleta con Borde Neón y Puntero (Centrado Perfecto con Ondas) */}
                <div style={{
                    position: 'relative',
                    width: 'var(--kiosko-wheel-size, 580px)',
                    height: 'var(--kiosko-wheel-size, 580px)',
                    margin: 'clamp(0.85rem, 2.4vh, 2.2rem) 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isSpinning ? 'wait' : 'pointer',
                    zIndex: 10
                }}
                onClick={handleSpin}
                >
                    {/* Ondas y Anillos Orbitales Neón de Fondo (100% Concéntricos con el Buje y la Ruleta) */}
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '158%',
                        height: '158%',
                        pointerEvents: 'none',
                        zIndex: 1
                    }}>
                        {/* Resplandor Neón Central Pulsante */}
                        <div style={{
                            position: 'absolute',
                            inset: '10%',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(2, 132, 199, 0.45) 0%, rgba(56, 189, 248, 0.18) 45%, transparent 70%)',
                            filter: 'blur(30px)',
                            animation: 'ruletaPulseGlow 4s infinite ease-in-out'
                        }} />

                        {/* Anillo Orbital Exterior con Rotación Suave Continua */}
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: '50%',
                            border: '1px solid rgba(56, 189, 248, 0.22)',
                            boxShadow: '0 0 25px rgba(56, 189, 248, 0.08)',
                            animation: 'orbitalSlowRotate 60s linear infinite'
                        }}>
                            {/* Nodos de luz orbital */}
                            <div style={{ position: 'absolute', top: '15%', left: '8%', width: '7px', height: '7px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 10px #38bdf8' }} />
                            <div style={{ position: 'absolute', bottom: '22%', right: '9%', width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8' }} />
                        </div>

                        {/* Anillo Orbital Medio Delineado con Rotación Inversa */}
                        <div style={{
                            position: 'absolute',
                            inset: '9.5%',
                            borderRadius: '50%',
                            border: '1px dashed rgba(56, 189, 248, 0.35)',
                            boxShadow: '0 0 20px rgba(56, 189, 248, 0.15)',
                            animation: 'orbitalReverseRotate 45s linear infinite'
                        }}>
                            <div style={{ position: 'absolute', top: '50%', right: '-4px', width: '8px', height: '8px', borderRadius: '50%', background: '#ffffff', border: '2px solid #38bdf8', boxShadow: '0 0 10px #38bdf8' }} />
                            <div style={{ position: 'absolute', top: '50%', left: '-4px', width: '8px', height: '8px', borderRadius: '50%', background: '#ffffff', border: '2px solid #38bdf8', boxShadow: '0 0 10px #38bdf8' }} />
                        </div>

                        {/* Anillo Orbital Interior con Arco Neón */}
                        <div style={{
                            position: 'absolute',
                            inset: '17%',
                            borderRadius: '50%',
                            border: '1.5px solid rgba(56, 189, 248, 0.45)',
                            boxShadow: '0 0 25px rgba(56, 189, 248, 0.25)'
                        }} />
                    </div>

                    {/* Borde Neón Perimetral Externo de la Ruleta (Efecto Dinámico al Girar) */}
                    <div style={{
                        position: 'absolute',
                        inset: '-10px',
                        borderRadius: '50%',
                        border: '3px solid #38bdf8',
                        boxShadow: isSpinning
                            ? '0 0 45px #00d4ff, 0 0 95px rgba(2, 132, 199, 0.95), inset 0 0 28px rgba(56, 189, 248, 0.85)'
                            : '0 0 28px #00d4ff, 0 0 65px rgba(2, 132, 199, 0.8), inset 0 0 22px rgba(56, 189, 248, 0.55)',
                        pointerEvents: 'none',
                        transition: 'box-shadow 0.3s ease',
                        zIndex: 20
                    }} />

                    {/* Puntero Superior estilo Pin de Mapa con Vibración Mecánica al Girar */}
                    <svg width="44" height="54" viewBox="0 0 34 42" fill="none" style={{
                        position: 'absolute',
                        top: '-24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        transformOrigin: 'top center',
                        zIndex: 35,
                        filter: 'drop-shadow(0 0 16px rgba(56, 189, 248, 0.95)) drop-shadow(0 4px 10px rgba(0,0,0,0.6))',
                        animation: isSpinning ? 'pointerSpinWobble 0.08s infinite ease-in-out' : 'none',
                        pointerEvents: 'none'
                    }}>
                        <path
                            d="M 17 40 C 11.5 29 3 22 3 15 A 14 14 0 1 1 31 15 C 31 22 22.5 29 17 40 Z"
                            fill="url(#pointerKioskoGrad)"
                            stroke="#ffffff"
                            strokeWidth="2.5"
                        />
                        <circle cx="17" cy="14" r="4.5" fill="#ffffff" />
                        <defs>
                            <linearGradient id="pointerKioskoGrad" x1="17" y1="2" x2="17" y2="40" gradientUnits="userSpaceOnUse">
                                <stop stopColor="#38bdf8" />
                                <stop offset="1" stopColor="#0284c7" />
                            </linearGradient>
                        </defs>
                    </svg>

                    {/* Canvas de la Ruleta (640x640 para nitidez Retina / 4K) */}
                    <canvas
                        ref={canvasRef}
                        width={640}
                        height={640}
                        style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: '50%',
                            transition: 'transform 0.2s ease',
                            zIndex: 10
                        }}
                    />

                    {/* Onda Radar Sonar expansiva invitando al Play */}
                    {!isSpinning && (
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '22%',
                            height: '22%',
                            borderRadius: '50%',
                            border: '2px solid rgba(56, 189, 248, 0.75)',
                            boxShadow: '0 0 16px rgba(56, 189, 248, 0.5)',
                            pointerEvents: 'none',
                            zIndex: 22,
                            animation: 'sonarRadarWave 2.4s infinite cubic-bezier(0.1, 0.8, 0.25, 1)'
                        }} />
                    )}

                    {/* Buje Central Claro Neón con Isotipo AFINIX DENTAL LAB (Desktop y Mobile) */}
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '22%',
                        height: '22%',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle at 35% 35%, #ffffff 0%, #f8fafc 55%, #e2e8f0 100%)',
                        border: '3.5px solid #0284c7',
                        boxShadow: isSpinning
                            ? '0 0 35px rgba(56, 189, 248, 1), 0 0 65px rgba(2, 132, 199, 0.75), inset 0 2px 5px #ffffff, inset 0 -3px 8px rgba(15, 23, 42, 0.18)'
                            : '0 0 26px rgba(56, 189, 248, 0.75), 0 6px 20px rgba(0, 0, 0, 0.35), inset 0 2px 5px #ffffff, inset 0 -3px 8px rgba(15, 23, 42, 0.14)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 25,
                        pointerEvents: 'none',
                        transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
                        animation: isSpinning ? 'none' : 'ruletaPulseCenter 2.5s infinite ease-in-out'
                    }}>
                        <img
                            src={isoLight}
                            alt="AFINIX DENTAL LAB"
                            style={{
                                width: '64%',
                                height: 'auto',
                                objectFit: 'contain',
                                filter: 'drop-shadow(0 2px 6px rgba(2, 132, 199, 0.3))',
                                userSelect: 'none',
                                pointerEvents: 'none',
                                transition: 'transform 0.25s ease'
                            }}
                        />
                    </div>
                </div>

                {/* Llamado a la acción inferior con brillo y respiración (Separado de la ruleta) */}
                <div style={{
                    margin: 0,
                    textAlign: 'center',
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                }}>
                    <button
                        type="button"
                        className="btn"
                        onClick={handleSpin}
                        disabled={isSpinning || loadingPremios}
                        style={{
                            position: 'relative',
                            overflow: 'hidden',
                            padding: 'clamp(0.8rem, 2vh, 1.15rem) clamp(2rem, 5vw, 3.4rem)',
                            fontSize: 'clamp(1.05rem, 2.4vw, 1.35rem)',
                            fontWeight: 800,
                            borderRadius: '44px',
                            background: 'linear-gradient(90deg, #0284c7 0%, #0ea5e9 50%, #0284c7 100%)',
                            border: '2px solid #38bdf8',
                            boxShadow: '0 0 35px rgba(14, 165, 233, 0.6), 0 8px 25px rgba(0, 0, 0, 0.5)',
                            color: '#ffffff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            maxWidth: '92vw',
                            cursor: isSpinning ? 'wait' : 'pointer',
                            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                            animation: isSpinning ? 'none' : 'ctaPulseBreath 2.8s infinite ease-in-out'
                        }}
                    >
                        {/* Brillo dinámico transversal barriendo el botón */}
                        {!isSpinning && (
                            <span style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '60%',
                                height: '100%',
                                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
                                pointerEvents: 'none',
                                animation: 'ctaSheenSweep 3.6s infinite linear'
                            }} />
                        )}

                        {isSpinning ? (
                            <>
                                <span className="spinner-border spinner-border-sm" role="status"></span>
                                Girando la Suerte...
                            </>
                        ) : (
                            <>
                                <span style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '50%',
                                    background: '#ffffff',
                                    color: '#0284c7',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1rem',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                    animation: 'playBadgePulse 2s infinite ease-in-out'
                                }}>
                                    <i className="bi bi-play-fill" style={{ marginLeft: '2px' }}></i>
                                </span>
                                ¡Haz Clic para Girar Ahora!
                            </>
                        )}
                    </button>
                </div>
            </main>

            {/* Footer */}
            <footer style={{
                textAlign: 'center',
                fontSize: 'clamp(0.66rem, 2.2vw, 0.78rem)',
                color: '#64748b',
                padding: 'clamp(0.3rem, 0.8vh, 0.5rem) 0',
                zIndex: 20
            }}>
                AFINIX DENTAL LAB S.A.C. · RUC 20616033973 · Calle Piura 316, Mariano Melgar, Arequipa
            </footer>

            {/* Modal de Victoria / Ticket de 6 Dígitos con Estética Neón Kiosko */}
            <Modal
                open={showResultModal && Boolean(spinResult)}
                onClose={() => setShowResultModal(false)}
                title={spinResult?.premio?.tipo_premio === 'sin_premio' ? '¡Estuviste muy Cerca!' : '¡FELICITACIONES!'}
                subtitle={spinResult?.premio?.tipo_premio === 'sin_premio' ? undefined : 'AFINIX DENTAL LAB S.A.C. · Beneficio Comercial'}
                icon={spinResult?.premio?.tipo_premio === 'sin_premio' ? 'bi-bullseye' : 'bi-trophy-fill'}
                className="ruleta-modal-kiosko"
                size="md"
            >
                {spinResult && (
                    spinResult.premio.tipo_premio === 'sin_premio' ? (
                        /* CASO A: SIGUE INTENTANDO (CONCISO Y SIN REDUNDANCIA) */
                        <div style={{ textAlign: 'center', padding: '0.2rem 0' }}>
                            {/* Halo de Ícono Neón / Diana */}
                            <div style={{
                                width: '74px',
                                height: '74px',
                                borderRadius: '50%',
                                background: 'radial-gradient(circle, rgba(56, 189, 248, 0.22) 0%, rgba(2, 132, 199, 0.06) 70%)',
                                border: '2px solid rgba(56, 189, 248, 0.55)',
                                boxShadow: '0 0 30px rgba(56, 189, 248, 0.35)',
                                color: '#38bdf8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1rem',
                                fontSize: '2.2rem'
                            }}>
                                <i className="bi bi-arrow-repeat" style={{ animation: 'spinSlow 12s linear infinite' }}></i>
                            </div>

                            {/* Tarjeta Glassmorphic de Resultado */}
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.75) 0%, rgba(30, 41, 59, 0.55) 100%)',
                                border: '1.5px dashed rgba(56, 189, 248, 0.35)',
                                borderRadius: '18px',
                                padding: '1.25rem 1.25rem',
                                marginBottom: '1.25rem',
                                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35), inset 0 0 20px rgba(56, 189, 248, 0.04)'
                            }}>
                                <div style={{
                                    fontSize: '1.8rem',
                                    fontWeight: 900,
                                    color: '#ffffff',
                                    margin: '0 0 0.4rem',
                                    letterSpacing: '-0.02em',
                                    textShadow: '0 2px 16px rgba(56, 189, 248, 0.6)'
                                }}>
                                    {spinResult.premio.titulo || 'Sigue Intentando'}
                                </div>

                                <p style={{
                                    fontSize: '0.92rem',
                                    margin: 0,
                                    color: '#cbd5e1',
                                    lineHeight: 1.45
                                }}>
                                    ¡Estuviste muy cerca! Vuelve a probar tu suerte.
                                </p>
                            </div>

                            {/* Botón de Revancha / Girar de Nuevo */}
                            <button
                                type="button"
                                className="btn"
                                onClick={() => {
                                    setShowResultModal(false);
                                    setSpinResult(null);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '0.8rem 1.5rem',
                                    fontWeight: 800,
                                    fontSize: '1.05rem',
                                    borderRadius: '12px',
                                    background: 'linear-gradient(90deg, #0284c7 0%, #0ea5e9 100%)',
                                    border: '1.5px solid #38bdf8',
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.6rem',
                                    boxShadow: '0 0 25px rgba(14, 165, 233, 0.55), 0 6px 20px rgba(0, 0, 0, 0.4)',
                                    cursor: 'pointer',
                                    transition: 'transform 0.15s ease'
                                }}
                            >
                                <i className="bi bi-arrow-repeat" style={{ fontSize: '1.2rem' }}></i>
                                ¡Volver a Girar!
                            </button>
                        </div>
                    ) : (
                        /* CASO B: GANAR PREMIO (WIN CELEBRATION STATE) */
                        <div style={{ textAlign: 'center', padding: '0.2rem 0' }}>
                            {/* Halo Neón Dorado / Trofeo de la Victoria */}
                            <div style={{
                                width: '84px',
                                height: '84px',
                                borderRadius: '50%',
                                background: 'radial-gradient(circle, rgba(251, 191, 36, 0.28) 0%, rgba(16, 185, 129, 0.12) 70%)',
                                border: '2px solid rgba(251, 191, 36, 0.75)',
                                boxShadow: '0 0 35px rgba(251, 191, 36, 0.5), inset 0 0 15px rgba(251, 191, 36, 0.2)',
                                color: '#fbbf24',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1.25rem',
                                fontSize: '2.5rem'
                            }}>
                                <i className="bi bi-gift-fill"></i>
                            </div>

                            {/* Tarjeta Holográfica de Cupón Ganador */}
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(8, 47, 73, 0.85) 100%)',
                                border: '2px dashed #38bdf8',
                                borderRadius: '20px',
                                padding: '1.4rem 1.25rem',
                                marginBottom: '1.25rem',
                                boxShadow: '0 0 35px rgba(56, 189, 248, 0.25), inset 0 0 25px rgba(56, 189, 248, 0.06)'
                            }}>
                                <div style={{
                                    fontSize: '0.74rem',
                                    fontWeight: 800,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.12em',
                                    color: '#38bdf8'
                                }}>
                                    AFINIX LAB · BENEFICIO EXCLUSIVO
                                </div>

                                <div style={{
                                    fontSize: '2.2rem',
                                    fontWeight: 900,
                                    color: '#38bdf8',
                                    margin: '0.45rem 0 0.25rem',
                                    letterSpacing: '-0.02em',
                                    textShadow: '0 0 25px rgba(56, 189, 248, 0.75)'
                                }}>
                                    {spinResult.premio.titulo}
                                </div>

                                <p style={{
                                    fontSize: '0.88rem',
                                    margin: '0 0 1rem',
                                    color: '#cbd5e1',
                                    lineHeight: 1.45
                                }}>
                                    {spinResult.premio.descripcion || 'Beneficio comercial aplicable directamente en tu próxima orden técnica de laboratorio.'}
                                </p>


                                {/* Cápsula Glassmorphic / Neón de Código de 6 Dígitos */}
                                {spinResult.codigo_descuento && (
                                    <div style={{
                                        marginTop: '0.85rem',
                                        padding: '0.9rem 1rem',
                                        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.72) 0%, rgba(15, 23, 42, 0.88) 100%)',
                                        border: '1px solid rgba(56, 189, 248, 0.45)',
                                        borderRadius: '14px',
                                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1), inset 0 0 16px rgba(56, 189, 248, 0.08)',
                                        backdropFilter: 'blur(10px)'
                                    }}>
                                        <div style={{
                                            fontSize: '0.72rem',
                                            fontWeight: 800,
                                            color: '#94a3b8',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.12em'
                                        }}>
                                            Código de Descuento (6 Dígitos)
                                        </div>

                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.75rem',
                                            marginTop: '0.4rem',
                                            marginBottom: '0.4rem'
                                        }}>
                                            <code style={{
                                                fontSize: '1.85rem',
                                                fontWeight: 900,
                                                color: '#38bdf8',
                                                fontFamily: '"JetBrains Mono", Consolas, monospace',
                                                letterSpacing: '0.2em',
                                                textShadow: '0 0 14px rgba(56, 189, 248, 0.7)'
                                            }}>
                                                {spinResult.codigo_descuento}
                                            </code>

                                            <button
                                                type="button"
                                                onClick={() => copyCode(spinResult.codigo_descuento)}
                                                title="Copiar código al portapapeles"
                                                style={{
                                                    padding: '0.42rem 0.8rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.35rem',
                                                    fontWeight: 700,
                                                    fontSize: '0.8rem',
                                                    borderRadius: '8px',
                                                    background: copiedCode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.14)',
                                                    border: copiedCode ? '1px solid rgba(16, 185, 129, 0.6)' : '1px solid rgba(56, 189, 248, 0.45)',
                                                    color: copiedCode ? '#34d399' : '#38bdf8',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    boxShadow: copiedCode ? '0 0 10px rgba(16, 185, 129, 0.25)' : 'none'
                                                }}
                                            >
                                                <i className={`bi ${copiedCode ? 'bi-check-lg' : 'bi-clipboard'}`}></i>
                                                <span>{copiedCode ? 'Copiado' : 'Copiar'}</span>
                                            </button>
                                        </div>

                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'center',
                                            flexWrap: 'wrap',
                                            gap: '0.85rem',
                                            marginTop: '0.5rem',
                                            fontSize: '0.73rem',
                                            color: '#94a3b8'
                                        }}>
                                            <span><i className="bi bi-clock-history" style={{ color: '#38bdf8' }}></i> Vigencia: <strong style={{ color: '#e2e8f0' }}>30 días</strong></span>
                                            <span><i className="bi bi-check-circle-fill" style={{ color: '#10b981' }}></i> <strong style={{ color: '#e2e8f0' }}>1 solo producto por orden</strong></span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Acciones del Cupón: WhatsApp e Imprimir en una sola fila compacta */}
                            {spinResult.codigo_descuento && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'stretch',
                                    gap: '0.5rem',
                                    marginTop: '0.85rem',
                                    marginBottom: '0.75rem',
                                    flexWrap: 'nowrap'
                                }}>
                                    {participant.doctor_telefono ? (
                                        /* Caso 1: Doctor con teléfono asignado */
                                        <button
                                            type="button"
                                            onClick={() => sendWhatsApp(participant.doctor_telefono)}
                                            style={{
                                                flex: 1,
                                                background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                                                border: '1px solid rgba(37, 211, 102, 0.5)',
                                                color: '#ffffff',
                                                fontWeight: 700,
                                                fontSize: '0.88rem',
                                                padding: '0.65rem 0.85rem',
                                                borderRadius: '10px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.45rem',
                                                boxShadow: '0 4px 14px rgba(37, 211, 102, 0.35)',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <i className="bi bi-whatsapp" style={{ fontSize: '1.05rem' }}></i>
                                            <span>Enviar a WhatsApp</span>
                                        </button>
                                    ) : (
                                        /* Caso 2: Modo Stand / Sin teléfono registrado: Input integrado + Botón Enviar */
                                        <div style={{
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            background: 'rgba(15, 23, 42, 0.75)',
                                            border: '1px solid rgba(56, 189, 248, 0.35)',
                                            borderRadius: '10px',
                                            padding: '2px 4px 2px 8px',
                                            gap: '0.35rem'
                                        }}>
                                            <i className="bi bi-whatsapp" style={{ color: '#25D366', fontSize: '0.95rem' }}></i>
                                            <input
                                                type="tel"
                                                placeholder="WhatsApp (ej. 958123456)"
                                                value={instantPhone}
                                                onChange={(e) => setInstantPhone(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        sendWhatsApp(instantPhone);
                                                    }
                                                }}
                                                style={{
                                                    flex: 1,
                                                    minWidth: 0,
                                                    background: 'transparent',
                                                    border: 'none',
                                                    outline: 'none',
                                                    color: '#ffffff',
                                                    fontSize: '0.82rem',
                                                    fontWeight: 600,
                                                    padding: '0.45rem 0.2rem'
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => sendWhatsApp(instantPhone)}
                                                style={{
                                                    background: '#25D366',
                                                    border: 'none',
                                                    color: '#ffffff',
                                                    fontWeight: 700,
                                                    fontSize: '0.78rem',
                                                    padding: '0.45rem 0.75rem',
                                                    borderRadius: '7px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.3rem',
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap',
                                                    boxShadow: '0 2px 8px rgba(37, 211, 102, 0.35)'
                                                }}
                                            >
                                                <span>Enviar</span>
                                                <i className="bi bi-send-fill" style={{ fontSize: '0.72rem' }}></i>
                                            </button>
                                        </div>
                                    )}

                                    {/* Botón de Imprimir Ticket Compacto al Lado */}
                                    <button
                                        type="button"
                                        onClick={handlePrintTicket}
                                        title="Imprimir ticket térmico para el cliente"
                                        style={{
                                            background: 'rgba(30, 41, 59, 0.85)',
                                            border: '1px solid rgba(148, 163, 184, 0.35)',
                                            color: '#e2e8f0',
                                            fontWeight: 700,
                                            fontSize: '0.82rem',
                                            padding: '0.65rem 0.85rem',
                                            borderRadius: '10px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.4rem',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <i className="bi bi-printer" style={{ fontSize: '0.95rem', color: '#38bdf8' }}></i>
                                        <span>Imprimir</span>
                                    </button>
                                </div>
                            )}

                            {/* Botón Siguiente Giro */}
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => {
                                    setShowResultModal(false);
                                    setSpinResult(null);
                                    setInstantPhone('');
                                }}
                                style={{
                                    width: '100%',
                                    fontWeight: 800,
                                    fontSize: '1rem',
                                    padding: '0.8rem',
                                    borderRadius: '12px',
                                    background: 'linear-gradient(90deg, #0284c7 0%, #0ea5e9 100%)',
                                    border: '1px solid #38bdf8',
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    boxShadow: '0 4px 18px rgba(2, 132, 199, 0.4)'
                                }}
                            >
                                <i className="bi bi-arrow-repeat"></i>
                                ¡Siguiente Giro / Continuar!
                            </button>
                        </div>
                    )
                )}
            </Modal>

            {/* Modal de Asignación Rápida de Turno (Lógica 2: Modo Stand vs Visita Médica) */}
            <Modal
                open={showTurnModal}
                onClose={() => setShowTurnModal(false)}
                title="Configuración de Turno de Ruleta"
                subtitle="Elige la modalidad para registrar giros sin salir de pantalla completa"
                icon="bi-person-gear"
                size="md"
            >
                <div>
                    {/* Selector de Modalidad (Pestañas estilo Pill) */}
                    <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        marginBottom: '1.25rem',
                        background: 'var(--color-bg-alt, #f1f5f9)',
                        padding: '0.35rem',
                        borderRadius: '10px'
                    }}>
                        <button
                            type="button"
                            onClick={() => setTurnTab('stand')}
                            className={`btn btn-sm ${turnTab === 'stand' ? 'btn-primary' : 'btn-ghost'}`}
                            style={{
                                flex: 1,
                                fontWeight: 700,
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.4rem'
                            }}
                        >
                            <i className="bi bi-stars"></i>
                            Modo Stand / Feria
                        </button>

                        <button
                            type="button"
                            onClick={() => setTurnTab('doctor')}
                            className={`btn btn-sm ${turnTab === 'doctor' ? 'btn-primary' : 'btn-ghost'}`}
                            style={{
                                flex: 1,
                                fontWeight: 700,
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.4rem'
                            }}
                        >
                            <i className="bi bi-person-fill"></i>
                            Visita Médica (Doctor)
                        </button>
                    </div>

                    {/* VISTA 1: MODO STAND / FERIA DENTAL */}
                    {turnTab === 'stand' && (
                        <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '50%',
                                background: 'rgba(16, 185, 129, 0.12)',
                                color: '#10b981',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '2rem',
                                margin: '0 auto 1rem'
                            }}>
                                <i className="bi bi-stars"></i>
                            </div>

                            <h4 style={{ margin: '0 0 0.5rem', fontWeight: 800 }}>Modo Stand / Feria Dental</h4>
                            <p style={{ fontSize: '0.88rem', color: '#64748b', maxWidth: '380px', margin: '0 auto 1.25rem', lineHeight: 1.45 }}>
                                Los doctores giran libremente sin necesidad de registro previo. Si ganan un cupón de descuento, podrán ingresar su número de WhatsApp en la misma pantalla para recibir el código.
                            </p>

                            <button
                                type="button"
                                className="btn btn-success"
                                onClick={handleApplyStandMode}
                                style={{
                                    width: '100%',
                                    padding: '0.8rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    backgroundColor: '#10b981',
                                    borderColor: '#10b981',
                                    color: '#ffffff',
                                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
                                }}
                            >
                                <i className="bi bi-check2-circle"></i>
                                Activar Modo Stand (Giro Libre)
                            </button>
                        </div>
                    )}

                    {/* VISTA 2: VISITA MÉDICA (DOCTOR / CLÍNICA ESPECÍFICA) */}
                    {turnTab === 'doctor' && (
                        <form onSubmit={handleSaveDoctorTurn}>
                            <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                    Nombre del Doctor(a) *
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Ej. Dr. Carlos Valdivia"
                                    value={doctorForm.doctor_nombre}
                                    onChange={(e) => setDoctorForm(prev => ({ ...prev, doctor_nombre: e.target.value }))}
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                    Clínica / Consultorio (Asignación)
                                </label>
                                <CustomSelect
                                    id="ruleta-kiosko-clinica-id"
                                    options={clinicOptions}
                                    value={doctorForm.clinica_id ? String(doctorForm.clinica_id) : ''}
                                    onChange={(_, val) => setDoctorForm(prev => ({ ...prev, clinica_id: val }))}
                                    placeholder="Buscar clínica o consultorio..."
                                    searchable
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                    Teléfono / WhatsApp (para entrega del cupón)
                                </label>
                                <input
                                    type="tel"
                                    className="form-input"
                                    placeholder="Ej. 958123456"
                                    value={doctorForm.doctor_telefono}
                                    onChange={(e) => setDoctorForm(prev => ({ ...prev, doctor_telefono: e.target.value }))}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                    Motivo o Evento
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Ej. Visita Comercial / Presentación Nuevos Materiales"
                                    value={doctorForm.evento_nombre}
                                    onChange={(e) => setDoctorForm(prev => ({ ...prev, evento_nombre: e.target.value }))}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    onClick={() => setShowTurnModal(false)}
                                    style={{ flex: 1, fontWeight: 600 }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{ flex: 2, fontWeight: 700 }}
                                >
                                    <i className="bi bi-person-check-fill" style={{ marginRight: '0.4rem' }}></i>
                                    Guardar y Asignar Turno
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </Modal>
        </div>
    );
}
