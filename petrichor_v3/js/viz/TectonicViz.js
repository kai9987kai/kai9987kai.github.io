export default class TectonicViz {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.stress = 0;
        this.growthRate = 0.1;
        this.time = 0;
        this.crystals = [];
    }

    update(params) {
        this.stress = params.tectonicStress || 0;
        this.growthRate = params.tectonicGrowth || 0.1;
        const seismic = params.seismic || 0;
        this.time += 0.01;

        // Crystal growth logic
        if (this.growthRate > 0 && Math.random() < 0.01 * this.growthRate) {
            this.crystals.push({
                x: Math.random() * this.canvas.width,
                baseY: this.canvas.height - 20,
                height: 0,
                targetHeight: 20 + Math.random() * 80,
                width: 5 + Math.random() * 15,
                angle: (Math.random() - 0.5) * 0.5,
                hue: 180 + Math.random() * 60,
                life: 1.0,
                stressSensitivity: 0.5 + Math.random() * 0.5
            });
        }

        // Update existing crystals
        for (let i = this.crystals.length - 1; i >= 0; i--) {
            const c = this.crystals[i];

            // Grow towards target
            if (c.height < c.targetHeight) {
                c.height += this.growthRate * 0.5;
            }

            // High seismic activity can "shatter" crystals
            if (seismic > 0.8 && Math.random() < 0.05) {
                c.life -= 0.1;
            }

            if (c.life <= 0) {
                this.crystals.splice(i, 1);
            }
        }

        // Limit density
        if (this.crystals.length > 50) {
            this.crystals.shift();
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.crystals.length === 0) return;

        const seismic = this.stress; // Use stress for glow

        this.crystals.forEach(c => {
            this.ctx.save();
            this.ctx.translate(c.x, c.baseY);
            this.ctx.rotate(c.angle);

            // Outer glow based on stress
            const glow = (0.2 + seismic * 0.8) * c.stressSensitivity;
            this.ctx.shadowBlur = 10 * glow;
            this.ctx.shadowColor = `hsla(${c.hue}, 100%, 70%, ${glow})`;

            // Main crystal body
            const grad = this.ctx.createLinearGradient(0, 0, 0, -c.height);
            grad.addColorStop(0, `hsla(${c.hue}, 100%, 30%, ${c.life})`);
            grad.addColorStop(0.5, `hsla(${c.hue}, 100%, 60%, ${c.life})`);
            grad.addColorStop(1, `hsla(${c.hue}, 100%, 80%, ${c.life})`);

            this.ctx.fillStyle = grad;
            this.ctx.beginPath();
            this.ctx.moveTo(-c.width / 2, 0);
            this.ctx.lineTo(c.width / 2, 0);
            this.ctx.lineTo(c.width / 4, -c.height * 0.8);
            this.ctx.lineTo(0, -c.height);
            this.ctx.lineTo(-c.width / 4, -c.height * 0.8);
            this.ctx.closePath();
            this.ctx.fill();

            // Highlight
            this.ctx.strokeStyle = `hsla(${c.hue}, 100%, 90%, ${0.3 * c.life})`;
            this.ctx.lineWidth = 1;
            this.ctx.stroke();

            this.ctx.restore();
        });
    }
}
