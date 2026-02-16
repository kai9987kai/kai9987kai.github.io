/**
 * TidalViz.js
 * Visualizer for TidalRhythm showing concentric pulse rings expanding from center,
 * with particle flotsam and wave interference patterns.
 */
export default class TidalViz {
    constructor(canvas) {
        this.canvas = canvas;
        if (canvas) {
            this.ctx = canvas.getContext('2d');
            this.width = canvas.width;
            this.height = canvas.height;
        }

        this.rings = [];
        this.particles = [];
        this.active = true;
        this.intensity = 0;
        this.phase = 0;
    }

    resize() {
        if (!this.canvas) return;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
    }

    addRing(layer = 0) {
        const colors = [
            'rgba(0, 200, 255, ',   // Cyan
            'rgba(0, 100, 255, ',   // Blue
            'rgba(120, 200, 255, '  // Light blue
        ];
        this.rings.push({
            x: this.width / 2,
            y: this.height / 2,
            radius: 5,
            maxRadius: Math.max(this.width, this.height) * 0.6,
            speed: 1.5 + layer * 0.5,
            alpha: 0.8,
            color: colors[layer % colors.length],
            lineWidth: 2 + layer
        });
    }

    addParticle() {
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 50;
        this.particles.push({
            x: this.width / 2 + Math.cos(angle) * dist,
            y: this.height / 2 + Math.sin(angle) * dist,
            vx: Math.cos(angle) * (0.5 + Math.random()),
            vy: Math.sin(angle) * (0.5 + Math.random()),
            life: 1.0,
            decay: 0.005 + Math.random() * 0.01,
            size: 1 + Math.random() * 3,
            hue: 180 + Math.random() * 40
        });
    }

    draw(tidalPhase, intensity) {
        if (!this.ctx || !this.canvas) return;

        this.intensity = intensity || 0;
        this.phase = tidalPhase || 0;

        const w = this.width;
        const h = this.height;
        const cx = w / 2;
        const cy = h / 2;

        // Semi-transparent clear for trail effect
        this.ctx.fillStyle = 'rgba(0, 5, 15, 0.15)';
        this.ctx.fillRect(0, 0, w, h);

        if (this.intensity < 0.01) return;

        // Wave interference pattern (background)
        const tidalMod = (Math.sin(this.phase) + 1) * 0.5;

        this.ctx.save();
        this.ctx.globalAlpha = this.intensity * 0.15;
        for (let y = 0; y < h; y += 8) {
            for (let x = 0; x < w; x += 8) {
                const dx = x - cx;
                const dy = y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const wave1 = Math.sin(dist * 0.03 - this.phase * 3) * 0.5 + 0.5;
                const wave2 = Math.sin(dist * 0.05 + this.phase * 2) * 0.5 + 0.5;
                const interference = wave1 * wave2;

                if (interference > 0.7) {
                    this.ctx.fillStyle = `rgba(0, ${150 + interference * 100}, 255, ${interference * 0.3})`;
                    this.ctx.fillRect(x, y, 6, 6);
                }
            }
        }
        this.ctx.restore();

        // Draw rings
        this.rings = this.rings.filter(ring => {
            ring.radius += ring.speed;
            ring.alpha -= 0.008;

            if (ring.alpha <= 0 || ring.radius > ring.maxRadius) return false;

            this.ctx.beginPath();
            this.ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
            this.ctx.strokeStyle = ring.color + ring.alpha + ')';
            this.ctx.lineWidth = ring.lineWidth * ring.alpha;
            this.ctx.stroke();

            // Secondary inner glow
            this.ctx.beginPath();
            this.ctx.arc(ring.x, ring.y, ring.radius * 0.98, 0, Math.PI * 2);
            this.ctx.strokeStyle = ring.color + (ring.alpha * 0.3) + ')';
            this.ctx.lineWidth = ring.lineWidth * 3 * ring.alpha;
            this.ctx.stroke();

            return true;
        });

        // Draw particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            p.vx *= 0.99;
            p.vy *= 0.99;

            if (p.life <= 0) return false;

            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            this.ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${p.life * 0.7})`;
            this.ctx.fill();

            return true;
        });

        // Center glow
        const glowSize = 30 + tidalMod * 20;
        const gradient = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, glowSize);
        gradient.addColorStop(0, `rgba(0, 200, 255, ${0.3 * this.intensity * tidalMod})`);
        gradient.addColorStop(0.5, `rgba(0, 100, 200, ${0.1 * this.intensity})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(cx - glowSize, cy - glowSize, glowSize * 2, glowSize * 2);

        // Spawn particles on beats
        if (Math.random() < this.intensity * 0.3) {
            this.addParticle();
        }
    }
}
