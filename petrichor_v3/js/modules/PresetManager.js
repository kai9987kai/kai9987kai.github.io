export default class PresetManager {
    constructor() {
        this.storageKey = 'petrichor_v3_presets';
        this.presets = this.loadPresets();
    }

    getFactoryPresets() {
        return {
            'Blade Runner': {
                rain: 0.8,
                drops: 0.5,
                wind: 0.2,
                traffic: 0.6,
                thunder: 0.1,
                biome: 'city',
                season: 'summer',
                time: 22.0, // Night
                vhs: true,
                cinema: true,
                dream: false,
                lofi: 0.3,
                harmony: 0.7, // Synth
                aurora: false
            },
            'Cabin Fever': {
                rain: 0.6,
                drops: 0.7,
                wind: 0.6,
                thunder: 0.3,
                biome: 'forest',
                season: 'winter',
                time: 20.0,
                hearth: true,
                piano: 0.6,
                vhs: false,
                cinema: false,
                dream: true
            },
            'Cosmic Drift': {
                rain: 0,
                drops: 0,
                wind: 0.4,
                biome: 'ocean',
                season: 'summer',
                time: 2.0, // Deep night
                binaural: true,
                binauralMode: 'theta',
                aurora: true,
                space: 0.8,
                chimes: 0.6,
                strings: 0.7,
                dream: true
            },
            'Zen Garden': {
                rain: 0.2,
                drops: 0.3,
                wind: 0.1,
                biome: 'forest',
                season: 'summer',
                time: 10.0, // Morning
                respire: true,
                chimes: 0.8,
                life: 0.7, // Birds
                vhs: false,
                cinema: false
            }
        };
    }

    loadPresets() {
        const stored = localStorage.getItem(this.storageKey);
        const userPresets = stored ? JSON.parse(stored) : {};
        // Merge with factory
        return { ...this.getFactoryPresets(), ...userPresets };
    }

    savePreset(name, params, extraData = {}) {
        // Filter params to only save relevant state
        const snapshot = { ...params, ...extraData };

        const stored = localStorage.getItem(this.storageKey);
        const userPresets = stored ? JSON.parse(stored) : {};

        userPresets[name] = snapshot;
        localStorage.setItem(this.storageKey, JSON.stringify(userPresets));

        this.presets = this.loadPresets(); // Reload to refresh list
    }

    deletePreset(name) {
        // Cannot delete factory presets
        if (this.getFactoryPresets()[name]) return false;

        const stored = localStorage.getItem(this.storageKey);
        if (!stored) return false;

        const userPresets = JSON.parse(stored);
        delete userPresets[name];
        localStorage.setItem(this.storageKey, JSON.stringify(userPresets));

        this.presets = this.loadPresets();
        return true;
    }

    getAll() {
        return this.presets;
    }
}
