export default class MagneticViz {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.intensity = 0;
        this.solar = 0;
        this.seismic = 0;
        this.time = 0;
        this.angle = 0;
        this.jitter = 0;
        this.fluxActive = false;

        this.fluxLines = [];
        this.initFlux();
    }

    initFlux() {
        this.fluxLines = [];
        for (let i = 0; i < 5; i++) {
            this.fluxLines.push({
                x: Math.random() * 1,
                y: Math.random() * 1,
                len: 100 + Math.random() * 200,
                rot: Math.random() * Math.PI * 2,
                speed: 0.01 + Math.random() * 0.02
            });
        }
    }

    update(params) {
        this.intensity = params.magneticFlux || 0;
        this.fluxActive = params.fluxToggle || false;
        this.solar = params.solarIntensity || 0;
        this.seismic = params.seismic || 0;
        this.time += 0.05;

        // Compass logic
        const targetAngle = this.time * 0.1; // Slow base rotation
        const instability = this.intensity + this.solar * 2 + this.seismic;

        this.jitter = (Math.random() - 0.5) * instability * 0.5;
        this.angle += (targetAngle - this.angle) * 0.1 + this.jitter;
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (!this.fluxActive && this.intensity <= 0) return;

        const w = this.canvas.width;
        const h = this.canvas.height;

        // Draw HUD Compass (Bottom Right)
        this.drawCompass(w - 100, h - 100, 60);

        // Draw Flux Lines
        if (this.intensity > 0.1) {
            this.ctx.save();
            this.ctx.strokeStyle = `rgba(100, 200, 255, ${this.intensity * 0.2})`;
            this.ctx.lineWidth = 1;

            this.fluxLines.forEach(l => {
                const lx = l.x * w;
                const ly = l.y * h;
                const currentRot = l.rot + Math.sin(this.time * l.speed) * 0.5;

                this.ctx.beginPath();
                this.ctx.moveTo(lx, ly);
                this.ctx.lineTo(
                    lx + Math.cos(currentRot) * l.len,
                    ly + Math.sin(currentRot) * l.len
                );
                this.ctx.stroke();

                // Move slowly
                l.y -= 0.001;
                if (l.y < -0.2) l.y = 1.2;
            });
            this.ctx.restore();
        }
    }

    drawCompass(x, y, radius) {
        this.ctx.save();
        this.ctx.translate(x, y);

        // Outer ring
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
        this.ctx.stroke();

        // Compass Needle
        this.ctx.rotate(this.angle);

        // North (Red)
        this.ctx.fillStyle = 'rgba(255, 50, 50, 0.8)';
        this.ctx.beginPath();
        this.ctx.moveTo(0, -radius + 10);
        this.ctx.lineTo(5, 0);
        this.ctx.lineTo(-5, 0);
        this.ctx.fill();

        // South (White)
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.beginPath();
        this.ctx.moveTo(0, radius - 10);
        this.ctx.lineTo(5, 0);
        this.ctx.lineTo(-5, 0);
        this.ctx.fill();

        this.ctx.restore();

        // Label
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.font = '10px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('MAG-FLUX', x, y + radius + 15);
    }
}
