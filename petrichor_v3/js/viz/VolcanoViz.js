export default class VolcanoViz {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.intensity = 0;
        this.ashParticles = [];
        this.vents = [];
        this.wind = 0.1;
        this.active = false;
        this.time = 0;

        this.initVents();
    }

    initVents() {
        this.vents = [];
        for (let i = 0; i < 4; i++) {
            this.vents.push({
                x: 0.2 + i * 0.2 + (Math.random() - 0.5) * 0.1,
                y: 0.9,
                strength: 0.5 + Math.random() * 0.5
            });
        }
    }

    update(params) {
        this.intensity = params.volcanoIntensity || 0;
        this.wind = params.wind || 0.1;
        this.time += 0.05;

        if (this.intensity > 0) {
            this.spawnAsh();
        }

        // Update Ash
        for (let i = this.ashParticles.length - 1; i >= 0; i--) {
            const p = this.ashParticles[i];
            p.x += p.vx + (this.wind * 5);
            p.y += p.vy;
            p.life -= p.decay;
            if (p.life <= 0 || p.y < 0) this.ashParticles.splice(i, 1);
        }
    }

    spawnAsh() {
        const density = Math.floor(this.intensity * 5);
        for (let i = 0; i < density; i++) {
            const vent = this.vents[Math.floor(Math.random() * this.vents.length)];
            this.ashParticles.push({
                x: vent.x * this.canvas.width + (Math.random() - 0.5) * 40,
                y: vent.y * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: -1 - Math.random() * 2,
                life: 1.0,
                decay: 0.005 + Math.random() * 0.01,
                size: 1 + Math.random() * 3,
                color: `rgba(${40 + Math.random() * 30}, ${40 + Math.random() * 30}, ${40 + Math.random() * 30}, 0.6)`
            });
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.intensity <= 0 && this.ashParticles.length === 0) return;

        const w = this.canvas.width;
        const h = this.canvas.height;

        // Draw Vent Glow
        this.vents.forEach(v => {
            const vx = v.x * w;
            const vy = v.y * h;
            const glowSize = 40 * this.intensity * v.strength;

            if (glowSize > 1) {
                const grad = this.ctx.createRadialGradient(vx, vy, 0, vx, vy, glowSize);
                grad.addColorStop(0, `rgba(255, 100, 0, ${0.4 * this.intensity})`);
                grad.addColorStop(1, 'rgba(255, 50, 0, 0)');
                this.ctx.fillStyle = grad;
                this.ctx.fillRect(vx - glowSize, vy - glowSize, glowSize * 2, glowSize * 2);
            }
        });

        // Draw Ash
        this.ashParticles.forEach(p => {
            this.ctx.fillStyle = p.color.replace(/[\d.]+\)$/g, p.life + ')');
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
}
