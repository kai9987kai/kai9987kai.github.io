import EnvModule from './modules/EnvModule.js';
import WindModule from './modules/WindModule.js';
import BinauralModule from './modules/BinauralModule.js';
import SynthModule from './modules/SynthModule.js';
import StringsModule from './modules/StringsModule.js';
import AnalyserModule from './modules/AnalyzerModule.js';
import GranularModule from './modules/GranularModule.js';
import OrbitalModule from './modules/OrbitalModule.js';
import StructureModule from './modules/StructureModule.js';
import ReactorModule from './modules/ReactorModule.js';
import SingularityModule from './modules/SingularityModule.js';
import CartographerModule from './modules/CartographerModule.js';
import PulsarModule from './modules/PulsarModule.js';
import ReverbModule from './modules/ReverbModule.js';
import ChronosModule from './modules/ChronosModule.js';
import LoFiModule from './modules/LoFiModule.js';
import AetherModule from './modules/AetherModule.js';
import RespireModule from './modules/RespireModule.js';
import CelestialModule from './modules/CelestialModule.js';
import FaunaModule from './modules/FaunaModule.js';
import HearthModule from './modules/HearthModule.js';
import TideModule from './modules/TideModule.js';
import FocusModule from './modules/FocusModule.js';
import TypewriterModule from './modules/TypewriterModule.js';
import RadioModule from './modules/RadioModule.js';
import PianoModule from './modules/PianoModule.js';
import TrafficModule from './modules/TrafficModule.js';
import ThunderModule from './modules/ThunderModule.js';
import DropsModule from './modules/DropsModule.js';
import FireModule from './modules/FireModule.js';
import TravelModule from './modules/TravelModule.js';
import MicModule from './modules/MicModule.js';
import AnalyzerModule from './modules/AnalyzerModule.js';
import SequencerModule from './modules/SequencerModule.js';
import ArchiveModule from './modules/ArchiveModule.js';
import RainModule from './modules/RainModule.js';
import VoxModule from './modules/VoxModule.js';
import WeatherModule from './modules/WeatherModule.js';
import GeologyModule from './modules/GeologyModule.js';
import BiolumeModule from './modules/BiolumeModule.js';
import VolcanoModule from './modules/VolcanoModule.js';
import SolarModule from './modules/SolarModule.js';
import AuroraModule from './modules/AuroraModule.js';
import MagneticModule from './modules/MagneticModule.js';
import TectonicModule from './modules/TectonicModule.js';
import QuantumModule from './modules/QuantumModule.js';
import FractalModule from './modules/FractalModule.js';
import PollinatorModule from './modules/PollinatorModule.js';
import BotanyModule from './modules/BotanyModule.js';
import TidalRhythmModule from './modules/TidalRhythmModule.js';
import VoidWhisperModule from './modules/VoidWhisperModule.js';
import NebulaModule from './modules/NebulaModule.js';
import ShepardModule from './modules/ShepardModule.js';
import CelestialAlignmentModule from './modules/CelestialAlignmentModule.js';
import RecorderModule from './modules/RecorderModule.js';

export default class AudioChassis {
    constructor() {
        this.context = null;
        this.masterGain = null;

        this.params = {
            rain: 0.5,
            drops: 0.4,
            wind: 0,
            thunder: 0,
            traffic: 0.2,
            time: 12,
            biome: 'forest',
            lofi: 0,
            harmony: 0,
            space: 0.5,
            chimes: 0.5,
            life: 0.5,
            binaural: 0,
            master: 0.7,
            surface: 'concrete',
            reverb: 'street',
            piano: 0,
            strings: 0,
            bpm: 120,
            pulsarRate: 1,
            pulsarDepth: 0,
            pulsarShape: 'square',
            sequencer: false,
            synthMode: 'piano',
            vox: 0,
            vowel: 'o',
            reactorDrive: 0.1,
            reactorCrush: 0,
            reactorMeltdown: 0,
            void: 0.5,
            shimmer: 0,
            respire: false,
            tuning: 88.0,
            radio: false,
            typewriter: false,
            speed: 0,
            pressure: 0.5,
            autoWeather: false,
            bees: 0.5,
            seismic: 0,
            biolumeIntensity: 0.5,
            biolumePulse: 1.0,
            volcanoIntensity: 0,
            solarIntensity: 0,
            flareFrequency: 0.1,
            aurora: false,
            auroraGlow: 0.5,
            auroraSpeed: 1.0,
            magneticFlux: 0,
            fluxToggle: false,
            tectonicStress: 0,
            tectonicGrowth: 0.1,
            entropy: 0.5,
            displacement: 0.3,
            quantumFlux: 0.1,
            recursion: 0.1,
            symmetry: 0.5,
            divergence: 0.1,
            macroX: 0.5,
            macroNature: false,
            macroSynth: false,
            macroVoid: false,
            tidal: 0,
            voidWhisper: 0,
            nebula: 0,
            nebulaDensity: 0.5,
            nebulaShimmer: 0.5,
            shepard: 0,
            shepardSpeed: 0.5,
            shepardDirection: 1,
            shepardMode: 'shepard'
        };
    }

