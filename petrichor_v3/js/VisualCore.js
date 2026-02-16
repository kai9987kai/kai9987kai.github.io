import RainViz from './viz/RainViz.js';
import SpectrumViz from './viz/SpectrumViz.js';
import GeosminViz from './viz/GeosminViz.js';
import NatureViz from './viz/NatureViz.js';
import BreathViz from './viz/BreathViz.js';
import FireflyViz from './viz/FireflyViz.js';
import SkyViz from './viz/SkyViz.js';
import GroundViz from './viz/GroundViz.js';
import HearthViz from './viz/HearthViz.js';
import OceanViz from './viz/OceanViz.js';
import CityViz from './viz/CityViz.js';
import LensFX from './viz/LensFX.js';
import MonitorViz from './viz/MonitorViz.js';
import KaleidoscopeViz from './viz/KaleidoscopeViz.js';
import FaunaViz from './viz/FaunaViz.js';
import ZenithViz from './viz/ZenithViz.js';
import SporeViz from './viz/SporeViz.js';
import PollinatorViz from './viz/PollinatorViz.js';
import CloudViz from './viz/CloudViz.js';
import GeologyViz from './viz/GeologyViz.js';
import ReefViz from './viz/ReefViz.js';
import VolcanoViz from './viz/VolcanoViz.js';
import SolarViz from './viz/SolarViz.js';
import AuroraViz from './viz/AuroraViz.js';
import MagneticViz from './viz/MagneticViz.js';
import TectonicViz from './viz/TectonicViz.js';
import MirageViz from './viz/MirageViz.js';
import FractalViz from './viz/FractalViz.js';

/**
 * VisualCore.js
 * Manages the HTML5 Canvas animations.
 */
export default class VisualCore {
    constructor(audioEngine) {
        this.audio = audioEngine;
        this.canvas = document.getElementById('main-canvas');

        // Container Setup
        const container = this.canvas.parentElement;
        container.style.position = 'relative';
        // container.classList.remove('glass-panel'); // RESTORED
        // container.style.background = '#222';

        // Layers Setup
        this.skyCanvas = this.createLayer(0); // Background
        this.cloudCanvas = this.createLayer(1); // Clouds
        this.hearthCanvas = this.createLayer(0); // Hearth Glow 
        this.hearthCanvas.style.zIndex = '0';

        // Midground Layers (Mutually Exclusive usually)
        this.natureCanvas = this.createLayer(1);
        this.oceanCanvas = this.createLayer(1);
        this.cityCanvas = this.createLayer(1);

        this.groundCanvas = this.createLayer(2); // Puddles

        // Main Canvas (Rain) -> Index 3
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.zIndex = '50';
        this.canvas.style.pointerEvents = 'auto';

        this.fireflyCanvas = this.createLayer(4); // Fireflies
        this.sporeCanvas = this.createLayer(4); // Spores
        this.pollinatorCanvas = this.createLayer(6); // Bees (Above plants)
        this.faunaCanvas = this.createLayer(5); // Boids (Swarm)
        this.kaleidoscopeCanvas = this.createLayer(6); // Kaleidoscope (Top of visuals, below HUD)
        this.zenithCanvas = this.createLayer(500); // Zenith Overlay (High Z-index)

        this.geologyCanvas = this.createLayer(2); // Fissures (On ground)
        this.reefCanvas = this.createLayer(3); // Underwater Reef
        this.volcanoCanvas = this.createLayer(4); // Ash/Steam (In air)
        this.solarCanvas = this.createLayer(10); // Solar effects (Top)
        this.auroraCanvas = this.createLayer(8); // Aurora (High altitude)
        this.tectonicCanvas = this.createLayer(1); // Crystals (Ground layer)
        this.magneticCanvas = this.createLayer(100); // HUD Compass
        this.hudCanvas = this.createLayer(501); // UI/HUD

        this.ctx = this.canvas.getContext('2d');

        // Modules
        this.skyViz = new SkyViz(this.skyCanvas);
        this.hearthViz = new HearthViz(this.hearthCanvas);
        this.natureViz = new NatureViz(this.natureCanvas);
        this.oceanViz = new OceanViz(this.oceanCanvas);
        this.cityViz = new CityViz(this.cityCanvas);

        this.groundViz = new GroundViz(this.groundCanvas);
        this.rainViz = new RainViz(this.ctx, this.canvas.width, this.canvas.height);
        this.fireflyViz = new FireflyViz(this.fireflyCanvas);
        this.faunaViz = new FaunaViz(this.faunaCanvas);
        this.kaleidoscopeViz = new KaleidoscopeViz(this.kaleidoscopeCanvas, null);
        this.zenithViz = new ZenithViz(this.zenithCanvas, null);
        this.breathViz = new BreathViz(this.hudCanvas);
        this.sporeViz = new SporeViz(this.sporeCanvas);
        this.pollinatorViz = new PollinatorViz(this.pollinatorCanvas);
        this.cloudViz = new CloudViz(this.cloudCanvas);
        this.geologyViz = new GeologyViz(this.geologyCanvas);
        this.reefViz = new ReefViz(this.reefCanvas);
        this.volcanoViz = new VolcanoViz(this.volcanoCanvas);
        this.solarViz = new SolarViz(this.solarCanvas);
        this.auroraViz = new AuroraViz(this.auroraCanvas);
        this.tectonicViz = new TectonicViz(this.tectonicCanvas);
        this.magneticViz = new MagneticViz(this.magneticCanvas);

        this.botanyModule = null;
        this.pollinatorModule = null;

        this.spectrumViz = null;
        this.geosminViz = null;

        this.initSecondaryViz();

        this.isRunning = false;

        this.rainIntensity = 0.5;
        this.windSpeed = 0;
        this.thunderIntensity = 0;
        this.timeOfDay = 12;
        this.season = 'summer';
        this.biome = 'forest';

        this.resize();
        window.addEventListener('resize', () => {
            clearTimeout(this.resizeTimer);
            this.resizeTimer = setTimeout(() => this.resize(), 100);
        });

        this.setupInteractions();
        this.setBiome('forest'); // Init state
    }

