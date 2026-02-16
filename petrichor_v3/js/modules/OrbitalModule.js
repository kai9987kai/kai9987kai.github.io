export default class OrbitalModule {
    constructor() {
        this.startTime = Date.now();
        this.planets = {
            mercury: { period: 4, value: 0, angle: 0 },
            venus: { period: 10, value: 0, angle: 0 },
            earth: { period: 20, value: 0, angle: 0 },
            mars: { period: 40, value: 0, angle: 0 },
            jupiter: { period: 100, value: 0, angle: 0 }
        };
    }

    update() {
        const now = Date.now();
        const elapsed = (now - this.startTime) / 1000;

        for (const key in this.planets) {
            const p = this.planets[key];
            // Calculate angle: 0 to 2PI
            // angle = (elapsed / period) * 2PI
            p.angle = (elapsed / p.period) * (Math.PI * 2);

            // Value: 0 to 1 Sine
            // sin is -1 to 1. 
            // Normalize: (sin + 1) / 2
            p.value = (Math.sin(p.angle) + 1) / 2;
        }
    }

    getValue(planet) {
        if (this.planets[planet]) return this.planets[planet].value;
        return 0;
    }

    getAngle(planet) {
        if (this.planets[planet]) return this.planets[planet].angle;
        return 0;
    }
}
