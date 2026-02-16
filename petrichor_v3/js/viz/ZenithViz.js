export default class ZenithViz {
    constructor(canvas, analyser) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.analyser = analyser;
        this.particles = [];
        this.maxParticles = 800;
        this.active = false;

        this.dataArray = new Uint8Array(256);
        this.noiseScale = 0.01;
        this.time = 0;

        this.resize();
    }

    resize() {
        if (!this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    setActive(active) {
        this.active = active;
        if (active && this.particles.length === 0) {
            this.initParticles();
        }
    }

    initParticles() {
        this.particles = [];
        for (let i = 0; i < this.maxParticles; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: 0,
                vy: 0,
                speed: 0.5 + Math.random() * 2,
                color: `hsla(${180 + Math.random() * 60}, 70%, 70%, 0.5)`,
                life: Math.random()
            });
        }
    }

    update() {
        if (!this.active) return;

        this.time += 0.005;
        if (this.analyser) {
            this.analyser.getByteFrequencyData(this.dataArray);
        }

        const avgFreq = this.dataArray.reduce((a, b) => a + b, 0) / this.dataArray.length / 255;

        this.particles.forEach(p => {
            // Simplified "Noise" using Trig for flow
            const angle = (Math.sin(p.x * this.noiseScale + this.time) + Math.cos(p.y * this.noiseScale + this.time)) * Math.PI * 2;

            p.vx += Math.cos(angle) * 0.1;
            p.vy += Math.sin(angle) * 0.1;

            // Audio Influence
            p.vx *= 0.95 + (avgFreq * 0.05);
            p.vy *= 0.95 + (avgFreq * 0.05);

            p.x += p.vx * p.speed;
            p.y += p.vy * p.speed;

            // Wrap
            if (p.x < 0) p.x = this.canvas.width;
            if (p.x > this.canvas.width) p.x = 0;
            if (p.y < 0) p.y = this.canvas.height;
            if (p.y > this.canvas.height) p.y = 0;

            // Life cycle for color shifts
            p.life += 0.01;
            if (p.life > 1) p.life = 0;
        });
    }

    draw() {
        if (!this.active) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            return;
        }

        // Trails
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.particles.forEach(p => {
            const size = 1 + Math.sin(p.life * Math.PI) * 2;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
            this.ctx.fill();

            // Subtle Glow
            if (Math.random() < 0.01) {
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = p.color;
                this.ctx.fill();
                this.ctx.shadowBlur = 0;
            }
        });
    }
}
