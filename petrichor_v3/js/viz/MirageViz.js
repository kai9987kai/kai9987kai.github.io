export default class MirageViz {
    constructor(canvas, audio) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.audio = audio;
        this.width = canvas.width;
        this.height = canvas.height;

        this.particles = [];
        this.params = {
            entropy: 0.5,
            flux: 0.1,
            active: true
        };

        this.ghostBuffer = document.createElement('canvas');
        this.ghostCtx = this.ghostBuffer.getContext('2d');
    }

    resize() {
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.ghostBuffer.width = this.width;
        this.ghostBuffer.height = this.height;
    }

    update(params) {
        if (params.entropy !== undefined) this.params.entropy = params.entropy;
        if (params.flux !== undefined) this.params.flux = params.flux;
        if (params.active !== undefined) this.params.active = params.active;

        // Spawn uncertainty particles
        if (this.params.active && Math.random() < this.params.entropy) {
            const num = Math.floor(this.params.entropy * 5);
            for (let i = 0; i < num; i++) {
                this.particles.push({
                    x: Math.random() * this.width,
                    y: Math.random() * this.height,
                    size: 1 + Math.random() * 3,
                    life: 1.0,
                    decay: 0.05 + Math.random() * 0.1,
                    color: Math.random() > 0.5 ? '#64ffda' : '#00f2ff',
                    vx: (Math.random() - 0.5) * 5,
                    vy: (Math.random() - 0.5) * 5
                });
            }
        }

        // Update particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            return p.life > 0;
        });
    }

    // This is a post-processing step
    applyGhosting(sourceCanvas) {
        if (!this.params.active) return;

        // Draw source to ghost buffer with low alpha (trail)
        this.ghostCtx.globalAlpha = 0.8;
        this.ghostCtx.drawImage(this.ghostBuffer, 0, 0); // Self-trail? No, we want a persistent ghost

        // Actually, let's do direct ghosting on the main ctx instead for simpler integration
    }

    draw(mainCtx) {
        if (!this.params.active) return;

        // Draw Uncertainty Particles
        mainCtx.save();
        this.particles.forEach(p => {
            mainCtx.globalAlpha = p.life;
            mainCtx.fillStyle = p.color;
            mainCtx.beginPath();
            mainCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            mainCtx.fill();

            // Glitch horizontal line
            if (Math.random() < this.params.flux * 0.2) {
                mainCtx.fillRect(p.x - 20, p.y, 40, 1);
            }
        });
        mainCtx.restore();

        // Prismatic Aberration (Random split)
        if (Math.random() < this.params.flux * 0.1) {
            const offset = (Math.random() - 0.5) * 20 * this.params.flux;
            mainCtx.save();
            mainCtx.globalCompositeOperation = 'screen';
            mainCtx.globalAlpha = 0.3;
            mainCtx.drawImage(this.canvas, offset, 0);
            mainCtx.restore();
        }
    }
}
