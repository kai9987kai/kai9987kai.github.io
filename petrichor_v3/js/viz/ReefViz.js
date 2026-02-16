export default class ReefViz {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.corals = [];
        this.plankton = [];
        this.intensity = 0.5;
        this.pulseRate = 1.0;
        this.active = false;
        this.time = 0;

        this.init();
    }

    init() {
        this.spawnPlankton(40);
    }

    resize() {
        if (!this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    setActive(active) {
        if (active && !this.active) {
            this.generateReef();
        } else if (!active && this.active) {
            this.corals = [];
        }
        this.active = active;
    }

    generateReef() {
        this.corals = [];
        const count = 5 + Math.floor(Math.random() * 5);
        for (let i = 0; i < count; i++) {
            this.corals.push(this.createCoral(
                Math.random() * this.canvas.width,
                this.canvas.height * 0.95
            ));
        }
    }

    createCoral(x, y) {
        return {
            x, y,
            segments: this.growCoral(x, y, -Math.PI / 2, 40, 5),
            hue: 180 + Math.random() * 60,
            pulseOffset: Math.random() * Math.PI * 2
        };
    }

    growCoral(x, y, angle, length, depth) {
        if (depth === 0) return [];
        const nextX = x + Math.cos(angle) * length;
        const nextY = y + Math.sin(angle) * length;
        const segments = [{ x1: x, y1: y, x2: nextX, y2: nextY, depth }];

        if (depth > 1) {
            const branches = 2 + Math.floor(Math.random() * 2);
            for (let i = 0; i < branches; i++) {
                const newAngle = angle + (Math.random() - 0.5) * 1.5;
                segments.push(...this.growCoral(nextX, nextY, newAngle, length * 0.7, depth - 1));
            }
        }
        return segments;
    }

    spawnPlankton(count) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        for (let i = 0; i < count; i++) {
            this.plankton.push({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.2,
                size: 1 + Math.random() * 2,
                alpha: 0.1 + Math.random() * 0.3
            });
        }
    }

    update(params) {
        if (!this.active) return;
        this.intensity = params.biolumeIntensity || 0.5;
        this.pulseRate = params.biolumePulse || 1.0;
        this.time += 0.02 * this.pulseRate;

        this.plankton.forEach(p => {
            p.x += p.vx * (1 + (params.wind || 0));
            p.y += p.vy;
            if (p.x < 0) p.x = this.canvas.width;
            if (p.x > this.canvas.width) p.x = 0;
            if (p.y < 0) p.y = this.canvas.height;
            if (p.y > this.canvas.height) p.y = 0;
        });
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (!this.active) return;

        // Draw Plankton
        this.ctx.fillStyle = 'rgba(200, 255, 255, 0.2)';
        this.plankton.forEach(p => {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // Draw Corals
        this.corals.forEach(c => {
            const pulse = (Math.sin(this.time + c.pulseOffset) + 1) * 0.5;
            const glowAlpha = pulse * this.intensity;

            this.ctx.shadowBlur = 15 * glowAlpha;
            this.ctx.shadowColor = `hsla(${c.hue}, 100%, 70%, ${glowAlpha})`;
            this.ctx.strokeStyle = `hsla(${c.hue}, 50%, 30%, 0.8)`;
            this.ctx.lineCap = 'round';

            c.segments.forEach(s => {
                this.ctx.lineWidth = s.depth * 2;
                this.ctx.beginPath();
                this.ctx.moveTo(s.x1, s.y1);
                this.ctx.lineTo(s.x2, s.y2);
                this.ctx.stroke();

                // Glow knots
                if (Math.random() < 0.2) {
                    this.ctx.fillStyle = `hsla(${c.hue}, 100%, 80%, ${glowAlpha})`;
                    this.ctx.beginPath();
                    this.ctx.arc(s.x2, s.y2, 3, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            });
        });
        this.ctx.shadowBlur = 0;
    }
}