    createLayer(zIndex) {
        const cnv = document.createElement('canvas');
        cnv.style.position = 'absolute';
        cnv.style.position = 'absolute'; // CRITICAL FIX
        cnv.style.top = '0';
        cnv.style.left = '0';
        cnv.style.width = '100%';
        cnv.style.height = '100%';
        cnv.style.pointerEvents = 'none';
        cnv.style.zIndex = zIndex;

        const container = document.getElementById('main-canvas').parentElement;
        container.appendChild(cnv);

        return cnv;
    }

    setBiome(b) {
        this.biome = b;

        // Toggle Canvas Visibility
        this.natureCanvas.style.display = b === 'forest' ? 'block' : 'none';
        this.oceanCanvas.style.display = b === 'ocean' ? 'block' : 'none';
        this.cityCanvas.style.display = b === 'city' ? 'block' : 'none';

        // Toggle Module Active State
        if (this.oceanViz) this.oceanViz.setActive(b === 'ocean');
        if (this.cityViz) this.cityViz.setActive(b === 'city');
        // NatureViz update logic is handled in draw loop by just checking biome?
        // Or just relying on canvas hidden?
        // Canvas hidden saves render time if we skip draw.

        this.updateVizParams();
    }

    setSeason(s) {
        this.season = s;
        this.updateVizParams();
    }

    initSecondaryViz() {
        // Wire up audio-dependent refs now that AudioChassis is initialized
        this.botanyModule = this.audio.botanyModule || null;
        this.pollinatorModule = this.audio.pollinatorModule || null;

        // Update kaleidoscope/zenith with native analyser node
        const nativeAnalyser = this.audio.analyser ? this.audio.analyser.node : null;
        if (nativeAnalyser) {
            if (this.kaleidoscopeViz) this.kaleidoscopeViz.analyser = nativeAnalyser;
            if (this.zenithViz) this.zenithViz.analyser = nativeAnalyser;
        }

        const specCanvas = document.getElementById('spectrum-canvas');
        const geoCanvas = document.getElementById('geo-canvas');

        if (specCanvas && nativeAnalyser) {
            this.spectrumViz = new SpectrumViz(specCanvas, nativeAnalyser);
        }

        if (geoCanvas) {
            this.geosminViz = new GeosminViz(geoCanvas);
        }

        this.mirageViz = new MirageViz(this.canvas, this.audio);
        this.fractalViz = new FractalViz(this.canvas, this.audio);
    }

