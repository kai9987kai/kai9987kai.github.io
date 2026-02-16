export default class BreathViz {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.active = false;

        this.phases = {
            inhale: 4,
            hold: 7,
            exhale: 8
        };

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    setActive(isActive) {
        this.active = isActive;
    }

    draw() {
        if (!this.active) return;

        const w = this.canvas.width;
        const h = this.canvas.height;
        const cx = w / 2;
        const cy = h / 2;

        const time = Date.now() / 1000; // Seconds precision
        const cycleDur = this.phases.inhale + this.phases.hold + this.phases.exhale;
        const t = time % cycleDur;

        let radius = 50;
        let text = "";
        let color = "rgba(100, 255, 218, 0.5)";

        // Max radius
        const maxR = Math.min(w, h) * 0.25;
        const minR = maxR * 0.4;

        if (t < this.phases.inhale) {
            // Inhale
            const progress = t / this.phases.inhale;
            // Ease out cubic
            const ease = 1 - Math.pow(1 - progress, 3);
            radius = minR + (maxR - minR) * ease;
            text = "INHALE";
            color = `rgba(100, 255, 218, ${0.3 + progress * 0.5})`;
        } else if (t < this.phases.inhale + this.phases.hold) {
            // Hold
            radius = maxR;
            text = "HOLD";
            color = "rgba(150, 255, 200, 0.9)";
        } else {
            // Exhale
            const progress = (t - (this.phases.inhale + this.phases.hold)) / this.phases.exhale;
            // Ease in out
            radius = maxR - (maxR - minR) * progress;
            text = "EXHALE";
            color = `rgba(100, 200, 255, ${0.8 - progress * 0.5})`;
        }

        // Draw Circle
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = color;
        this.ctx.fill();

        // Glow
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = color;
        this.ctx.strokeStyle = "white";
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;

        // Draw Text
        this.ctx.fillStyle = "white";
        this.ctx.font = "20px 'Segoe UI', sans-serif";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(text, cx, cy);
    }
}