    async init() {
        if (this.context) return;
        this.context = new (window.AudioContext || window.webkitAudioContext)();

        // Master Gain (near end of chain)
        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = this.params.master;

        // Analyser (Visuals Source)
        this.analyzer = new AnalyserModule(this.context, this.masterGain);
        this.analyser = this.analyzer; // Alias for American/British compat

        const preMaster = this.context.createGain();

        // Cartographer First (Routing)
        this.cartographer = new CartographerModule(this.context);
        const natureOut = this.cartographer.createSpatialNode('nature', preMaster);
        const windOut = this.cartographer.createSpatialNode('wind', preMaster);
        const synthOut = this.cartographer.createSpatialNode('synth', preMaster);
        const granularOut = this.cartographer.createSpatialNode('granular', preMaster);

        // Initialize Source Modules
        this.envModule = new EnvModule(this.context, natureOut);
        this.rainModule = new RainModule(this.context, natureOut);
        this.trafficModule = new TrafficModule(this.context, natureOut);
        this.thunderModule = new ThunderModule(this.context, natureOut);
        this.dropsModule = new DropsModule(this.context, natureOut);
        this.fireModule = new FireModule(this.context, natureOut);
        this.tideModule = new TideModule(this.context, natureOut);

        this.windModule = new WindModule(this.context, windOut);
        this.pianoModule = new PianoModule(this.context, synthOut);
        this.synthModule = new SynthModule(this.context, synthOut);
        this.granularModule = new GranularModule(this.context, granularOut);

        // Utilities
        this.binauralModule = new BinauralModule(this.context, preMaster);
        this.chronosModule = new ChronosModule(this.context, preMaster);
        this.aetherModule = new AetherModule(this.context, preMaster);
        this.celestialModule = new CelestialModule(this.context, preMaster);
        this.faunaModule = new FaunaModule(this.context, preMaster);
        this.voxModule = new VoxModule(this.context, synthOut);
        this.hearthModule = new HearthModule(this.context, preMaster);
        this.geologyModule = new GeologyModule(this.context, this.masterGain);
        this.biolumeModule = new BiolumeModule(this.context, natureOut);
        this.volcanoModule = new VolcanoModule(this.context, this.masterGain);
        this.solarModule = new SolarModule(this.context, this.masterGain);
        this.auroraModule = new AuroraModule(this.context, natureOut);
        this.magneticModule = new MagneticModule(this.context, this.masterGain);
        this.tectonicModule = new TectonicModule(this.context, this.masterGain);
        this.quantumModule = new QuantumModule(this.context, this.masterGain);
        this.fractalModule = new FractalModule(this.context, this.masterGain);
        this.nebulaModule = new NebulaModule(this.context, this.masterGain);
        this.shepardModule = new ShepardModule(this.context, this.masterGain);

        // Innovation: Celestial Alignments
        this.celestialAlign = new CelestialAlignmentModule(this.context, this.masterGain);

        // Recorder
        this.recorderModule = new RecorderModule(this.context, this.masterGain);
        this.loFiModule = new LoFiModule(this.context, preMaster, this.masterGain);
        this.tidalRhythmModule = new TidalRhythmModule(this.context, this.masterGain);
        this.voidWhisperModule = new VoidWhisperModule(this.context, this.masterGain);
        this.nebulaModule = new NebulaModule(this.context, this.masterGain);
        this.shepardModule = new ShepardModule(this.context, this.masterGain);

        // Entanglement & Recursion: 
        // Route Aether to Quantum, and Quantum/Synth to Fractal
        this.aetherModule.output.connect(this.quantumModule.input);
        this.quantumModule.output.connect(this.fractalModule.input);
        this.synthModule.output.connect(this.fractalModule.input);
        this.recorderDest = this.context.createMediaStreamDestination();
        this.masterGain.connect(this.recorderDest);

        this.typewriterModule = new TypewriterModule(this.context, preMaster);
        this.radioModule = new RadioModule(this.context, preMaster);
        this.structureModule = new StructureModule(this.context, preMaster);
        this.stringsModule = new StringsModule(this.context, preMaster);
        this.orbitalModule = new OrbitalModule();

        // Effects Chain Implementation
        // preMaster -> Weather -> Reactor -> Reverb -> Singularity -> masterGain

        // Weather Module (Atmospheric mood filter)
        this.weatherModule = new WeatherModule(this.context, preMaster); // Dummy output for now

        // 1. Singularity (Needs its output fixed to masterGain)
        this.singularityModule = new SingularityModule(this.context, this.masterGain);

        // 2. Reverb (Output to Singularity)
        this.reverbModule = new ReverbModule(this.context, this.context.createGain());
        this.reverbModule.output.connect(this.singularityModule.input);

        // 3. Reactor (Output to Reverb)
        this.reactorModule = new ReactorModule(this.context, this.reverbModule.input);

        // Finalize serial connection
        // Disconnect weather from preMaster and insert into chain
        preMaster.disconnect();
        preMaster.connect(this.weatherModule.input);
        this.weatherModule.output.disconnect(); // Correct previous dummy
        this.weatherModule.output.connect(this.reactorModule.input);

        this.sequencerModule = new SequencerModule(this.context, this.pianoModule, this.synthModule);
        this.travelModule = new TravelModule(this.context, preMaster);
        this.micModule = new MicModule(this.context, preMaster);
        this.botanyModule = new BotanyModule(this.context, natureOut);
        this.pollinatorModule = new PollinatorModule(this.context, natureOut);
        this.respireModule = new RespireModule(this.context, preMaster, preMaster);

        // Pulsar (Master -> Destination)
        this.pulsarModule = new PulsarModule(this.context, this.masterGain, this.context.destination);

        // Analyzer
        this.analyzer = new AnalyzerModule(this.context, this.pulsarModule.output);
        this.analyser = this.analyzer; // British spelling alias for VisualCore
        this.analyzer.connect(this.context.destination);

        this.focusModule = new FocusModule(this);
        this.archiveModule = new ArchiveModule(this);

        this.updateParams(this.params);
    }