    setupInteractions() {
        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Plant on ground (Horizon approx height/2 + 50 padding)
            if (this.botanyModule && y > this.canvas.height / 2 + 50) {
                this.botanyModule.addPlant(x, y);
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Sonic Interaction
            if (this.botanyModule) {
                this.botanyModule.plants.forEach(p => {
                    // Hitbox rough approximation
                    if (Math.abs(x - p.x) < 20 && y < p.y && y > p.y - p.height) {
                        this.botanyModule.playNote(p);
                    }
                });
            }
        });
    }

    resize() {
        if (!this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();

        // Resize all layers
        [this.canvas, this.skyCanvas, this.hearthCanvas, this.natureCanvas, this.oceanCanvas, this.cityCanvas, this.groundCanvas, this.fireflyCanvas, this.hudCanvas, this.zenithCanvas, this.sporeCanvas, this.pollinatorCanvas, this.faunaCanvas, this.cloudCanvas, this.geologyCanvas, this.reefCanvas, this.volcanoCanvas, this.solarCanvas, this.auroraCanvas, this.tectonicCanvas, this.magneticCanvas, this.kaleidoscopeCanvas].forEach(c => {
            if (c) {
                c.width = rect.width;
                c.height = rect.height;
            }
        });

        console.log(`[VisualCore] Resized to ${rect.width}x${rect.height}`);

        if (this.skyViz) this.skyViz.resize();
        if (this.hearthViz) this.hearthViz.resize();
        if (this.natureViz) this.natureViz.resize();
        if (this.oceanViz) this.oceanViz.resize();
        if (this.cityViz) this.cityViz.resize();
        if (this.groundViz) this.groundViz.resize();
        if (this.rainViz) this.rainViz.setSize(rect.width, rect.height);
        if (this.fireflyViz) this.fireflyViz.resize();
        if (this.faunaViz) this.faunaViz.resize();
        if (this.kaleidoscopeViz) this.kaleidoscopeViz.resize();
        if (this.zenithViz) this.zenithViz.resize();
        if (this.breathViz) this.breathViz.resize();
        if (this.sporeViz && this.sporeViz.resize) this.sporeViz.resize();
        if (this.pollinatorViz && this.pollinatorViz.resize) this.pollinatorViz.resize();
        if (this.cloudViz && this.cloudViz.resize) this.cloudViz.resize();
        if (this.geologyViz && this.geologyViz.resize) this.geologyViz.resize();
        if (this.reefViz && this.reefViz.resize) this.reefViz.resize();
        if (this.volcanoViz && this.volcanoViz.resize) this.volcanoViz.resize();
        if (this.solarViz && this.solarViz.resize) this.solarViz.resize();
        if (this.auroraViz && this.auroraViz.resize) this.auroraViz.resize();
        if (this.tectonicViz && this.tectonicViz.resize) this.tectonicViz.resize();
        if (this.magneticViz && this.magneticViz.resize) this.magneticViz.resize();
        if (this.mirageViz && this.mirageViz.resize) this.mirageViz.resize();
        if (this.fractalViz && this.fractalViz.resize) this.fractalViz.resize();

        if (this.spectrumViz) this.spectrumViz.resize();
        if (this.geosminViz) this.geosminViz.resize();
    }

    start() {
        if (!this.spectrumViz && this.audio.analyser) {
            this.initSecondaryViz();
        }

        // Fresh module references from AudioChassis
        this.botanyModule = this.audio.botanyModule;
        this.pollinatorModule = this.audio.pollinatorModule;
        this.quantumModule = this.audio.quantumModule;

        if (this.audio.analyser) {
            const nativeAnalyser = this.audio.analyser.node;
            if (this.kaleidoscopeViz) this.kaleidoscopeViz.analyser = nativeAnalyser;
            if (this.zenithViz) this.zenithViz.analyser = nativeAnalyser;
        }

        this.isRunning = true;
        this.animate();
    }

    stop() {
        this.isRunning = false;
    }

    setRainIntensity(val) {
        this.rainIntensity = val;
        this.updateVizParams();
    }

    setWindSpeed(val) {
        this.windSpeed = val;
        this.updateVizParams();
    }

    setBreathActive(isActive) {
        if (this.breathViz) this.breathViz.setActive(isActive);
    }

    setZenithActive(isActive) {
        if (this.zenithViz) this.zenithViz.setActive(isActive);
    }

    setTimeOfDay(val) {
        this.timeOfDay = val;
        // val is 0-24
        // Map to gradients
        // Night: 0-5, 20-24 (Dark Blue/Black)
        // Dawn: 5-8 (Purple/Orange)
        // Day: 8-17 (Blue/Cyan)
        // Dusk: 17-20 (Orange/Pink)

        const body = document.body;

        let colors = {
            bg: '#05070a',
            grad1: 'rgba(20, 50, 60, 0.4)',
            grad2: 'rgba(30, 40, 60, 0.3)'
        };

        if (val >= 5 && val < 8) { // Dawn
            colors.bg = '#1a1025';
            colors.grad1 = 'rgba(100, 60, 80, 0.4)';
            colors.grad2 = 'rgba(60, 40, 80, 0.3)';
        } else if (val >= 8 && val < 17) { // Day
            colors.bg = '#1a252a';
            colors.grad1 = 'rgba(60, 100, 110, 0.4)';
            colors.grad2 = 'rgba(50, 80, 100, 0.3)';
        } else if (val >= 17 && val < 20) { // Dusk
            colors.bg = '#2a1510';
            colors.grad1 = 'rgba(120, 60, 40, 0.4)';
            colors.grad2 = 'rgba(80, 40, 60, 0.3)';
        }

        body.style.backgroundColor = colors.bg;
        body.style.backgroundImage = `
            radial-gradient(circle at 10% 20%, ${colors.grad1} 0%, transparent 40%),
            radial-gradient(circle at 90% 80%, ${colors.grad2} 0%, transparent 40%)
        `;

        this.updateVizParams();
    }

    updateVizParams() {
        const p = this.audio.params;
        const commonParams = {
            rain: this.rainIntensity,
            wind: p.wind,
            thunder: p.thunder,
            time: this.timeOfDay,
            season: p.season,
            hearth: p.hearth,
            biome: p.biome,
            aurora: p.aurora,
            vhs: p.vhs,
            cinema: p.cinema,
            dream: p.dream,
            kaleidoscope: p.kaleidoscope,
            symmetry: p.symmetry,
            life: p.life,
            pressure: p.pressure,
            seismic: p.seismic,
            biolumeIntensity: p.biolumeIntensity,
            biolumePulse: p.biolumePulse,
            volcanoIntensity: p.volcanoIntensity,
            solarIntensity: p.solarIntensity,
            flareFrequency: p.flareFrequency,
            aurora: p.aurora,
            auroraGlow: p.auroraGlow,
            auroraSpeed: p.auroraSpeed,
            magneticFlux: p.magneticFlux,
            fluxToggle: p.fluxToggle,
            tectonicStress: p.tectonicStress,
            tectonicGrowth: p.tectonicGrowth
        };

        if (this.skyViz) this.skyViz.update(commonParams);
        if (this.hearthViz) this.hearthViz.setActive(commonParams.hearth);
        if (this.rainViz) this.rainViz.updateParams(commonParams);
        if (this.groundViz) this.groundViz.update(commonParams);
        if (this.cityViz && this.biome === 'city') this.cityViz.update(commonParams);
        if (this.faunaViz) this.faunaViz.update(commonParams);
        if (this.kaleidoscopeViz) this.kaleidoscopeViz.update(commonParams);

        if (this.lensFX) this.lensFX.update(commonParams);

        if (this.geosminViz) {
            // Geosmin intensity correlates with rain
            this.geosminViz.update(this.rainIntensity);
        }

        if (this.oceanViz) {
            this.oceanViz.setActive(this.biome === 'ocean');
            this.oceanViz.update(commonParams);
        }

        if (this.geologyViz) {
            this.geologyViz.update(commonParams);
            // Apply screen shake to the world
            this.canvas.parentElement.style.transform = this.geologyViz.getShakeTransform();
        }

        if (this.reefViz) {
            this.reefViz.setActive(this.biome === 'ocean');
            this.reefViz.update(commonParams);
        }

        if (this.volcanoViz) {
            this.volcanoViz.update(commonParams);
        }

        if (this.solarViz) {
            this.solarViz.update(commonParams);
            const shift = this.solarViz.getChromaticShift();
            const shake = this.geologyViz ? this.geologyViz.getShakeTransform() : 'none';

            // Combine shake and chromatic aberration (using drop-shadow to simulate shift)
            if (shift > 0.5) {
                this.canvas.parentElement.style.filter = `drop-shadow(${shift}px 0px 0px rgba(255,0,0,0.5)) drop-shadow(-${shift}px 0px 0px rgba(0,255,255,0.5))`;
            } else {
                this.canvas.parentElement.style.filter = 'none';
            }
            this.canvas.parentElement.style.transform = shake;
        }

        if (this.auroraViz) {
            this.auroraViz.update(commonParams);
        }

        if (this.magneticViz) {
            this.magneticViz.update(commonParams);
        }

        if (this.tectonicViz) {
            this.tectonicViz.update(commonParams);
        }
    }

    triggerMeteor() {
        if (this.skyViz) this.skyViz.triggerMeteor();
    }

    animate() {
        if (!this.isRunning) return;
        if (window.perfMonitor) window.perfMonitor.update();
        requestAnimationFrame(() => {
            try {
                this.animate();
            } catch (e) {
                console.error("VisualCore Animation Error:", e);
                this.stop();
            }
        });

        const w = this.canvas.width;
        const h = this.canvas.height;

        // Clear Main Canvas
        // this.ctx.fillStyle = 'rgba(5, 7, 10, 0.3)'; // Trail effect
        // this.ctx.fillRect(0, 0, w, h);
        this.ctx.clearRect(0, 0, w, h);


        // DEBUG: Log once per 100 frames
        // if (Math.random() < 0.01) {
        //     const canvases = document.querySelectorAll('.viz-container canvas');
        //     console.log(`[VisualCore] Canvases: ${canvases.length}, MainZ: ${this.canvas.style.zIndex}, W: ${w}, H: ${h}`);
        // }

        // Draw Layers
        if (this.skyViz) this.skyViz.draw();

        if (this.cloudViz) {
            this.cloudViz.update({
                pressure: this.audio.params.pressure,
                wind: this.windSpeed,
                time: this.timeOfDay
            });
            this.cloudViz.draw();
        }

        if (this.oceanViz && this.biome === 'ocean') {
            this.oceanViz.draw();
        }

        if (this.geologyViz) {
            this.geologyViz.draw();
        }

        if (this.reefViz && this.biome === 'ocean') {
            this.reefViz.draw();
        }

        if (this.volcanoViz) {
            this.volcanoViz.draw();
        }

        if (this.solarViz) {
            this.solarViz.draw();
        }

        if (this.auroraViz) {
            this.auroraViz.draw();
        }

        if (this.magneticViz) {
            this.magneticViz.draw();
        }

        if (this.tectonicViz) {
            this.tectonicViz.draw();
        }

        if (this.hearthViz) {
            this.hearthViz.update();
            this.hearthViz.draw();
        }

        if (this.natureViz) {
            if (this.botanyModule) {
                this.botanyModule.update({
                    time: this.timeOfDay,
                    rain: this.rainIntensity,
                    growth: this.audio.params.growth,
                    bees: this.pollinatorViz ? this.pollinatorViz.bees : []
                });
            }
            this.natureViz.update(this.rainIntensity);
            this.natureViz.draw(this.botanyModule);
        }

        if (this.groundViz) {
            this.groundViz.update({ rain: this.rainIntensity, season: this.season }); // Continuous update for logic
            this.groundViz.draw();
        }

        if (this.rainViz) this.rainViz.draw(); // On Main

        if (this.auroraViz && (this.audio && this.audio.params.aurora > 0.01)) {
            this.auroraViz.update(this.timeOfDay);
            this.auroraViz.draw();
        }

        if (this.fireflyViz) {
            this.fireflyViz.update(this.timeOfDay);
            this.fireflyViz.draw();
        }

        if (this.sporeViz) {
            this.sporeViz.update(this.windSpeed, this.rainIntensity, this.botanyModule);
            this.sporeViz.draw();
        }

        if (this.pollinatorViz) {
            this.pollinatorViz.density = this.audio.params.bees || 0.5;
            this.pollinatorViz.update(this.botanyModule);
            this.pollinatorViz.draw();
            if (this.pollinatorModule) {
                this.pollinatorModule.syncWithViz(this.pollinatorViz.bees);
            }
        }

        if (this.faunaViz) this.faunaViz.draw();

        if (this.kaleidoscopeViz) this.kaleidoscopeViz.draw();

        if (this.zenithViz) {
            this.zenithViz.update();
            this.zenithViz.draw();
        }

        if (this.breathViz) {
            this.hudCanvas.getContext('2d').clearRect(0, 0, w, h);
            this.breathViz.draw();
        }

        if (this.spectrumViz) this.spectrumViz.draw();
        if (this.geosminViz) this.geosminViz.draw();

        if (this.auroraViz && (this.audio && this.audio.params.aurora > 0.01)) {
            this.auroraViz.update(this.timeOfDay);
            this.auroraViz.draw();
        }

        // Quantum Mirage Overlay (Post-processing)
        if (this.mirageViz && (this.audio && (this.audio.params.entropy > 0.01 || this.audio.params.quantumFlux > 0.01))) {
            this.mirageViz.update({
                entropy: this.audio ? this.audio.params.entropy : 0.5,
                flux: this.audio ? this.audio.params.quantumFlux : 0.1
            });
            this.mirageViz.draw(this.ctx);
        }

        // Fractal Echo (Geometric Recursion)
        if (this.fractalViz && (this.audio && this.audio.params.recursion > 0.01)) {
            this.fractalViz.update({
                recursion: this.audio ? this.audio.params.recursion : 0.1,
                symmetry: this.audio ? this.audio.params.symmetry : 0.5,
                divergence: this.audio ? this.audio.params.quantumFlux : 0.1
            });
            this.fractalViz.draw(this.ctx);
        }

        if (this.audio && this.audio.celestialAlign) {
            const celestial = this.audio.celestialAlign.getVisualParams();
            if (celestial && celestial.intensity > 0) {
                this.ctx.save();
                this.ctx.globalCompositeOperation = 'screen';
                const i = celestial.intensity;

                if (celestial.type === 'SOLAR_FLARE') {
                    this.ctx.fillStyle = `rgba(255, 200, 100, ${i * 0.3})`;
                    this.ctx.fillRect(0, 0, w, h);
                } else if (celestial.type === 'LUNAR_ECLIPSE') {
                    this.ctx.globalCompositeOperation = 'multiply';
                    this.ctx.fillStyle = `rgba(0, 0, 0, ${i * 0.6})`;
                    this.ctx.fillRect(0, 0, w, h);
                } else if (celestial.type === 'MAGNETIC_STORM') {
                    this.ctx.globalCompositeOperation = 'difference';
                    this.ctx.fillStyle = `rgba(100, 255, 218, ${i * 0.1})`;
                    if (Math.random() > 0.8) this.ctx.fillRect(0, 0, w, h);
                }
                this.ctx.restore();
            }
        }
    }
}
