export default class FireflyViz {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.flies = [];
        this.maxFlies = 50;
        this.active = false;

        this.mouseX = -100;
        this.mouseY = -100;

        window.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
        });

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    spawnFly() {
        if (this.flies.length >= this.maxFlies) return;

        this.flies.push({
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            size: 1 + Math.random() * 2,
            alpha: 0,
            targetAlpha: 0.5 + Math.random() * 0.5,
            phase: Math.random() * Math.PI * 2,
            blinkSpeed: 0.05 + Math.random() * 0.1
        });
    }

    update(timeOfDay) {
        // Active at night (20:00 - 05:00)
        const isNight = timeOfDay >= 20 || timeOfDay < 5;
        this.active = isNight;

        if (!this.active) {
            this.flies = [];
            return;
        }

        if (this.flies.length < this.maxFlies && Math.random() < 0.05) {
            this.spawnFly();
        }

        this.flies.forEach(fly => {
            // Movement
            fly.x += fly.vx;
            fly.y += fly.vy;

            // Random walk / noise
            fly.vx += (Math.random() - 0.5) * 0.05;
            fly.vy += (Math.random() - 0.5) * 0.05;

            // Damping
            fly.vx *= 0.99;
            fly.vy *= 0.99;

            // Attraction to mouse
            const dx = this.mouseX - fly.x;
            const dy = this.mouseY - fly.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 200 && dist > 10) {
                fly.vx += (dx / dist) * 0.01;
                fly.vy += (dy / dist) * 0.01;
            }

            // Wrap edges
            if (fly.x < 0) fly.x = this.canvas.width;
            if (fly.x > this.canvas.width) fly.x = 0;
            if (fly.y < 0) fly.y = this.canvas.height;
            if (fly.y > this.canvas.height) fly.y = 0;

            // Blink
            fly.phase += fly.blinkSpeed;
            fly.alpha = 0.5 + Math.sin(fly.phase) * 0.5;
        });
    }

    draw() {
        if (!this.active) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            return;
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.flies.forEach(fly => {
            this.ctx.beginPath();
            this.ctx.arc(fly.x, fly.y, fly.size, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(200, 255, 100, ${fly.alpha})`;
            this.ctx.fill();

            // Glow
            const glow = this.ctx.createRadialGradient(fly.x, fly.y, 0, fly.x, fly.y, fly.size * 4);
            glow.addColorStop(0, `rgba(200, 255, 100, ${fly.alpha * 0.5})`);
            glow.addColorStop(1, 'rgba(200, 255, 100, 0)');
            this.ctx.fillStyle = glow;
            this.ctx.beginPath();
            this.ctx.arc(fly.x, fly.y, fly.size * 4, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
}
