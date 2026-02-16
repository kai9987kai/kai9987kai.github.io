export default class OceanViz {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.waves = [];
        this.particles = []; // Foam and Bioluminescence
        this.active = false;
        this.time = 0;
        this.pressure = 0.5;
        this.wind = 0.1;
        this.timeOfDay = 12;

        this.initWaves();
    }

    setActive(active) {
        this.active = active;
    }

    initWaves() {
        this.waves = [];
        for (let i = 0; i < 3; i++) {
            this.waves.push({
                y: 0.7 + (i * 0.1),
                amp: 20 + i * 10,
                freq: 0.01 + i * 0.005,
                speed: 0.02 + i * 0.01,
                offset: Math.random() * Math.PI * 2
            });
        }
    }

    resize() {
        if (!this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    update(params) {
        if (!this.active) return;

        this.pressure = params.pressure !== undefined ? params.pressure : 0.5;
        this.wind = params.wind !== undefined ? params.wind : 0.1;
        this.timeOfDay = params.time !== undefined ? params.time : 12;

        let speedMod = 1 + this.wind * 2;
        this.time += speedMod;

        // Spawn Foam Particles at wave peaks
        if (this.pressure < 0.6 && Math.random() < 0.3) {
            this.spawnParticle('foam');
        }

        // Spawn Bioluminescence at night
        const isNight = this.timeOfDay < 6 || this.timeOfDay > 19;
        if (isNight && Math.random() < 0.05) {
            this.spawnParticle('bio');
        }

        // Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }

    spawnParticle(type) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        if (type === 'foam') {
            this.particles.push({
                x: Math.random() * w,
                y: h * 0.7 + (Math.random() - 0.5) * 50,
                vx: -1 - Math.random() * 2,
                vy: (Math.random() - 0.5) * 1,
                life: 1.0,
                decay: 0.02,
                size: 2 + Math.random() * 4,
                color: 'rgba(255, 255, 255, 0.6)',
                type: 'foam'
            });
        } else if (type === 'bio') {
            this.particles.push({
                x: Math.random() * w,
                y: h * 0.8 + Math.random() * (h * 0.2),
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                life: 1.0,
                decay: 0.01,
                size: 1 + Math.random() * 2,
                color: `rgba(0, 255, 200, ${0.5 + Math.random() * 0.5})`,
                type: 'bio'
            });
        }
    }

    draw() {
        if (!this.active) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            return;
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Draw Waves with Gradients
        this.waves.forEach((wave, i) => {
            const stormFactor = (1.0 - this.pressure) * 2.0;
            const currentAmp = wave.amp * (1.0 + stormFactor);

            const grad = this.ctx.createLinearGradient(0, h * wave.y - currentAmp, 0, h);
            const baseB = 150 + i * 30;
            const nightMod = (this.timeOfDay < 6 || this.timeOfDay > 19) ? 0.3 : 1.0;

            grad.addColorStop(0, `rgba(0, ${Math.floor((100 + i * 40) * nightMod)}, ${Math.floor(baseB * nightMod)}, 0.6)`);
            grad.addColorStop(1, `rgba(0, ${Math.floor(20 * nightMod)}, ${Math.floor(50 * nightMod)}, 0.9)`);

            this.ctx.beginPath();
            this.ctx.fillStyle = grad;

            const count = 30;
            const step = w / count;

            this.ctx.moveTo(0, h);
            this.ctx.lineTo(0, h * wave.y);

            for (let x = 0; x <= w + step; x += step) {
                const y = (h * wave.y) + Math.sin(x * wave.freq + this.time * wave.speed + wave.offset) * currentAmp;
                this.ctx.lineTo(x, y);
            }

            this.ctx.lineTo(w, h);
            this.ctx.closePath();
            this.ctx.fill();
        });

        // Draw Particles
        this.particles.forEach(p => {
            this.ctx.fillStyle = p.color.replace(/[\d.]+\)$/g, p.life + ')');
            if (p.type === 'bio') {
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = '#00ffcc';
            }
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });
    }
}
