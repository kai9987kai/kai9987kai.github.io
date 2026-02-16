export default class GroundViz {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.puddles = [];
        this.initPuddles();

        this.saturation = 0; // 0 (dry) to 1 (flooded/covered)
        this.rain = 0;
        this.season = 'summer';
        this.ripples = [];
    }

    initPuddles() {
        // Define random puddle shapes (ellipses) on the ground floor
        this.puddles = [];
        for (let i = 0; i < 5; i++) {
            this.puddles.push({
                x: 0.2 + Math.random() * 0.6, // Normalized X position
                y: 0.8 + Math.random() * 0.15, // Normalized Y position (bottom)
                w: 0.1 + Math.random() * 0.2, // Width
                h: 0.05 + Math.random() * 0.05 // Height
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
        if (params.rain !== undefined) this.rain = params.rain;

        // Check season switch
        if (params.season && params.season !== this.season) {
            this.season = params.season;
            this.saturation = 0; // Reset on change
        }

        // Accumulate/Evaporate
        if (this.rain > 0) {
            this.saturation += this.rain * 0.001; // Slow fill
        } else {
            this.saturation -= 0.0005; // Slow dry
        }
        this.saturation = Math.max(0, Math.min(1, this.saturation));

        if (this.season === 'summer') {
            // Ripples
            if (this.saturation > 0.1 && this.rain > 0) {
                if (Math.random() < this.rain * 0.2) {
                    this.addRipple();
                }
            }

            // Update Ripples
            for (let i = this.ripples.length - 1; i >= 0; i--) {
                const r = this.ripples[i];
                r.r += 0.5;
                r.a -= 0.02;
                if (r.a <= 0) this.ripples.splice(i, 1);
            }
        }
    }

    addRipple() {
        // Pick a random puddle
        // Since puddles are normalized, we need to pick one that exists
        // Effectively we just spawn ripple on screen in valid puddle areas
        // Simplified: Pick a puddle, pick random point inside ellipse

        const p = this.puddles[Math.floor(Math.random() * this.puddles.length)];
        const rx = (Math.random() - 0.5) * p.w;
        const ry = (Math.random() - 0.5) * p.h;

        // Map to screen
        this.ripples.push({
            x: (p.x * this.canvas.width) + (rx * this.canvas.width),
            y: (p.y * this.canvas.height) + (ry * this.canvas.height),
            r: 1,
            a: 0.5
        });
    }

    draw() {
        if (this.saturation <= 0.01) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            return;
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const w = this.canvas.width;
        const h = this.canvas.height;
        const scale = this.saturation;

        if (this.season === 'winter') {
            // Draw Snow Cover
            // Just a gradient at the bottom?
            const grad = this.ctx.createLinearGradient(0, h - (h * 0.3), 0, h);
            grad.addColorStop(0, `rgba(255, 255, 255, 0)`);
            grad.addColorStop(1, `rgba(255, 255, 255, ${0.8 * scale})`);

            this.ctx.fillStyle = grad;
            this.ctx.fillRect(0, h - (h * 0.4), w, h * 0.4);
            return;
        }

        // Summer Puddles
        this.ctx.save();

        // Scale puddles by saturation
        // If saturation is low, puddles are small.

        this.puddles.forEach(p => {
            const px = p.x * w;
            const py = p.y * h;
            const pw = p.w * w * scale;
            const ph = p.h * h * scale;

            if (pw <= 1) return;

            this.ctx.beginPath();
            this.ctx.ellipse(px, py, pw, ph, 0, 0, Math.PI * 2);

            // Reflection Color
            // Sky reflection approximation: Dark blue/grey with alpha
            this.ctx.fillStyle = `rgba(100, 120, 130, ${0.4 * scale})`;
            this.ctx.fill();

            // Highlight frame
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 * scale})`;
            this.ctx.stroke();
        });

        // Ripples
        this.ctx.strokeStyle = 'rgba(200, 200, 255, 0.4)';
        this.ctx.lineWidth = 1;
        this.ripples.forEach(r => {
            this.ctx.beginPath();
            this.ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
            this.ctx.globalAlpha = r.a;
            this.ctx.stroke();
        });
        this.ctx.globalAlpha = 1.0;

        this.ctx.restore();
    }
}
