export default class RainViz {
    constructor(ctx, width, height) {
        this.ctx = ctx;
        this.width = width;
        this.height = height;
        this.drops = [];
        this.splashes = [];

        this.params = {
            intensity: 0.5,
            wind: 0,
            thunder: 0,
            season: 'summer' // 'summer' or 'winter'
        };

        this.flashOp = 0;
        this.frame = 0;
    }

    updateParams(params) {
        this.params.intensity = params.rain || 0;
        this.params.wind = params.wind || 0;
        this.params.thunder = params.thunder || 0;
        if (params.season) this.params.season = params.season;
    }

    setSize(w, h) {
        this.width = w;
        this.height = h;
    }

    triggerFlash() {
        this.flashOp = 0.8 + Math.random() * 0.2;
    }

    draw() {
        this.frame++;

        // Flash Decay
        if (this.flashOp > 0) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${this.flashOp})`;
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.flashOp *= 0.9;
        }

        const isSnow = this.params.season === 'winter';
        const count = Math.floor(this.params.intensity * (isSnow ? 4 : 8)); // Less flakes than drops

        // Spawn
        if (Math.random() < this.params.intensity * 2) {
            if (Math.random() < this.params.thunder * 0.01) this.triggerFlash();
        }

        for (let i = 0; i < count; i++) {
            this.drops.push({
                x: Math.random() * this.width,
                y: -10,
                z: Math.random() * 0.5 + 0.5, // Depth (0.5 to 1.0)
                len: 10 + Math.random() * 20,
                drift: Math.random() * Math.PI * 2, // Phase for snow
                size: 2 + Math.random() * 3 // Size for snow
            });
        }

        // Update & Draw
        this.ctx.strokeStyle = isSnow ? '#ffffff' : '#a0c8f0';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();

        const windX = this.params.wind * (isSnow ? 5 : 15); // Less wind effect on heavy snow? Or more drift?

        this.drops = this.drops.filter(d => {
            if (isSnow) {
                // Snow Logic
                d.y += d.z * (2 + this.params.intensity * 2); // Slower
                d.x += windX * d.z * 0.5;
                d.x += Math.sin(this.frame * 0.05 + d.drift) * 0.5; // Meandering

                // Draw Flake
                this.ctx.globalAlpha = d.z * 0.8;
                // Move logic out of draw path if filling circles?
                // Actually `stroke` is used for rain. Snow needs `fill` usually.
                // We can't batch stroke and fill easily if we mix.
                // But here we are all rain OR all snow.
            } else {
                // Rain Logic
                d.y += d.z * (10 + this.params.intensity * 10);
                d.x += windX * d.z;
            }

            // Draw
            if (isSnow) {
                this.ctx.moveTo(d.x, d.y);
                this.ctx.arc(d.x, d.y, d.size * d.z, 0, Math.PI * 2);
            } else {
                this.ctx.globalAlpha = d.z * 0.5;
                this.ctx.lineWidth = d.z * 1.5;
                this.ctx.moveTo(d.x, d.y);
                this.ctx.lineTo(d.x - windX * 0.2, d.y - d.len);
            }

            if (d.y > this.height) {
                // Splash logic (Rain only mainly)
                if (!isSnow && Math.random() > 0.5) {
                    this.splashes.push({
                        x: d.x,
                        y: this.height - Math.random() * 5,
                        r: 0,
                        maxR: Math.random() * 5 + 2,
                        op: 1
                    });
                }
                return false;
            }
            return true;
        });

        if (isSnow) {
            this.ctx.fill(); // Snow
        } else {
            this.ctx.stroke(); // Rain
        }

        // Update & Draw Splashes (Only irrelevant if snow? Maybe snow accumulates?)
        if (!isSnow) {
            this.splashes = this.splashes.filter(s => {
                s.r += 0.5;
                s.op -= 0.05;

                this.ctx.globalAlpha = s.op;
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.ellipse(s.x, s.y, s.r, s.r * 0.3, 0, 0, Math.PI * 2);
                this.ctx.stroke();

                return s.op > 0;
            });
        }

        this.ctx.globalAlpha = 1;
    }
}
