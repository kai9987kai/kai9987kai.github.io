export default class SporeViz {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.spores = [];
        this.maxSpores = 150;

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    spawnSpore(x, y) {
        if (this.spores.length >= this.maxSpores) return;

        this.spores.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 0.2,
            vy: -0.3 - Math.random() * 0.7,
            size: 0.5 + Math.random() * 1.5,
            alpha: 1.0,
            life: 1.0,
            decay: 0.002 + Math.random() * 0.008
        });
    }

    update(windSpeed, rainIntensity, botanyModule) {
        // Spawn from fungi plants
        if (botanyModule && botanyModule.plants) {
            botanyModule.plants.forEach(p => {
                if (p.type === 'fungi' && p.age > 0.3 && Math.random() < 0.03 * p.age) {
                    this.spawnSpore(p.x, p.y - p.height);
                }
            });
        }

        this.spores = this.spores.filter(s => {
            s.x += s.vx + windSpeed * 3;
            s.y += s.vy;

            // Brownian motion
            s.vx += (Math.random() - 0.5) * 0.05;

            // Rain drag
            if (rainIntensity > 0.2) s.vy += rainIntensity * 0.2;

            s.life -= s.decay;
            s.alpha = s.life;

            return s.life > 0 && s.y >= 0 && s.x >= 0 && s.x <= this.canvas.width;
        });
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.spores.forEach(s => {
            this.ctx.beginPath();
            this.ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(220, 255, 180, ${s.alpha * 0.5})`;
            this.ctx.fill();

            if (s.size > 1.2) {
                this.ctx.shadowBlur = 5;
                this.ctx.shadowColor = 'rgba(200, 255, 100, 0.5)';
            } else {
                this.ctx.shadowBlur = 0;
            }
        });
        this.ctx.shadowBlur = 0;
    }
}
