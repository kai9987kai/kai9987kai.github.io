export default class ArchiveModule {
    constructor(audioChassis) {
        this.audio = audioChassis;
        this.presets = {
            "Default": {},
            "Deep Space": {
                rain: 0, thunder: 0, traffic: 0,
                singVoid: 0.9, singShimmer: 0.6,
                grainMix: 0.8, grainDensity: 0.2,
                macroX: 0.8, radio: false
            },
            "Urban Rain": {
                rain: 0.8, drops: 0.6, traffic: 0.4,
                lofi: 0.5, hiss: 0.3,
                singVoid: 0.2, macroX: 0.3
            },
            "Ethereal Drone": {
                rain: 0, wind: 0.5,
                grainMix: 0.5, grainSize: 0.8,
                structMaterial: 0.8, structTension: 0.2,
                singVoid: 0.6, singShimmer: 0.4,
                macroX: 0.5
            },
            "Radio Static": {
                radio: true, tuning: 101.5,
                lofi: 0.8, hiss: 0.7, crackle: 0.4,
                macroVoid: false
            }
        };
    }

    loadPreset(name) {
        const preset = this.presets[name];
        if (!preset) return;
        this.audio.setState(preset);
        return preset;
    }

    oracle() {
        const randomState = {};
        const keys = [
            'rain', 'drops', 'wind', 'thunder', 'traffic',
            'grainDensity', 'grainSize', 'grainMix',
            'structMaterial', 'structTension',
            'reactorDrive', 'reactorCrush',
            'singVoid', 'singShimmer',
            'macroX', 'lofi', 'hiss'
        ];

        keys.forEach(k => {
            randomState[k] = Math.random();
        });

        // Smart overrides
        if (Math.random() > 0.5) randomState.singFreeze = true;
        else randomState.singFreeze = false;

        if (Math.random() > 0.7) randomState.radio = true;
        else randomState.radio = false;

        this.audio.setState(randomState);
        return randomState;
    }

    getPresetList() {
        return Object.keys(this.presets);
    }
}