    setParam(key, val) {
        this.params[key] = val;
        this.updateParams(this.params);
    }

    updateParams(params) {
        Object.assign(this.params, params);
        if (!this.context) return;

        if (this.masterGain) this.masterGain.gain.setTargetAtTime(this.params.master, this.context.currentTime, 0.1);

        // Core Environment
        if (this.rainModule) this.rainModule.update(this.params.rain);
        if (this.trafficModule) this.trafficModule.update(this.params.traffic);
        if (this.thunderModule) this.thunderModule.update(this.params.thunder);
        if (this.dropsModule) this.dropsModule.update(this.params.drops);
        if (this.fireModule) this.fireModule.update(this.params.fire || 0);

        // Atmosphere
        if (this.windModule) this.windModule.update(this.params.wind);
        if (this.binauralModule) this.binauralModule.update(this.params.binaural);
        if (this.auroraModule && this.params.aurora) this.auroraModule.update(this.params);

        // Utilities
        if (this.celestialAlign) this.celestialAlign.update(this.params); // Celestial AI
        if (this.recorderModule) {/* Recorder handles itself */ }

        // Conditional Updates (Optimization)
        if (this.pulsarModule && (this.params.pulsarDepth > 0 || this.params.pulsarRate > 0)) {
            this.pulsarModule.update({
                bpm: this.params.bpm,
                rate: this.params.pulsarRate,
                depth: this.params.pulsarDepth,
                shape: this.params.pulsarShape
            });
        }

        if (this.sequencerModule) {
            this.sequencerModule.setSynthMode(this.params.synthMode);
            this.sequencerModule.setTempo(this.params.bpm);
            if (this.params.sequencer) this.sequencerModule.start();
            else this.sequencerModule.stop();
        }

        if (this.reverbModule) this.reverbModule.setPreset(this.params.reverb);
        if (this.aetherModule) this.aetherModule.update(this.params);

        // Modules with expensive processing check
        if (this.faunaModule && this.params.life > 0) this.faunaModule.update(this.params);
        if (this.hearthModule) this.hearthModule.update(this.params);
        if (this.tideModule && (this.params.rain > 0 || this.params.wind > 0)) this.tideModule.update(this.params);

        // Advanced Modules
        if (this.geologyModule) this.geologyModule.update(this.params);
        if (this.tectonicModule) this.tectonicModule.update(this.params);
        if (this.volcanoModule) this.volcanoModule.update(this.params);
        if (this.biolumeModule) this.biolumeModule.update(this.params);

        // Quantum / Fractal
        if (this.quantumModule) this.quantumModule.update(this.params);
        if (this.fractalModule) this.fractalModule.update(this.params);

        // New Features (Phase 2/3)
        if (this.loFiModule) this.loFiModule.update(this.params);
        if (this.tidalRhythmModule) this.tidalRhythmModule.update(this.params);
        if (this.voidWhisperModule) this.voidWhisperModule.update(this.params);
        if (this.nebulaModule) this.nebulaModule.update(this.params);
        if (this.shepardModule) this.shepardModule.update(this.params);

        if (this.typewriterModule) this.typewriterModule.setActive(this.params.typewriter);
        if (this.radioModule) {
            this.radioModule.setActive(this.params.radio);
            this.radioModule.setTuning(this.params.tuning);
        }
        if (this.pianoModule) this.pianoModule.setGain(this.params.piano);
        if (this.stringsModule) this.stringsModule.setGain(this.params.strings);
        if (this.voxModule) {
            this.voxModule.setGain(this.params.vox);
            this.voxModule.setVowel(this.params.vowel);
        }
        if (this.travelModule) this.travelModule.setSpeed(this.params.speed);

        if (this.reactorModule) this.reactorModule.update({
            drive: this.params.reactorDrive,
            crush: this.params.reactorCrush,
            meltdown: this.params.reactorMeltdown
        });

        if (this.singularityModule) this.singularityModule.update({
            void: this.params.void,
            shimmer: this.params.shimmer
        });

        if (this.botanyModule) this.botanyModule.update(this.params);
        if (this.pollinatorModule) this.pollinatorModule.update(this.params);
        if (this.geologyModule) this.geologyModule.update(this.params);
        if (this.biolumeModule) this.biolumeModule.update(this.params);
        if (this.volcanoModule) this.volcanoModule.update(this.params);
        if (this.solarModule) this.solarModule.update(this.params);
        if (this.auroraModule) this.auroraModule.update(this.params);
        if (this.magneticModule) this.magneticModule.update(this.params);
        if (this.tectonicModule) this.tectonicModule.update(this.params);
        if (this.quantumModule) {
            this.quantumModule.update({
                entropy: this.params.entropy,
                displacement: this.params.displacement,
                flux: this.params.quantumFlux
            });
        }

        if (this.fractalModule) {
            this.fractalModule.update({
                recursion: this.params.recursion,
                symmetry: this.params.symmetry,
                divergence: this.params.divergence
            });
        }
        if (this.weatherModule) {
            this.weatherModule.update(this.params);
            const synergy = this.weatherModule.getSynergyTargets();
            if (synergy) {
                this.params.rain = synergy.rain;
                this.params.wind = synergy.wind;
            }
        }
    }

