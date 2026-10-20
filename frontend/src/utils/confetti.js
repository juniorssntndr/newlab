/**
 * Lightweight High-Performance Canvas Confetti Cannon
 * Zero dependencies, pure requestAnimationFrame physics.
 */
export function fireConfetti(canvas) {
    if (!canvas) return () => {};

    const ctx = canvas.getContext('2d');
    if (!ctx) return () => {};

    const dpr = window.devicePixelRatio || 1;
    const width = (canvas.width = window.innerWidth * dpr);
    const height = (canvas.height = window.innerHeight * dpr);
    ctx.scale(dpr, dpr);

    const colors = [
        '#38bdf8', // Neon Cyan
        '#0284c7', // Royal Blue AFINIX
        '#fbbf24', // Gold
        '#f59e0b', // Deep Amber
        '#10b981', // Emerald
        '#a855f7', // Purple
        '#ffffff'  // Crisp White
    ];

    const particleCount = 140;
    const particles = [];

    const originX = window.innerWidth / 2;
    const originY = window.innerHeight * 0.42;

    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 18 + 8;
        const size = Math.random() * 8 + 5;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const shape = Math.random() > 0.4 ? 'rect' : 'circle';

        particles.push({
            x: originX,
            y: originY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 6,
            size,
            color,
            shape,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 12,
            gravity: 0.38,
            friction: 0.96,
            opacity: 1,
            wobble: Math.random() * 10
        });
    }

    let animationFrameId = null;
    let startTime = performance.now();
    const duration = 3800; // 3.8 seconds

    const animate = (now) => {
        const elapsed = now - startTime;
        const progress = elapsed / duration;

        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        particles.forEach((p) => {
            p.vx *= p.friction;
            p.vy *= p.friction;
            p.vy += p.gravity;
            p.x += p.vx + Math.sin(p.wobble) * 0.8;
            p.y += p.vy;
            p.rotation += p.rotationSpeed;
            p.wobble += 0.08;

            if (progress > 0.6) {
                p.opacity = Math.max(0, 1 - (progress - 0.6) / 0.4);
            }

            ctx.save();
            ctx.globalAlpha = p.opacity;
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);

            ctx.fillStyle = p.color;
            if (p.shape === 'rect') {
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        });

        if (progress < 1) {
            animationFrameId = requestAnimationFrame(animate);
        } else {
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };
}
