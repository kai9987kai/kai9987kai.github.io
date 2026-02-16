export default class CityViz {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.buildings = [];
        this.active = false;
        this.resize(); // Init dims to avoid empty build
        this.initCity();
    }

    setActive(active) {
        this.active = active;
        if (!this.active) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    resize() {
        if (!this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.initCity();
    }

    initCity() {
        this.buildings = [];
        const w = this.canvas.width;
        if (w === 0) return;

        let x = 0;
        while (x < w) {
            this.addBuilding(x);
            // Manually adjust x of last added building to prepare for next
            const last = this.buildings[this.buildings.length - 1];
            x += last.w - 10; // Overlap
        }
    }

    update(params) {
        // Travel
        if (params.speed && params.speed > 0) {
            const shift = params.speed * 5;

            // Move existing
            this.buildings.forEach(b => {
                b.x -= shift;
            });

            // Remove off-screen
            this.buildings = this.buildings.filter(b => b.x + b.w > 0);

            // Add new if gap at end
            const last = this.buildings[this.buildings.length - 1];
            if (last && (last.x + last.w < this.canvas.width)) {
                this.addBuilding(this.canvas.width);
            } else if (this.buildings.length === 0) {
                this.addBuilding(this.canvas.width);
            }
        }

        // Build silhouettes don't move (unless travel).
        // Windows might flicker occasionally.
        if (Math.random() < 0.05) {
            // Pick random building, random window, toggle
            if (this.buildings.length > 0) {
                const b = this.buildings[Math.floor(Math.random() * this.buildings.length)];
                const win = b.windows[Math.floor(Math.random() * b.windows.length)];
                if (win) win.on = !win.on;
            }
        }
    }

    addBuilding(xOffset) {
        const h = this.canvas.height;
        const bw = 50 + Math.random() * 100;
        const bh = 100 + Math.random() * 300;

        // Windows
        const windows = [];
        const rows = Math.floor(bh / 20);
        const cols = Math.floor(bw / 15);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (Math.random() > 0.6) { // Lit window chance
                    windows.push({
                        rx: c * 15 + 5,
                        ry: r * 20 + 5,
                        rw: 8,
                        rh: 12,
                        on: Math.random() > 0.2 // Some flickering
                    });
                }
            }
        }

        this.buildings.push({
            x: xOffset,
            y: h - bh,
            w: bw,
            h: bh,
            windows: windows
        });
    }

    draw() {
        if (!this.active) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.buildings.forEach(b => {
            // Silhouette
            this.ctx.fillStyle = '#10151a'; // Very dark blue/grey
            this.ctx.fillRect(b.x, b.y, b.w, b.h);

            // Windows
            b.windows.forEach(w => {
                if (w.on) {
                    this.ctx.fillStyle = Math.random() > 0.9 ? '#ffffcc' : '#ffeeaa'; // Warm light
                    this.ctx.globalAlpha = 0.8;
                    this.ctx.fillRect(b.x + w.rx, b.y + w.ry, w.rw, w.rh);
                }
            });
            this.ctx.globalAlpha = 1;
        });
    }
}
