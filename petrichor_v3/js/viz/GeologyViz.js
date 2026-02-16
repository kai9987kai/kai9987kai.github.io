export default class GeologyViz {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.intensity = 0;
        this.fissures = [];
        this.shakeX = 0;
        this.shakeY = 0;
    }

    update(params) {
        this.intensity = params.seismic || 0;

        // Calculate Shake
        if (this.intensity > 0.05) {
            const mag = this.intensity * 10;
            this.shakeX = (Math.random() - 0.5) * mag;
            this.shakeY = (Math.random() - 0.5) * mag;
        } else {
            this.shakeX = 0;
            this.shakeY = 0;
        }

        // Apply shake to container via CSS (VisualCore will handle this)

        // Update/Spawn Fissures
        if (this.intensity > 0.3 && Math.random() < this.intensity * 0.05) {
            this.spawnFissure();
        }

        for (let i = this.fissures.length - 1; i >= 0; i--) {
            const f = this.fissures[i];
            f.glow += (Math.random() - 0.5) * 0.1;
            f.glow = Math.max(0.1, Math.min(1.0, f.glow));
            f.life -= 0.001;
            if (f.life <= 0) this.fissures.splice(i, 1);
        }
    }

    spawnFissure() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const startX = Math.random() * w;
        const startY = h * (0.7 + Math.random() * 0.3);

        const segments = [];
        let curX = startX;
        let curY = startY;

        for (let i = 0; i < 5; i++) {
            const nextX = curX + (Math.random() - 0.5) * 60;
            const nextY = curY + (Math.random() - 0.5) * 40;
            segments.push({ x: nextX, y: nextY });
            curX = nextX;
            curY = nextY;
        }

        this.fissures.push({
            startX, startY,
            segments,
            life: 1.0,
            glow: Math.random(),
            width: 1 + Math.random() * 3
        });
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.intensity < 0.1 && this.fissures.length === 0) return;

        this.fissures.forEach(f => {
            this.ctx.beginPath();
            this.ctx.lineWidth = f.width;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';

            // Subterranean Glow
            const glowColor = `rgba(255, ${Math.floor(100 * f.glow)}, 0, ${f.life * 0.6})`;
            this.ctx.shadowBlur = 10 * f.glow;
            this.ctx.shadowColor = glowColor;
            this.ctx.strokeStyle = glowColor;

            this.ctx.moveTo(f.startX, f.startY);
            f.segments.forEach(seg => {
                this.ctx.lineTo(seg.x, seg.y);
            });
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;

            // Deep Crack (Black center)
            this.ctx.strokeStyle = `rgba(0, 0, 0, ${f.life})`;
            this.ctx.lineWidth = f.width * 0.5;
            this.ctx.stroke();
        });
    }

    getShakeTransform() {
        if (Math.abs(this.shakeX) < 0.1 && Math.abs(this.shakeY) < 0.1) return 'none';
        return `translate(${this.shakeX}px, ${this.shakeY}px)`;
    }
}
