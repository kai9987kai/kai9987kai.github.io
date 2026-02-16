export default class CartographerModule {
    constructor(ctx) {
        this.ctx = ctx;
        this.nodes = new Map(); // Map of moduleName -> { panner, gain, input }
    }

    createSpatialNode(moduleName, outputNode) {
        const input = this.ctx.createGain();
        const panner = this.ctx.createStereoPanner();
        const distanceGain = this.ctx.createGain();

        input.connect(panner);
        panner.connect(distanceGain);
        distanceGain.connect(outputNode);

        this.nodes.set(moduleName, { input, panner, distanceGain });
        return input;
    }

    updatePosition(moduleName, x, y) {
        const node = this.nodes.get(moduleName);
        if (!node) return;

        // x, y are 0-1 (0,0 is center of map 0.5,0.5)
        // Convert to panner value (-1 to 1)
        const panValue = (x * 2) - 1;
        node.panner.pan.setTargetAtTime(panValue, this.ctx.currentTime, 0.1);

        // Distance attenuation (simple circular distance from center)
        const dx = x - 0.5;
        const dy = y - 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy) * 2; // 0 at center, ~1.4 at corners
        const gainValue = Math.max(0.2, 1.0 - (dist * 0.5)); // Min volume 0.2
        node.distanceGain.gain.setTargetAtTime(gainValue, this.ctx.currentTime, 0.1);
    }
}
