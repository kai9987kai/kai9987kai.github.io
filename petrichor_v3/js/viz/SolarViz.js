export default class SolarViz {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.intensity = 0;
        this.flareFreq = 0.1;
        this.time = 0;
        this.glitches = [];
        this.isFlareActive = false;
        this.flareFactor = 0;
    }

    update(params) {
        this.intensity = params.solarIntensity || 0;
        this.flareFreq = params.flareFrequency || 0.1;
        this.time += 0.01;

        // Random glitch appearance
        if (this.intensity > 0.2 && Math.random() < 0.02 * this.intensity) {
            this.glitches.push({
                y: Math.random() * this.canvas.height,
                h: 1 + Math.random() * 5,
                w: this.canvas.width * (0.2 + Math.random() * 0.8),
                life: 1.0,
                decay: 0.1 + Math.random() * 0.2
            });
        }

        // Flare logic
        if (this.intensity > 0.4 && !this.isFlareActive && Math.random() < 0.001 * (this.intensity + this.flareFreq)) {
            this.isFlareActive = true;
            this.flareFactor = 1.0;
        }

        if (this.isFlareActive) {
            this.flareFactor -= 0.005;
            if (this.flareFactor <= 0) {
                this.isFlareActive = false;
                this.flareFactor = 0;
            }
        }

        // Update CSS filters for chromatic aberration
        const shift = (this.intensity * 2) + (this.flareFactor * 15);
        if (shift > 0.1) {
            // We'll apply this to the parent container via the update Viz function in VisualCore
        }
    }

    getChromaticShift() {
        return (this.intensity * 2) + (this.flareFactor * 15);
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.intensity <= 0) return;

        const w = this.canvas.width;
        const h = this.canvas.height;

        // Draw Glitch Scanlines
        this.ctx.fillStyle = `rgba(255, 255, 255, ${0.1 * this.intensity})`;
        for (let i = this.glitches.length - 1; i >= 0; i--) {
            const g = this.glitches[i];
            this.ctx.fillRect(0, g.y, w, g.h);
            g.life -= g.decay;
            if (g.life <= 0) this.glitches.splice(i, 1);
        }

        // Solar Glow / Corona (Top layer)
        if (this.intensity > 0.5) {
            const grad = this.ctx.createRadialGradient(w / 2, 100, 0, w / 2, 100, 400 * this.intensity);
            grad.addColorStop(0, `rgba(255, 255, 200, ${0.1 * (this.intensity - 0.5)})`);
            grad.addColorStop(1, 'rgba(255, 255, 200, 0)');
            this.ctx.fillStyle = grad;
            this.ctx.fillRect(0, 0, w, h);
        }
    }
}
