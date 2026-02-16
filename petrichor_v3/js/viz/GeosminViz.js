export default class GeosminViz {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.intensity = 0;

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    update(val) {
        this.intensity = val;
    }

    draw() {
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Clear with fade
        this.ctx.fillStyle = 'rgba(20, 25, 30, 0.2)';
        this.ctx.fillRect(0, 0, w, h);

        // Soil Bed
        const bedH = h * 0.3;
        const g = this.ctx.createLinearGradient(0, h - bedH, 0, h);
        g.addColorStop(0, '#5C3317');
        g.addColorStop(1, '#2a1a0b');
        this.ctx.fillStyle = g;
        this.ctx.fillRect(0, h - bedH, w, bedH);

        // Spawn Bacteria/Spores
        if (Math.random() < this.intensity * 0.1) {
            this.particles.push({
                x: Math.random() * w,
                y: h - Math.random() * bedH,
                vy: -Math.random() * 2,
                r: Math.random() * 2 + 1,
                life: 1
            });
        }

        // Update
        this.particles = this.particles.filter(p => {
            p.y += p.vy;
            p.life -= 0.01;

            this.ctx.fillStyle = `rgba(74, 144, 226, ${p.life})`;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            this.ctx.fill();

            return p.life > 0;
        });
    }
}
