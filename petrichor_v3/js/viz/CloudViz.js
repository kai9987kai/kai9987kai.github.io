export default class CloudViz {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.clouds = [];
        this.maxClouds = 20;
        this.pressure = 0.5;
        this.wind = 0.1;
        this.time = 12;

        this.init();
        window.addEventListener('resize', () => this.resize());
    }

    init() {
        this.resize();
        for (let i = 0; i < this.maxClouds; i++) {
            this.spawnCloud(Math.random() * this.canvas.width);
        }
    }

    resize() {
        if (!this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    spawnCloud(startX = -100) {
        this.clouds.push({
            x: startX,
            y: Math.random() * this.canvas.height * 0.4,
            scale: 0.5 + Math.random() * 1.5,
            opacity: 0.1 + Math.random() * 0.3,
            speed: 0.2 + Math.random() * 0.5,
            seed: Math.random(),
            puffs: Array.from({ length: 5 }, () => ({
                dx: (Math.random() - 0.5) * 40,
                dy: (Math.random() - 0.5) * 20,
                r: 20 + Math.random() * 30
            }))
        });
    }

    update(params) {
        this.pressure = params.pressure || 0.5;
        this.wind = params.wind || 0.1;
        this.time = params.time || 12;

        // Move clouds
        this.clouds.forEach(c => {
            c.x += c.speed * (0.5 + this.wind * 2);
            if (c.x > this.canvas.width + 200) {
                c.x = -200;
                c.y = Math.random() * this.canvas.height * 0.4;
            }
        });

        // Limit count by pressure
        const targetCount = Math.floor(5 + (1.0 - this.pressure) * 15);
        if (this.clouds.length > targetCount) this.clouds.pop();
        else if (this.clouds.length < targetCount) this.spawnCloud();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Map pressure to cloud color
        // Low pressure (0.0) -> Dark grey/blue
        // High pressure (1.0) -> White
        const gray = Math.floor(100 + this.pressure * 155);

        // Time of day influence (Night = darker/blue tint)
        const isNight = this.time < 6 || this.time > 19;
        const nightFactor = isNight ? 0.4 : 1.0;
        const color = `rgba(${gray * nightFactor}, ${gray * nightFactor}, ${(gray + (isNight ? 20 : 0)) * nightFactor},`;

        this.clouds.forEach(c => {
            this.ctx.save();
            this.ctx.translate(c.x, c.y);
            this.ctx.scale(c.scale, c.scale);

            this.ctx.fillStyle = color + c.opacity + ')';

            // Soft shadow/depth
            if (!isNight) {
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = 'rgba(0,0,0,0.1)';
            }

            c.puffs.forEach(p => {
                this.ctx.beginPath();
                this.ctx.arc(p.dx, p.dy, p.r, 0, Math.PI * 2);
                this.ctx.fill();
            });

            this.ctx.restore();
            this.ctx.shadowBlur = 0;
        });
    }
}
