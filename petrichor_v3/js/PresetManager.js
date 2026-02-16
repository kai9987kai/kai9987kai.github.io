export default class PresetManager {
    constructor(audioChassis) {
        this.audio = audioChassis;
        this.storageKey = 'petrichor_v3_presets';
        this.presets = this.loadPresets();
    }

    loadPresets() {
        // Default presets
        const defaults = {
            'Cyberpunk': {
                rain: 0.8, drops: 0.5, wind: 0.2, thunder: 0.1, traffic: 0.8,
                time: 23, biome: 0.8, lofi: 0.6,
                harmony: 0, space: 0.5, binaural: 0,
                surface: 'street', reverb: 'alley', master: 0.8
            },
            'Zen Garden': {
                rain: 0.3, drops: 0.6, wind: 0.4, thunder: 0, traffic: 0,
                time: 10, biome: 1.0, lofi: 0,
                harmony: 0.6, space: 0.8, binaural: 0.5, // Alpha
                surface: 'soil', reverb: 'field', master: 0.7
            },
            'Deep Sleep': {
                rain: 0.6, drops: 0.2, wind: 0.1, thunder: 0.2, traffic: 0,
                time: 3, biome: 0.5, lofi: 0.2,
                harmony: 0.3, space: 0.2, binaural: 2.5, // Delta
                surface: 'soil', reverb: 'hall', master: 0.6
            }
        };

        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                return { ...defaults, ...JSON.parse(stored) };
            }
        } catch (e) {
            console.error("Failed to load presets", e);
        }
        return defaults;
    }

    savePreset(name) {
        // Capture current params
        const current = { ...this.audio.params };
        // We also need surface/reverb text params?
        // AudioChassis params usually stores numbers.
        // Let's check AudioChassis... it has `params` object but `surface` and `reverb` might be separate state?
        // In AudioChassis, `params` doesn't seem to have surface/reverb strings, just numbers?
        // Wait, EnvModule handles surface. ReverbModule handles reverb.
        // AudioChassis params object in older steps:
        /*
        this.params = {
            rain: 0.5, ...
        };
        */
        // It doesn't track strings. I need to ask UIHub or AudioChassis for them.
        // But `AudioChassis` doesn't store surface/reverb state in `this.params`.
        // I should probably update `AudioChassis` to store them or just grab them from UI?
        // Better to grab from AudioChassis if possible.
        // `EnvModule` has `surfaceType`. `ReverbModule` has `impulseName`.

        current.surface = this.audio.envModule ? this.audio.envModule.surfaceType : 'street';
        current.reverb = this.audio.reverbModule ? this.audio.reverbModule.activeImpulse : 'alley';

        this.presets[name] = current;
        this.persist();
    }

    deletePreset(name) {
        if (this.presets[name]) {
            delete this.presets[name];
            this.persist();
        }
    }

    persist() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.presets));
        } catch (e) {
            console.error("Failed to save presets", e);
        }
    }

    applyPreset(name) {
        const p = this.presets[name];
        if (!p) return;

        // Apply all numeric params
        Object.keys(p).forEach(key => {
            if (typeof p[key] === 'number') {
                this.audio.setParam(key, p[key]);
            }
        });

        // Apply strings
        if (p.surface && this.audio.envModule) this.audio.envModule.setSurface(p.surface);
        if (p.reverb && this.audio.reverbModule) this.audio.reverbModule.loadImpulse(p.reverb);

        return p; // Return for UI update
    }

    getNames() {
        return Object.keys(this.presets);
    }
}
