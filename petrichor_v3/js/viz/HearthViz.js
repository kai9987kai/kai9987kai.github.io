export default class HearthViz {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.active = false;
        this.frame = 0;
        this.particles = [];
        this.glowIntensity = 0;
    }

    setActive(active) {
        this.active = active;
    }

    resize() {
        if (!this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    update() {
        if (this.active) {
            this.glowIntensity += (0.8 + Math.random() * 0.2 - this.glowIntensity) * 0.1;
        } else {
            this.glowIntensity *= 0.95;
        }

        // Spawn embers
        if (this.active && Math.random() < 0.1) {
            this.particles.push({
                x: (this.canvas.width / 2) + (Math.random() - 0.5) * 100,
                y: this.canvas.height + 10,
                vx: (Math.random() - 0.5) * 0.5,
                vy: -1 - Math.random(),
                life: 1.0,
                size: 1 + Math.random() * 2
            });
        }

        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.01;
            p.vx += (Math.random() - 0.5) * 0.1; // jitter
        });

        this.particles = this.particles.filter(p => p.life > 0);
    }

    draw() {
        if (this.glowIntensity < 0.01 && this.particles.length === 0) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            return;
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const w = this.canvas.width;
        const h = this.canvas.height;
        const cx = w / 2;
        const cy = h;

        // Warm Glow from bottom
        if (this.glowIntensity > 0.01) {
            const grad = this.ctx.createRadialGradient(cx, cy, 50, cx, cy, h * 0.8);
            grad.addColorStop(0, `rgba(255, 150, 50, ${this.glowIntensity * 0.3})`);
            grad.addColorStop(0.5, `rgba(200, 100, 50, ${this.glowIntensity * 0.1})`);
            grad.addColorStop(1, 'rgba(0,0,0,0)');

            this.ctx.fillStyle = grad;
            this.ctx.fillRect(0, 0, w, h);
        }

        // Embers
        this.ctx.fillStyle = '#ffcc88';
        this.particles.forEach(p => {
            this.ctx.globalAlpha = p.life;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;
    }
}
