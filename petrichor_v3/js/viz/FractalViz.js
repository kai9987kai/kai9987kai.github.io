export default class FractalViz {
    constructor(canvas, audio) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.audio = audio;
        this.width = canvas.width;
        this.height = canvas.height;

        this.params = {
            recursion: 0.1,
            symmetry: 0.5,
            divergence: 0.1,
            active: true
        };

        this.rotation = 0;
    }

    resize() {
        this.width = this.canvas.width;
        this.height = this.canvas.height;
    }

    update(params) {
        if (params.recursion !== undefined) this.params.recursion = params.recursion;
        if (params.symmetry !== undefined) this.params.symmetry = params.symmetry;
        if (params.divergence !== undefined) this.params.divergence = params.divergence;
        if (params.active !== undefined) this.params.active = params.active;

        this.rotation += 0.005 * (1.0 + this.params.divergence * 2);
    }

    draw(mainCtx) {
        if (!this.params.active || this.params.recursion < 0.05) return;

        const maxDepth = Math.floor(1 + this.params.recursion * 6);
        const cx = this.width / 2;
        const cy = this.height / 2;

        mainCtx.save();
        mainCtx.translate(cx, cy);
        mainCtx.rotate(this.rotation);

        this.drawRecursive(mainCtx, 0, 0, this.width * 0.15, 0, maxDepth);

        mainCtx.restore();
    }

    drawRecursive(ctx, x, y, size, angle, depth) {
        if (depth <= 0) return;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Harmonic Reactivity
        const alpha = 0.2 + (this.params.recursion * 0.5);
        ctx.strokeStyle = `rgba(100, 255, 218, ${alpha})`;
        ctx.lineWidth = depth;

        // Draw geometric segment
        ctx.beginPath();
        ctx.moveTo(-size, 0);
        ctx.lineTo(size, 0);
        ctx.stroke();

        // Branching logic (Fractal)
        const newSize = size * (0.6 + this.params.symmetry * 0.2);
        const spread = Math.PI * (0.2 + this.params.divergence * 0.4);

        // Recursion
        this.drawRecursive(ctx, -size, 0, newSize, spread, depth - 1);
        this.drawRecursive(ctx, size, 0, newSize, -spread, depth - 1);

        ctx.restore();
    }
}
