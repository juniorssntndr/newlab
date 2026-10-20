import { chromium } from 'file:///D:/Archivos personales/Codigo/NEWLAB/.agents/skills/playwright-skill/node_modules/playwright-core/index.mjs';

async function testCanvas() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { background: #070e1e; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: 'Inter', system-ui, -apple-system, sans-serif; }
                .wheel-container { position: relative; width: 500px; height: 500px; }
                canvas { width: 100%; height: 100%; border-radius: 50%; }
            </style>
        </head>
        <body>
            <div class="wheel-container">
                <canvas id="c" width="700" height="700"></canvas>
            </div>
            <script>
                const canvas = document.getElementById('c');
                const ctx = canvas.getContext('2d');
                const width = 700;
                const height = 700;
                const centerX = 350;
                const centerY = 350;
                const radius = 290;

                const sectors = [
                    { monto: 'S/. 100', tipo: 'monto_fijo', icon: '🏆' },
                    { monto: '', tipo: 'sin_premio', icon: '🍍' },
                    { monto: 'S/. 30', tipo: 'monto_fijo', icon: '💰' },
                    { monto: '', tipo: 'sin_premio', icon: '🍍' },
                    { monto: 'S/. 50', tipo: 'monto_fijo', icon: '🎉' },
                    { monto: '', tipo: 'sin_premio', icon: '🍍' },
                    { monto: 'S/. 30', tipo: 'monto_fijo', icon: '💰' },
                    { monto: '', tipo: 'sin_premio', icon: '🍍' },
                    { monto: 'S/. 50', tipo: 'monto_fijo', icon: '🎉' },
                    { monto: '', tipo: 'sin_premio', icon: '🍍' },
                    { monto: 'S/. 30', tipo: 'monto_fijo', icon: '💰' },
                    { monto: '', tipo: 'sin_premio', icon: '🍍' }
                ];

                const num = sectors.length;
                const arc = (2 * Math.PI) / num;
                const angle = 0;

                // 1. Halo exterior brillante de profundidad
                ctx.save();
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius + 22, 0, 2 * Math.PI);
                const haloGrad = ctx.createRadialGradient(centerX, centerY, radius - 10, centerX, centerY, radius + 24);
                haloGrad.addColorStop(0, 'rgba(2, 132, 199, 0.4)');
                haloGrad.addColorStop(0.7, 'rgba(56, 189, 248, 0.2)');
                haloGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
                ctx.fillStyle = haloGrad;
                ctx.fill();

                // 2. Anillo exterior marco sólido AFINIX
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius + 14, 0, 2 * Math.PI);
                ctx.fillStyle = '#0f172a';
                ctx.fill();
                ctx.lineWidth = 3.5;
                ctx.strokeStyle = '#38bdf8';
                ctx.stroke();

                // Aro base azul cobalto con bisel
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius + 5, 0, 2 * Math.PI);
                ctx.fillStyle = '#0284c7';
                ctx.fill();
                ctx.lineWidth = 2.5;
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();
                ctx.restore();

                // Función para dibujar piña vectorial simétrica y alineada al radio
                function drawSymmetricPineapple(ctx, size) {
                    ctx.save();
                    const w = size * 0.52;
                    const h = size * 0.70;

                    // 1. Corona de hojas tropicales (apuntando hacia el borde exterior en x > 0)
                    ctx.save();
                    ctx.fillStyle = '#10b981';
                    ctx.strokeStyle = '#047857';
                    ctx.lineWidth = 1.2;

                    // Hoja central (alta)
                    ctx.beginPath();
                    ctx.moveTo(-h * 0.35, 0);
                    ctx.quadraticCurveTo(-h * 0.7, -w * 0.15, -h * 0.95, 0);
                    ctx.quadraticCurveTo(-h * 0.7, w * 0.15, -h * 0.35, 0);
                    ctx.fill();
                    ctx.stroke();

                    // Hoja lateral superior
                    ctx.beginPath();
                    ctx.moveTo(-h * 0.32, -w * 0.1);
                    ctx.quadraticCurveTo(-h * 0.65, -w * 0.45, -h * 0.82, -w * 0.5);
                    ctx.quadraticCurveTo(-h * 0.52, -w * 0.2, -h * 0.3, 0);
                    ctx.fill();
                    ctx.stroke();

                    // Hoja lateral inferior
                    ctx.beginPath();
                    ctx.moveTo(-h * 0.32, w * 0.1);
                    ctx.quadraticCurveTo(-h * 0.65, w * 0.45, -h * 0.82, w * 0.5);
                    ctx.quadraticCurveTo(-h * 0.52, w * 0.2, -h * 0.3, 0);
                    ctx.fill();
                    ctx.stroke();
                    ctx.restore();

                    // 2. Cuerpo de la piña (óvalo dorado texturado)
                    ctx.save();
                    ctx.beginPath();
                    ctx.ellipse(h * 0.18, 0, h * 0.46, w * 0.48, 0, 0, 2 * Math.PI);
                    const grad = ctx.createLinearGradient(-h * 0.3, 0, h * 0.6, 0);
                    grad.addColorStop(0, '#fde047');
                    grad.addColorStop(0.45, '#f59e0b');
                    grad.addColorStop(1, '#d97706');
                    ctx.fillStyle = grad;
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
                    ctx.shadowBlur = 6;
                    ctx.fill();
                    ctx.lineWidth = 1.5;
                    ctx.strokeStyle = '#b45309';
                    ctx.stroke();

                    // Textura de escamas romboidales
                    ctx.clip();
                    ctx.strokeStyle = 'rgba(180, 83, 9, 0.45)';
                    ctx.lineWidth = 1.2;
                    for (let off = -h; off <= h * 1.5; off += w * 0.28) {
                        ctx.beginPath();
                        ctx.moveTo(off, -w);
                        ctx.lineTo(off + w, w);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(off + w, -w);
                        ctx.lineTo(off, w);
                        ctx.stroke();
                    }
                    ctx.restore();

                    ctx.restore();
                }

                // Dibujar sectores alternados (Azul AFINIX y Blanco)
                sectors.forEach((s, i) => {
                    const startAngle = angle + i * arc;
                    const endAngle = startAngle + arc;
                    const isPrize = s.tipo !== 'sin_premio';

                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(centerX, centerY);
                    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
                    ctx.closePath();

                    if (isPrize) {
                        // Degradado rico azul AFINIX
                        const grad = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius);
                        grad.addColorStop(0, '#0284c7');
                        grad.addColorStop(1, '#0369a1');
                        ctx.fillStyle = grad;
                    } else {
                        // Blanco esmaltado limpio
                        const grad = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius);
                        grad.addColorStop(0, '#ffffff');
                        grad.addColorStop(1, '#f8fafc');
                        ctx.fillStyle = grad;
                    }
                    ctx.fill();
                    ctx.lineWidth = 2.5;
                    ctx.strokeStyle = '#ffffff';
                    ctx.stroke();

                    // Orientación radial del contenido
                    ctx.translate(centerX, centerY);
                    ctx.rotate(startAngle + arc / 2);

                    if (isPrize) {
                        // SECTOR CON PREMIO
                        // 1. Monto en grande pegado al borde exterior
                        const dist = radius * 0.77;
                        ctx.translate(dist, 0);
                        ctx.rotate(Math.PI / 2); // perpendicular al radio para lectura natural

                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.font = '900 20px system-ui, -apple-system, sans-serif';
                        ctx.fillStyle = '#ffffff';
                        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                        ctx.shadowBlur = 4;
                        ctx.fillText(s.monto, 0, -18);

                        // 2. Badge cápsula "DESCUENTO"
                        ctx.shadowBlur = 0;
                        const badgeW = 68;
                        const badgeH = 15;
                        const bx = -badgeW / 2;
                        const by = -6;

                        ctx.save();
                        ctx.beginPath();
                        ctx.roundRect(bx, by, badgeW, badgeH, 7);
                        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
                        ctx.fill();
                        ctx.lineWidth = 1;
                        ctx.strokeStyle = '#38bdf8';
                        ctx.stroke();

                        ctx.font = '800 9px system-ui, sans-serif';
                        ctx.fillStyle = '#e0f2fe';
                        ctx.letterSpacing = '0.06em';
                        ctx.fillText('DESCUENTO', 0, by + badgeH / 2 + 1);
                        ctx.restore();

                        // 3. Ícono del premio abajo hacia el centro
                        ctx.font = '22px system-ui, sans-serif';
                        ctx.fillText(s.icon, 0, 22);
                    } else {
                        // SECTOR PIÑA: Totalmente centrado en el eje radial
                        // Apuntando con hojas hacia afuera y cuerpo hacia adentro, sin texto
                        const dist = radius * 0.62;
                        ctx.translate(dist, 0);
                        // Hojas hacia afuera (+X es hacia afuera, pero drawSymmetricPineapple dibuja hojas en -X, así que rotamos PI para que hojas apunten afuera)
                        ctx.rotate(Math.PI);

                        drawSymmetricPineapple(ctx, 52);
                    }

                    ctx.restore();
                });

                // Pines luminosos exteriores estilo AFINIX
                for (let i = 0; i < num * 2; i++) {
                    const pinAngle = angle + (i * Math.PI) / num;
                    const pinX = centerX + Math.cos(pinAngle) * (radius + 9);
                    const pinY = centerY + Math.sin(pinAngle) * (radius + 9);

                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(pinX, pinY, 4.5, 0, 2 * Math.PI);
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowColor = '#38bdf8';
                    ctx.shadowBlur = 12;
                    ctx.fill();
                    ctx.lineWidth = 1.5;
                    ctx.strokeStyle = '#38bdf8';
                    ctx.stroke();
                    ctx.restore();
                }

                // Centro / Buje BLANCO Esmaltado Oficial AFINIX
                const hubRadius = Math.round(radius * 0.22);
                ctx.save();
                ctx.beginPath();
                ctx.arc(centerX, centerY, hubRadius, 0, 2 * Math.PI);
                const hubGrad = ctx.createRadialGradient(centerX - 10, centerY - 10, 5, centerX, centerY, hubRadius);
                hubGrad.addColorStop(0, '#ffffff');
                hubGrad.addColorStop(0.7, '#f8fafc');
                hubGrad.addColorStop(1, '#e2e8f0');
                ctx.fillStyle = hubGrad;
                ctx.shadowColor = 'rgba(2, 132, 199, 0.45)';
                ctx.shadowBlur = 18;
                ctx.fill();
                ctx.lineWidth = 5;
                ctx.strokeStyle = '#0284c7';
                ctx.stroke();

                // Aro interno celeste
                ctx.beginPath();
                ctx.arc(centerX, centerY, hubRadius - 6, 0, 2 * Math.PI);
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = '#bae6fd';
                ctx.stroke();

                ctx.shadowBlur = 0;
                ctx.fillStyle = '#0f172a';
                ctx.font = '900 16px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('AFINIX', centerX, centerY - 7);
                ctx.font = '800 11px system-ui, sans-serif';
                ctx.fillStyle = '#0284c7';
                ctx.fillText('LAB', centerX, centerY + 10);
                ctx.restore();

                // Puntero superior estilo pin de mapa
                ctx.save();
                ctx.translate(centerX, centerY - radius - 10);
                ctx.beginPath();
                ctx.moveTo(0, 22);
                ctx.bezierCurveTo(-16, 2, -20, -14, -20, -28);
                ctx.arc(0, -28, 20, Math.PI, 0, false);
                ctx.bezierCurveTo(20, -14, 16, 2, 0, 22);
                ctx.closePath();
                const pinGrad = ctx.createLinearGradient(0, -48, 0, 22);
                pinGrad.addColorStop(0, '#38bdf8');
                pinGrad.addColorStop(1, '#0284c7');
                ctx.fillStyle = pinGrad;
                ctx.shadowColor = 'rgba(2, 132, 199, 0.6)';
                ctx.shadowBlur = 14;
                ctx.fill();
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();

                // Remache blanco central
                ctx.beginPath();
                ctx.arc(0, -28, 6, 0, 2 * Math.PI);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.restore();
            </script>
        </body>
        </html>
    `);

    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:/Users/Junn/.gemini/antigravity/brain/f7aab9bf-1d16-4735-b1a1-724ac05ecc28/scratch/pro_wheel_design.png' });
    console.log('Saved scratch/pro_wheel_design.png');
    await browser.close();
}

testCanvas().catch(console.error);
