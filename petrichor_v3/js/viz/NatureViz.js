export default class NatureViz {
    constructor(canvas, rainViz) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.rainViz = rainViz; // Reference to know rain state

        this.vines = [];
        this.growthRate = 0;
        this.maxVines = 50;

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    spawnVine() {
        if (this.vines.length >= this.maxVines) return;

        // Start from random edge
        const startX = Math.random() * this.canvas.width;
        const startY = this.canvas.height + 10;

        this.vines.push({
            points: [{ x: startX, y: startY }],
            angle: -Math.PI / 2 + (Math.random() - 0.5), // Upwards-ish
            width: 2 + Math.random() * 3,
            color: `hsl(${100 + Math.random() * 60}, 60%, ${20 + Math.random() * 20}%)`,
            life: 1,
            growth: 0
        });
    }

    update(rainIntensity) {
        // Growth logic
        // Rain > 0.3 promotes growing
        // Rain < 0.1 promotes dying

        if (rainIntensity > 0.3) {
            this.growthRate = 0.5 + (rainIntensity - 0.3);
            if (Math.random() < 0.05 * rainIntensity) this.spawnVine();
        } else {
            this.growthRate = -0.1;
        }

        // Grow/Shrink vines
        this.vines = this.vines.filter(vine => {
            if (this.growthRate > 0 && vine.life > 0) {
                // Grow new point
                const last = vine.points[vine.points.length - 1];

                // Meander
                vine.angle += (Math.random() - 0.5) * 0.5;

                // Gravity/Upward bias
                vine.angle = (vine.angle * 0.95) + (-Math.PI / 2 * 0.05);

                const len = 2; // Segment length
                const nx = last.x + Math.cos(vine.angle) * len;
                const ny = last.y + Math.sin(vine.angle) * len;

                if (ny < 0 || nx < 0 || nx > this.canvas.width) {
                    vine.life = 0; // Stop growing at edges
                } else {
                    vine.points.push({ x: nx, y: ny });
                }
            } else if (this.growthRate < 0) {
                // Wither (remove oldest points or fade opacity?)
                // Let's remove points from tip to recede
                if (vine.points.length > 1) {
                    vine.points.pop();
                } else {
                    return false; // Dead
                }
            }
            return vine.points.length > 0;
        });
    }

    draw(botanyModule) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Background Vines (NatureViz internal system)
        this.vines.forEach(vine => {
            this.ctx.beginPath();
            this.ctx.strokeStyle = vine.color;
            this.ctx.lineWidth = vine.width;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';

            if (vine.points.length < 2) return;

            this.ctx.moveTo(vine.points[0].x, vine.points[0].y);
            for (let i = 1; i < vine.points.length; i++) {
                this.ctx.lineTo(vine.points[i].x, vine.points[i].y);
            }
            this.ctx.stroke();
        });

        // Draw Individual Plants (BotanyModule system)
        if (botanyModule && botanyModule.plants) {
            botanyModule.plants.forEach(p => {
                this.drawPlant(p);
            });
        }
    }

    drawPlant(p) {
        const ctx = this.ctx;
        const h = p.height;
        if (h < 1) return;

        // Pollination highlight
        if (p.pollinated) {
            ctx.save();
            ctx.translate(p.x, p.y - h);
            ctx.fillStyle = 'rgba(255, 255, 100, 0.2)';
            ctx.beginPath();
            ctx.arc(0, 0, 15 * p.age, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        ctx.save();
        ctx.translate(p.x, p.y);

        // Sway
        const time = Date.now() / 1000;
        const sway = Math.sin(time + p.swayOffset) * (p.age * 5);
        ctx.rotate(sway * Math.PI / 180);

        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2 + p.age * 3;
        ctx.lineCap = 'round';

        // Stem
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(sway, -h / 2, 0, -h);
        ctx.stroke();

        // Type-specific features
        if (p.type === 'flower') {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(0, -h, 4 * p.age, 0, Math.PI * 2);
            ctx.fill();
        } else if (p.type === 'luminescent') {
            // Inner glow
            ctx.shadowBlur = 15;
            ctx.shadowColor = p.color;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(0, -h, 3 * p.age, 0, Math.PI * 2);
            ctx.fill();

            // Outer pulse
            const pulse = 0.5 + Math.sin(time * 3 + p.swayOffset) * 0.5;
            ctx.globalAlpha = 0.3 * pulse;
            ctx.beginPath();
            ctx.arc(0, -h, 10 * p.age, 0, Math.PI * 2);
            ctx.fill();
        } else if (p.type === 'shadow') {
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, -h);
            ctx.lineTo(-5 * p.age, -h + 10);
            ctx.moveTo(0, -h);
            ctx.lineTo(5 * p.age, -h + 10);
            ctx.stroke();
        } else if (p.type === 'fungi') {
            // Mushroom Stalk
            ctx.strokeStyle = '#e0d0c0';
            ctx.lineWidth = 4 * p.age;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -h * 0.4);
            ctx.stroke();

            // Mushroom Cap
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.ellipse(0, -h * 0.4, 10 * p.age, 6 * p.age, 0, 0, Math.PI * 2);
            ctx.fill();

            // Spots
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.arc(-3 * p.age, -h * 0.45, 2 * p.age, 0, Math.PI * 2);
            ctx.arc(4 * p.age, -h * 0.38, 1.5 * p.age, 0, Math.PI * 2);
            ctx.fill();
        } else if (p.type === 'mycelium') {
            // Horizontal fibers
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-10 * p.age, 0);
            ctx.lineTo(10 * p.age, 0);

            // Random branches
            for (let i = 0; i < 3; i++) {
                const angle = (Math.random() - 0.5) * Math.PI;
                const len = 5 * p.age + Math.random() * 5;
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len * 0.2);
            }
            ctx.stroke();
        } else if (p.type === 'tree') {
            // Trunk
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 8 * p.age;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -h);
            ctx.stroke();

            // Branches
            p.branches.forEach(b => {
                ctx.lineWidth = (4 * p.age) * b.age;
                ctx.beginPath();
                ctx.moveTo(0, -b.y);
                ctx.lineTo(b.length * b.side * b.age, -b.y - 10 * b.age);
                ctx.stroke();
            });

            // Fruit
            p.fruit.forEach(f => {
                ctx.save();
                // Fruit is stored in absolute coords relative to plant origin in BotanyModule.js
                // But NatureViz.js translates to p.x, p.y and rotates for sway.
                // We need to undo the rotation for falling fruit or keep it?
                // Actually, let's keep it attached unless falling.

                if (f.isFalling) {
                    ctx.restore(); // Undo translate/rotate for falling fruit
                    ctx.save();
                    ctx.translate(f.x, f.y);
                } else {
                    // Relative to plant origin (0,0 is plant base, -h is top)
                    ctx.translate(f.x - p.x, f.y - p.y);
                }

                ctx.fillStyle = '#ff3333'; // Red fruit
                ctx.beginPath();
                ctx.arc(0, 0, f.size, 0, Math.PI * 2);
                ctx.fill();

                // Shine
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.beginPath();
                ctx.arc(-f.size * 0.3, -f.size * 0.3, f.size * 0.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });
        }

        ctx.restore();
    }
}