    triggerTypewriter(type) {
        if (this.typewriterModule) this.typewriterModule.trigger(type);
    }

    setSurface(type) {
        if (this.envModule) this.envModule.setSurface(type);
        if (this.rainModule) this.rainModule.setSurface(type);
        if (this.dropsModule) this.dropsModule.setSurface(type);
    }

    setBinauralMode(mode) {
        this.params.binauralMode = mode;
        if (this.binauralModule) this.binauralModule.setMode(mode);
    }

    setReverb(preset) {
        this.params.reverb = preset;
        if (this.reverbModule) this.reverbModule.setPreset(preset);
    }

    toggleRecording(onStop) {
        if (this.recorder && this.recorder.state === 'recording') {
            this.recorder.stop();
            return false;
        }

        const chunks = [];
        this.recorder = new MediaRecorder(this.recorderDest.stream);
        this.recorder.ondataavailable = e => chunks.push(e.data);
        this.recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `petrichor_${Date.now()}.ogg`;
            a.click();
            if (onStop) onStop();
        };

        this.recorder.start();
        return true;
    }

    async toggle() {
        if (this.context.state === 'running') await this.context.suspend();
        else await this.context.resume();
    }

    transmuteGranular() {
        if (this.granularModule) this.granularModule.transmute();
    }

    strikeStructure() {
        if (this.structureModule) this.structureModule.strike();
    }

    setState(state) {
        Object.assign(this.params, state);
        if (this.context) this.updateParams(this.params);
    }

    getState() {
        return JSON.parse(JSON.stringify(this.params));
    }
}
