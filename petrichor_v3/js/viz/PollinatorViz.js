export default class PollinatorViz {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.bees = [];
        this.density = 0.5;
        this.maxBees = 15;

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    update(botanyModule) {
        const targetCount = Math.floor(this.maxBees * this.density);

        // Spawn/Initialise
        if (this.bees.length < targetCount && Math.random() < 0.05) {
            this.bees.push(this.createBee());
        }

        // Remove if density dropped
        if (this.bees.length > targetCount) {
            this.bees.pop();
        }

        const flowers = botanyModule ? botanyModule.plants.filter(p =>
            p.type === 'flower' || p.type === 'luminescent' || p.type === 'tree'
        ) : [];

        this.bees.forEach(bee => {
            if (!bee.target || bee.target.age < 0.2 || Math.random() < 0.005) {
                // Find new target
                if (flowers.length > 0) {
                    bee.target = flowers[Math.floor(Math.random() * flowers.length)];
                } else {
                    bee.target = null;
                }
            }

            if (bee.target) {
                const tx = bee.target.x;
                const ty = bee.target.y - bee.target.height;
                const dx = tx - bee.x;
                const dy = ty - bee.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > 5) {
                    bee.vx += (dx / dist) * 0.15;
                    bee.vy += (dy / dist) * 0.15;
                    bee.state = 'flying';
                } else {
                    bee.vx *= 0.8;
                    bee.vy *= 0.8;
                    bee.state = 'probing';
                    // Mark plant as pollinated in BotanyModule? 
                    // We'll handle synergy in BotanyModule.update by checking proximity to bees.
                }
            } else {
                // Just wander
                bee.vx += (Math.random() - 0.5) * 0.1;
                bee.vy += (Math.random() - 0.5) * 0.1;
            }

            // Movement & Physics
            bee.x += bee.vx;
            bee.y += bee.vy;
            bee.vx *= 0.98;
            bee.vy *= 0.98;

            // Random jitter
            bee.vx += (Math.random() - 0.5) * 0.2;
            bee.vy += (Math.random() - 0.5) * 0.2;

            // Bounds
            if (bee.x < 0) bee.vx += 0.5;
            if (bee.x > this.canvas.width) bee.vx -= 0.5;
            if (bee.y < 0) bee.vy += 0.5;
            if (bee.y > this.canvas.height) bee.vy -= 0.5;

            // Data for Audio sync
            bee.canvasWidth = this.canvas.width;
        });
    }

    createBee() {
        return {
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            vx: 0,
            vy: 0,
            target: null,
            state: 'searching',
            seed: Math.random(),
            canvasWidth: this.canvas.width
        };
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const time = Date.now() / 1000;

        this.bees.forEach(bee => {
            this.ctx.save();
            this.ctx.translate(bee.x, bee.y);

            // Body
            this.ctx.fillStyle = '#ffcc00';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 2, 0, Math.PI * 2);
            this.ctx.fill();

            // Wings (flicker)
            const wingSpeed = 20;
            const wingH = Math.sin(time * wingSpeed + bee.seed * 10) * 3;

            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(-2, 0);
            this.ctx.lineTo(-4, -wingH);
            this.ctx.moveTo(2, 0);
            this.ctx.lineTo(4, -wingH);
            this.ctx.stroke();

            // Glow if near target
            if (bee.state === 'probing') {
                this.ctx.shadowBlur = 5;
                this.ctx.shadowColor = '#fff';
            }

            this.ctx.restore();
        });
    }
}
