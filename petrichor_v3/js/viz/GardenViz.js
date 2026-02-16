export default class GardenViz {
    constructor(canvas, ctx, botanyModule) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.botany = botanyModule;
        this.wind = 0;
        this.time = 0;
    }

    update(params) {
        this.wind = params.wind;
        this.time += 0.01 + this.wind * 0.05;

        // Render inputs handled by VisualCore loop
        this.render();
    }

    render() {
        const plants = this.botany.getPlants();

        // Sort by Y for depth
        plants.sort((a, b) => a.y - b.y);

        plants.forEach(p => {
            this.drawPlant(p);
        });
    }

    drawPlant(p) {
        if (p.height < 1) return;

        this.ctx.save();
        this.ctx.translate(p.x, p.y);

        // Sway
        const sway = Math.sin(this.time + p.swayOffset) * (this.wind * 10 + 2) * (p.height / 100);
        this.ctx.rotate(sway * 0.01);

        if (p.type === 'fern') this.drawFern(p);
        else if (p.type === 'flower') this.drawFlower(p);
        else if (p.type === 'reed') this.drawReed(p);

        this.ctx.restore();
    }

    drawFern(p) {
        this.ctx.strokeStyle = '#4caf50';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();

        // Main stem
        this.ctx.moveTo(0, 0);
        this.ctx.quadraticCurveTo(5, -p.height / 2, 0, -p.height);
        this.ctx.stroke();

        // Leaves
        const leaves = 5 + Math.floor(p.seed * 5);
        for (let i = 0; i < leaves; i++) {
            const h = (i / leaves) * p.height;
            const w = (1 - i / leaves) * 20;

            this.ctx.beginPath();
            this.ctx.moveTo(0, -h);
            this.ctx.lineTo(-w, -h - 5);
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.moveTo(0, -h);
            this.ctx.lineTo(w, -h - 5);
            this.ctx.stroke();
        }
    }

    drawFlower(p) {
        this.ctx.strokeStyle = '#8bc34a';
        this.ctx.lineWidth = 2;

        // Stem
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(0, -p.height);
        this.ctx.stroke();

        // Bloom
        if (p.age > 0.8) {
            this.ctx.fillStyle = `hsl(${p.seed * 360}, 70%, 70%)`;
            this.ctx.beginPath();
            this.ctx.arc(0, -p.height, 5 + p.seed * 5, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = '#fff';
            this.ctx.beginPath();
            this.ctx.arc(0, -p.height, 2, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    drawReed(p) {
        this.ctx.strokeStyle = '#795548';
        this.ctx.lineWidth = 1; // Reeds are thin

        // Clump
        for (let i = 0; i < 3; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            const ang = (i - 1) * 0.1;
            const h = p.height * (0.8 + Math.random() * 0.4);
            this.ctx.lineTo(Math.sin(ang) * h * 0.2, -h);
            this.ctx.stroke();
        }

        // Head
        if (p.age > 0.9) {
            this.ctx.lineWidth = 4;
            this.ctx.strokeStyle = '#5d4037';
            this.ctx.beginPath();
            this.ctx.moveTo(0, -p.height * 0.8);
            this.ctx.lineTo(0, -p.height);
            this.ctx.stroke();
        }
    }
}
