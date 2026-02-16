class Boid {
    constructor(x, y, type) {
        this.position = { x, y };
        this.velocity = { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 };
        this.acceleration = { x: 0, y: 0 };
        this.type = type; // 'bird', 'fish', 'drone'
        this.maxForce = 0.05;
        this.maxSpeed = type === 'drone' ? 1.5 : (type === 'fish' ? 1 : 3);
        this.size = type === 'drone' ? 3 : 4;
    }

    update() {
        this.velocity.x += this.acceleration.x;
        this.velocity.y += this.acceleration.y;

        // Limit speed
        const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
        if (speed > this.maxSpeed) {
            this.velocity.x = (this.velocity.x / speed) * this.maxSpeed;
            this.velocity.y = (this.velocity.y / speed) * this.maxSpeed;
        }

        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
        this.acceleration.x = 0;
        this.acceleration.y = 0;
    }

    applyForce(force) {
        this.acceleration.x += force.x;
        this.acceleration.y += force.y;
    }

    flock(boids) {
        let align = { x: 0, y: 0 };
        let cohesion = { x: 0, y: 0 };
        let separation = { x: 0, y: 0 };
        let perception = 50;
        let total = 0;

        for (let other of boids) {
            const d = Math.sqrt((this.position.x - other.position.x) ** 2 + (this.position.y - other.position.y) ** 2);
            if (other !== this && d < perception) {
                align.x += other.velocity.x;
                align.y += other.velocity.y;

                cohesion.x += other.position.x;
                cohesion.y += other.position.y;

                const diff = { x: this.position.x - other.position.x, y: this.position.y - other.position.y };
                separation.x += diff.x / d; // Weight by distance
                separation.y += diff.y / d;

                total++;
            }
        }

        if (total > 0) {
            align.x /= total;
            align.y /= total;
            // Steer towards align
            align.x = (align.x / Math.sqrt(align.x ** 2 + align.y ** 2)) * this.maxSpeed || 0;
            align.y = (align.y / Math.sqrt(align.x ** 2 + align.y ** 2)) * this.maxSpeed || 0;
            align.x -= this.velocity.x;
            align.y -= this.velocity.y;
            // Limit force

            cohesion.x /= total;
            cohesion.y /= total;
            // Steer towards cohesion
            const desired = { x: cohesion.x - this.position.x, y: cohesion.y - this.position.y };
            // Normalize desired
            // ... simplified steering logic for brevity
        }

        // Apply weights
        // Separation is most important to avoid crowding
        this.applyForce({ x: separation.x * 1.5, y: separation.y * 1.5 });
        this.applyForce({ x: align.x * 1.0, y: align.y * 1.0 });
        // Cohesion * 1.0

        if (total > 0) {
            const steer = { x: cohesion.x - this.position.x, y: cohesion.y - this.position.y };
            // normalize steer
            const mag = Math.sqrt(steer.x ** 2 + steer.y ** 2);
            if (mag > 0) {
                steer.x = (steer.x / mag) * this.maxSpeed - this.velocity.x;
                steer.y = (steer.y / mag) * this.maxSpeed - this.velocity.y;
            }
            this.applyForce({ x: steer.x * 1.0, y: steer.y * 1.0 });
        }
    }

    edges(w, h) {
        if (this.position.x > w) this.position.x = 0;
        else if (this.position.x < 0) this.position.x = w;
        if (this.position.y > h) this.position.y = 0;
        else if (this.position.y < 0) this.position.y = h;
    }
}

export default class FaunaViz {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.boids = [];
        this.biome = 'forest';
        this.density = 0.5;
        this.targetCount = 20;
    }

    resize() {
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = this.canvas.parentElement.clientHeight;
    }

    update(params) {
        if (params.biome) {
            this.biome = params.biome;
        }
        if (params.life !== undefined) {
            this.density = params.life;
            this.targetCount = Math.floor(this.density * 50); // Max 50
        }

        // Adjust population
        while (this.boids.length < this.targetCount) {
            const type = this.biome === 'ocean' ? 'fish' : (this.biome === 'city' ? 'drone' : 'bird');
            this.boids.push(new Boid(Math.random() * this.canvas.width, Math.random() * this.canvas.height, type));
        }
        while (this.boids.length > this.targetCount) {
            this.boids.pop();
        }
    }

    draw() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        const type = this.biome === 'ocean' ? 'fish' : (this.biome === 'city' ? 'drone' : 'bird');

        for (let boid of this.boids) {
            // Update Type if biome changed
            if (boid.type !== type) boid.type = type;

            boid.flock(this.boids);
            boid.update();
            boid.edges(w, h);

            // Draw
            this.ctx.save();
            this.ctx.translate(boid.position.x, boid.position.y);

            if (boid.type === 'bird') {
                const angle = Math.atan2(boid.velocity.y, boid.velocity.x);
                this.ctx.rotate(angle);
                this.ctx.fillStyle = '#d4a017'; // Gold
                this.ctx.beginPath();
                this.ctx.moveTo(5, 0);
                this.ctx.lineTo(-5, 3);
                this.ctx.lineTo(-5, -3);
                this.ctx.fill();
            } else if (boid.type === 'fish') {
                const angle = Math.atan2(boid.velocity.y, boid.velocity.x);
                this.ctx.rotate(angle);
                this.ctx.fillStyle = '#00bcd4'; // Cyan
                this.ctx.beginPath();
                this.ctx.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2);
                this.ctx.fill();
            } else if (boid.type === 'drone') {
                // No rotation for hover drones? Or banking?
                // Let's float them.
                this.ctx.fillStyle = '#ff4444'; // Red Light
                this.ctx.fillRect(-2, -2, 4, 4);
                // Blink
                if (Date.now() % 1000 < 100) {
                    this.ctx.fillStyle = '#fff';
                    this.ctx.fillRect(-1, -1, 2, 2);
                }
            }

            this.ctx.restore();
        }
    }
}
