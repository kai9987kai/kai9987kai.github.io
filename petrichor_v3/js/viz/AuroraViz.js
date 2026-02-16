export default class AuroraViz {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.active = false;
        this.glow = 0.5;
        this.speed = 1.0;
        this.solarIntensity = 0;
        this.time = 0;

        this.ribbons = [];
        this.initRibbons();
    }

    initRibbons() {
        this.ribbons = [];
        for (let i = 0; i < 3; i++) {
            this.ribbons.push({
                y: 0.1 + i * 0.1,
                points: 20,
                offset: Math.random() * Math.PI * 2,
                hue: 120 + i * 40
            });
        }
    }

    update(params) {
        this.active = params.aurora || false;
        this.glow = params.auroraGlow || 0.5;
        this.speed = params.auroraSpeed || 1.0;
        this.solarIntensity = params.solarIntensity || 0;
        this.time += 0.01 * this.speed;
    }

    draw() {
        if (!this.active || this.glow <= 0) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            return;
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const w = this.canvas.width;
        const h = this.canvas.height;

        this.ribbons.forEach((r, idx) => {
            const hue = (r.hue + this.solarIntensity * 100) % 360;
            const alpha = this.glow * (0.3 + Math.sin(this.time + idx) * 0.1);

            this.ctx.save();
            this.ctx.globalCompositeOperation = 'lighter';

            // Draw multiple layers for glow effect
            for (let layer = 0; layer < 3; layer++) {
                this.ctx.beginPath();
                this.ctx.lineWidth = 40 + layer * 30;
                this.ctx.strokeStyle = `hsla(${hue}, 100%, 50%, ${alpha / (layer + 1)})`;
                this.ctx.lineJoin = 'round';
                this.ctx.lineCap = 'round';

                for (let i = 0; i <= r.points; i++) {
                    const px = (i / r.points) * w;
                    const py = (r.y * h) +
                        Math.sin(this.time + i * 0.2 + r.offset) * 30 +
                        Math.cos(this.time * 0.5 + i * 0.1) * 20;

                    if (i === 0) this.ctx.moveTo(px, py);
                    else this.ctx.lineTo(px, py);
                }
                this.ctx.stroke();
            }
            this.ctx.restore();

            // Vertical light rays
            this.ctx.save();
            this.ctx.globalAlpha = alpha * 0.2;
            const grad = this.ctx.createLinearGradient(0, r.y * h, 0, h);
            grad.addColorStop(0, `hsla(${hue}, 100%, 70%, 1)`);
            grad.addColorStop(0.3, `hsla(${hue}, 100%, 50%, 0.5)`);
            grad.addColorStop(1, 'transparent');

            this.ctx.fillStyle = grad;
            for (let i = 0; i <= r.points; i += 2) {
                const px = (i / r.points) * w;
                const py = (r.y * h) + Math.sin(this.time + i * 0.2 + r.offset) * 30;
                this.ctx.fillRect(px - 10, py, 20, h - py);
            }
            this.ctx.restore();
        });
    }
}
