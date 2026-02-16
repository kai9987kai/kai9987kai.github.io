export default class WeatherModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;

        this.pressure = 0.5; // 0.0 (Stormy/Low) to 1.0 (Fair/High)
        this.autoWeather = false;
        this.lastUpdateTime = 0;

        // Atmospheric Filter (Master Mood)
        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 20000; // Open by default
        this.filter.Q.value = 0.5;

        // Connection will be handled in AudioChassis (inserted into pre-master)
        this.input = this.filter;
        this.filter.connect(this.output);
    }

    update(params) {
        if (params.pressure !== undefined) this.pressure = params.pressure;
        if (params.autoWeather !== undefined) this.autoWeather = params.autoWeather;

        const now = Date.now();
        if (this.autoWeather && now - this.lastUpdateTime > 5000) {
            // Slowly drift pressure
            this.pressure += (Math.random() - 0.5) * 0.05;
            this.pressure = Math.max(0.1, Math.min(1.0, this.pressure));
            this.lastUpdateTime = now;
        }

        this.applyAtmosphere();
    }

    applyAtmosphere() {
        const t = this.ctx.currentTime;

        // Map pressure to filter frequency
        // 0.0 -> 500Hz (Muffled, heavy)
        // 1.0 -> 20000Hz (Bright, crisp)
        const cutoff = 500 + Math.pow(this.pressure, 2) * 19500;
        this.filter.frequency.setTargetAtTime(cutoff, t, 0.5);

        // Low pressure also increases resonance slightly for a "tighter" feel
        this.filter.Q.setTargetAtTime(0.5 + (1.0 - this.pressure) * 2, t, 0.5);
    }

    getSynergyTargets() {
        if (!this.autoWeather) return null;

        // Low pressure pushes for more rain/wind
        return {
            rain: Math.max(0, 1.0 - this.pressure * 1.5),
            wind: Math.max(0, 0.8 - this.pressure)
        };
    }
}
