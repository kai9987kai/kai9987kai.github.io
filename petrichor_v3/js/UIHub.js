import AudioChassis from './AudioChassis.js';
import VisualCore from './VisualCore.js';
import FocusModule from './modules/FocusModule.js';
import PresetManager from './modules/PresetManager.js';
// import PresetManager from './modules/PresetManager.js'; // This import is likely a duplicate and should be removed if the other PresetManager is used. Assuming the top-level one is the correct one.

/**
 * UIHub.js
 * Handles all DOM interactions, event listeners, and updates visual state.
 */
export default class UIHub {
    constructor(audioChassis, visualCore) {
        this.audio = audioChassis;
        this.visual = visualCore;
        // this.presets = new PresetManager(this.audio); // Removed duplicate
        this.focus = new FocusModule(this.audio);
        this.presetManager = new PresetManager(); // Kept this one
        this.initialized = false;

        this.elements = {
            powerBtn: document.getElementById('btn-power'),
            statusText: document.querySelector('.status-text'),
            statusDot: document.querySelector('.status-dot'),

            // Focus
            focusDisplay: document.getElementById('focus-display'),
            focusStatus: document.getElementById('focus-status'),
            btnFocusStart: document.getElementById('btn-focus-start'),
            btnFocusStop: document.getElementById('btn-focus-stop'),

            // Sliders
            rain: document.getElementById('param-rain'),
            drops: document.getElementById('param-drops'),
            wind: document.getElementById('param-wind'),
            thunder: document.getElementById('param-thunder'),
            traffic: document.getElementById('param-traffic'),
            time: document.getElementById('param-time'),
            biome: document.getElementById('param-biome'),
            lofi: document.getElementById('param-lofi'),
            harmony: document.getElementById('param-harmony'),
            space: document.getElementById('param-space'),
            chimes: document.getElementById('param-chimes'),
            life: document.getElementById('param-life'),
            binaural: document.getElementById('param-binaural'),
            master: document.getElementById('param-master'),
            micReverb: document.getElementById('param-micReverb'), // Added micReverb slider
            micDelay: document.getElementById('param-micDelay'),   // Added micDelay slider
            bpm: document.getElementById('param-bpm'), // Added BPM slider

            // Selects
            surface: document.getElementById('param-surface'),
            reverb: document.getElementById('param-reverb'),
            vowel: document.getElementById('param-vowel'), // Added vowel select

            // Toggles
            waves: document.querySelectorAll('.toggle-btn'),
            respireBtn: document.getElementById('btn-respire'),
            btnSummer: document.getElementById('btn-summer'),
            btnWinter: document.getElementById('btn-winter'),
            btnHearth: document.getElementById('btn-hearth'),
            btnMic: document.getElementById('btn-mic'), // Added mic button
            btnSequencer: document.getElementById('btn-sequencer'), // Added sequencer button
            vox: document.getElementById('param-vox'), // Added vox slider

            // Readouts
            valRain: document.getElementById('val-rain'),
            valDrops: document.getElementById('val-drops'),
            valWind: document.getElementById('val-wind'),
            valThunder: document.getElementById('val-thunder'),
            valTraffic: document.getElementById('val-traffic'),
            valTime: document.getElementById('val-time'),
            valBiome: document.getElementById('val-biome'),
            valLoFi: document.getElementById('val-lofi'),
            valHarmony: document.getElementById('val-harmony'),
            valSpace: document.getElementById('val-space'),
            valChimes: document.getElementById('val-chimes'),
            valLife: document.getElementById('val-life'),
            valBinaural: document.getElementById('val-binaural'),
            valMaster: document.getElementById('val-master'),
            valVox: document.getElementById('val-vox'), // Added vox readout

            // Zenith
            btnZenith: document.getElementById('btn-zenith'),
            btnExitZenith: document.getElementById('btn-exit-zenith'),
        };

        this.attachListeners();
        this.attachGlobalControls();

        // Status Polling
        setInterval(() => this.updateStatus(), 1000);
    }

    updateStatus() {
        const el = document.getElementById('celestial-status');
        if (!el || !this.audio || !this.audio.celestialAlign) return;

        const event = this.audio.celestialAlign.currentEvent;
        if (event) {
            el.textContent = `⚠ ${event.type.replace('_', ' ')} ACTIVE ⚠`;
            el.style.opacity = '1';
        } else {
            // Show next event ETA? Or just clear.
            const next = Math.ceil(this.audio.celestialModule.nextEventTime - this.audio.context.currentTime);
            if (next < 10) el.textContent = `ALIGNMENT IMMINENT: ${next}s`;
            else el.textContent = '';
        }
    }

    attachListeners() {
        // Power
        this.elements.powerBtn.addEventListener('click', async () => {
            if (!this.initialized) {
                await this.audio.init();
                if (this.audio.context.state === 'suspended') {
                    await this.audio.context.resume();
                }
                this.visual.start();
                this.initialized = true;
                this.setPowerState(true);
            } else {
                await this.audio.toggle(); // Make toggle async and await it
                const isRunning = this.audio.context.state === 'running';
                this.setPowerState(isRunning);
                if (!isRunning) this.visual.stop();
                else this.visual.start();
            }
        });

        // Respire Toggle
        if (this.elements.respireBtn) {
            this.elements.respireBtn.addEventListener('click', () => {
                const isActive = this.elements.respireBtn.classList.toggle('active');
                this.audio.setParam('respire', isActive);
                this.elements.respireBtn.textContent = isActive ? 'ON' : 'OFF';
                this.visual.setBreathActive(isActive);
            });
        }

        // Season Toggles
        if (this.elements.btnSummer && this.elements.btnWinter) {
            const updateSeason = (season) => {
                this.audio.setParam('season', season);
                this.elements.btnSummer.classList.toggle('active', season === 'summer');
                this.elements.btnWinter.classList.toggle('active', season === 'winter');
                this.visual.setSeason(season);
            };

            this.elements.btnSummer.addEventListener('click', () => updateSeason('summer'));
            this.elements.btnWinter.addEventListener('click', () => updateSeason('winter'));
        }

        // Biome Toggles
        const btns = {
            forest: document.getElementById('btn-forest'),
            ocean: document.getElementById('btn-ocean'),
            city: document.getElementById('btn-city')
        };

        if (btns.forest && btns.ocean && btns.city) {
            const updateBiome = (biome) => {
                this.audio.setParam('biome', biome);
                Object.keys(btns).forEach(k => {
                    btns[k].classList.toggle('active', k === biome);
                });
                this.visual.setBiome(biome);

                // Show/hide sub-modules
                const modBiolume = document.getElementById('mod-biolume');
                if (modBiolume) modBiolume.style.display = biome === 'ocean' ? 'block' : 'none';
            };

            btns.forest.addEventListener('click', () => updateBiome('forest'));
            btns.ocean.addEventListener('click', () => updateBiome('ocean'));
            btns.city.addEventListener('click', () => updateBiome('city'));
        }

        // Aurora toggle is handled in Cosmos Controls below (line ~255)

        // Hearth Toggle
        if (this.elements.btnHearth) {
            this.elements.btnHearth.addEventListener('click', () => {
                const isActive = this.elements.btnHearth.classList.toggle('active');
                this.audio.setParam('hearth', isActive);
                this.elements.btnHearth.textContent = isActive ? 'ON' : 'OFF';
                this.visual.updateVizParams();
            });
        }

        // Writer Mode
        const btnWriter = document.getElementById('btn-writer');
        if (btnWriter) {
            const overlay = document.getElementById('writer-overlay');
            const input = document.getElementById('writer-input');
            const exit = document.getElementById('btn-writer-exit');

            const toggleWriter = (active) => {
                overlay.classList.toggle('active', active);
                this.audio.setParam('typewriter', active);
                if (active) input.focus();
            };

            btnWriter.addEventListener('click', () => toggleWriter(true));
            exit.addEventListener('click', () => toggleWriter(false));

            input.addEventListener('keydown', (e) => {
                let type = 'key';
                if (e.key === 'Enter') type = 'return';
                if (e.key === ' ') type = 'space';

                // Debounce or logic? Audio engine handles overlapping sounds well enough.
                this.audio.triggerTypewriter(type);
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') toggleWriter(false);
            });
        }

        // Zenith Toggle
        if (this.elements.btnZenith) {
            this.elements.btnZenith.addEventListener('click', () => this.toggleZenith(true));
        }
        if (this.elements.btnExitZenith) {
            this.elements.btnExitZenith.addEventListener('click', () => this.toggleZenith(false));
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.body.classList.contains('zenith-mode')) {
                this.toggleZenith(false);
            }
        });

        // Radio Controls
        const btnRadio = document.getElementById('btn-radio');
        const rangeRadio = document.getElementById('radio-tuner');
        const dispRadio = document.getElementById('radio-freq');

        if (btnRadio && rangeRadio) {
            btnRadio.addEventListener('click', () => {
                const on = btnRadio.classList.toggle('active');
                this.audio.setParam('radio', on);
            });

            rangeRadio.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.audio.setParam('tuning', val);
                if (dispRadio) dispRadio.textContent = val.toFixed(1);
            });
        }

        // Music Sliders
        this.bindSlider(document.getElementById('vol-piano'), 'piano', null, null);
        this.bindSlider(document.getElementById('vol-strings'), 'strings', null, null);
        this.bindSlider(document.getElementById('param-speed'), 'speed', document.getElementById('val-speed'));

        // Lens Buttons
        ['vhs', 'cinema', 'dream'].forEach(id => {
            const btn = document.getElementById(`btn-${id}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    const on = btn.classList.toggle('active');
                    this.audio.setParam(id, on);
                    this.visual.updateVizParams();
                });
            }
        });

        // Cosmos Controls
        const btnAurora = document.getElementById('btn-aurora');
        const btnMeteor = document.getElementById('btn-meteor');
        if (btnAurora) {
            btnAurora.addEventListener('click', () => {
                const on = btnAurora.classList.toggle('active');
                this.audio.setParam('aurora', on);
                this.visual.updateVizParams();
            });
        }
        if (btnMeteor) {
            btnMeteor.addEventListener('click', () => {
                this.visual.triggerMeteor();
            });
        }

        // Garden Controls
        const seeds = ['fern', 'flower', 'reed', 'luminescent', 'shadow', 'fungi', 'mycelium', 'tree'];
        seeds.forEach(seed => {
            const btn = document.getElementById(`btn-seed-${seed}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    seeds.forEach(s => {
                        const b = document.getElementById(`btn-seed-${s}`);
                        if (b) b.classList.remove('active');
                    });
                    btn.classList.add('active');

                    if (this.visual.botanyModule) {
                        this.visual.botanyModule.setSelectedSeed(seed);
                    }
                });
            }
        });

        this.bindSlider(document.getElementById('param-growth'), 'growth', document.getElementById('val-growth'), v => v.toFixed(1) + 'x');
        this.bindSlider(document.getElementById('param-bees'), 'bees', document.getElementById('val-bees'), v => v.toFixed(1) + 'x');

        // Atmosphere Controls
        this.bindSlider(document.getElementById('param-pressure'), 'pressure', document.getElementById('val-pressure'), v => v.toFixed(2));
        this.bindToggle(document.getElementById('btn-auto-weather'), 'autoWeather');
        this.bindSlider(document.getElementById('param-seismic'), 'seismic', document.getElementById('val-seismic'), v => v.toFixed(2));
        this.bindSlider(document.getElementById('param-biolumeIntensity'), 'biolumeIntensity', document.getElementById('val-biolumeIntensity'), v => v.toFixed(2));
        this.bindSlider(document.getElementById('param-biolumePulse'), 'biolumePulse', document.getElementById('val-biolumePulse'), v => v.toFixed(2));
        this.bindSlider(document.getElementById('param-volcano'), 'volcanoIntensity', document.getElementById('val-volcano'), v => v.toFixed(2));
        this.bindSlider(document.getElementById('param-solar'), 'solarIntensity', document.getElementById('val-solar'), v => v.toFixed(2));
        this.bindSlider(document.getElementById('param-flare'), 'flareFrequency', document.getElementById('val-flare'), v => v.toFixed(2));
        this.bindSlider(document.getElementById('param-flux'), 'magneticFlux', document.getElementById('val-flux'), v => v.toFixed(2));
        this.bindToggle(document.getElementById('btn-flux-toggle'), 'fluxToggle');
        this.bindSlider(document.getElementById('param-tectonicStress'), 'tectonicStress', document.getElementById('val-tectonicStress'), v => v.toFixed(2));
        this.bindSlider(document.getElementById('param-tectonicGrowth'), 'tectonicGrowth', document.getElementById('val-tectonicGrowth'), v => v.toFixed(2));

        // Aurora
        this.bindSlider(document.getElementById('param-auroraGlow'), 'auroraGlow', document.getElementById('val-auroraGlow'), v => v.toFixed(2));
        this.bindSlider(document.getElementById('param-auroraSpeed'), 'auroraSpeed', document.getElementById('val-auroraSpeed'), v => v.toFixed(2));

        const btnClear = document.getElementById('btn-clear-garden');
        if (btnClear) {
            btnClear.addEventListener('click', () => {
                if (this.visual.botanyModule) this.visual.botanyModule.clear();
            });
        }

        // Echo Controls
        const btnMic = document.getElementById('btn-mic');
        if (btnMic) {
            btnMic.addEventListener('click', () => {
                const newState = !this.audio.params.mic;
                this.audio.setParam('mic', newState);
                btnMic.classList.toggle('active', newState);
            });
        }
        this.bindSlider(document.getElementById('param-micReverb'), 'micReverb', null, null);
        this.bindSlider(document.getElementById('param-micDelay'), 'micDelay', null, null);

        // Prism Controls
        const overlay = document.getElementById('prism-fullscreen');
        const selGrade = document.getElementById('param-grade');
        const rangePrism = document.getElementById('param-prism');
        const valPrism = document.getElementById('val-prism');

        if (selGrade && overlay) {
            selGrade.addEventListener('change', (e) => {
                const grade = e.target.value;
                overlay.className = `grade-${grade}`;
                this.audio.setParam('grade', grade);
            });
        }

        if (rangePrism && overlay) {
            rangePrism.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                overlay.style.opacity = val;
                if (valPrism) valPrism.textContent = Math.round(val * 100) + '%';
                this.audio.setParam('prism', val);
            });
        }

        // Loom Init
        const loomGrid = document.getElementById('loom-grid');
        this.bindToggle('btn-kaleidoscope', 'kaleidoscope');
        this.bindSlider(document.getElementById('param-symmetry'), 'symmetry', document.getElementById('val-symmetry'));
        if (loomGrid) {
            for (let i = 0; i < 16; i++) {
                const col = document.createElement('div');
                col.className = 'loom-col';
                col.dataset.step = i;
                for (let j = 0; j < 4; j++) {
                    const cell = document.createElement('button');
                    cell.className = 'loom-cell';
                    cell.dataset.row = j;
                    cell.dataset.step = i;
                    col.appendChild(cell);
                }
                loomGrid.appendChild(col);
            }

            loomGrid.addEventListener('click', (e) => {
                if (e.target.classList.contains('loom-cell')) {
                    const step = parseInt(e.target.dataset.step);
                    const row = parseInt(e.target.dataset.row);
                    if (this.audio.sequencerModule) {
                        const active = this.audio.sequencerModule.toggleCell(step, row);
                        e.target.classList.toggle('active', active);
                    }
                }
            });

            // Step Callback
            // Note: init() runs before AudioChassis might be potentially ready if async? 
            // But AudioChassis init is sync for object creation.
            if (this.audio.sequencerModule) {
                this.audio.sequencerModule.setOnStepCallback((step) => {
                    // Use requestAnimationFrame for visual sync if needed, but direct DOM is okay here for blocky UI.
                    const cols = loomGrid.querySelectorAll('.loom-col');
                    cols.forEach(c => c.classList.remove('playing'));
                    if (cols[step]) cols[step].classList.add('playing');
                });
            }
        }

        // Loom Controls
        this.bindSlider(document.getElementById('param-bpm'), 'bpm', document.getElementById('val-bpm'), v => v + ' BPM');

        const btnSeq = document.getElementById('btn-sequencer');
        if (btnSeq) {
            btnSeq.addEventListener('click', () => {
                const newState = !this.audio.params.sequencer;
                this.audio.setParam('sequencer', newState);
                btnSeq.classList.toggle('active', newState);
                btnSeq.textContent = newState ? 'STOP SEQUENCE' : 'START SEQUENCE';
            });
        }

        const btnClearLoom = document.getElementById('btn-clear-loom');
        if (btnClearLoom) {
            btnClearLoom.addEventListener('click', () => {
                if (this.audio.sequencerModule) this.audio.sequencerModule.clear();
                document.querySelectorAll('.loom-cell').forEach(c => c.classList.remove('active'));
            });
        }

        // Laboratory Controls
        const btnPiano = document.getElementById('btn-engine-piano');
        const btnSynth = document.getElementById('btn-engine-synth');

        if (btnPiano && btnSynth) {
            btnPiano.addEventListener('click', () => {
                this.audio.setParam('synthMode', false);
                btnPiano.classList.add('active');
                btnSynth.classList.remove('active');
            });
            btnSynth.addEventListener('click', () => {
                this.audio.setParam('synthMode', true);
                btnSynth.classList.add('active');
                btnPiano.classList.remove('active');
            });
        }

        this.bindSlider(document.getElementById('param-cutoff'), 'cutoff', document.getElementById('val-cutoff'), v => Math.round(v * 100) + '%');
        this.bindSlider(document.getElementById('param-resonance'), 'resonance', document.getElementById('val-resonance'), v => Math.round(v * 100) + '%');
        this.bindSlider(document.getElementById('param-detune'), 'detune', document.getElementById('val-detune'), v => Math.round(v * 100) + '%');
        this.bindSlider(document.getElementById('param-waveform'), 'waveform', document.getElementById('val-waveform'), v => v < 0.5 ? 'Saw' : 'Square');

        // Alchemist Controls
        this.bindSlider(document.getElementById('param-g-density'), 'grainDensity', document.getElementById('val-g-density'), v => Math.round(v * 100) + '%');
        this.bindSlider(document.getElementById('param-g-size'), 'grainSize', document.getElementById('val-g-size'), v => Math.round(v * 100) + '%');
        this.bindSlider(document.getElementById('param-g-mix'), 'grainMix', document.getElementById('val-g-mix'), v => Math.round(v * 100) + '%');

        const btnTransmute = document.getElementById('btn-transmute');
        if (btnTransmute) {
            btnTransmute.addEventListener('click', () => {
                this.audio.transmuteGranular();
                // Visual feedback
                btnTransmute.textContent = 'TRANSMUTING...';
                setTimeout(() => btnTransmute.textContent = 'TRANSMUTE', 500);
            });
        }

        // Observatory Controls
        ['mercury', 'venus', 'mars'].forEach(p => {
            const sel = document.getElementById(`route-${p}`);
            if (sel) {
                sel.addEventListener('change', (e) => {
                    this.audio.setParam(`route${p.charAt(0).toUpperCase() + p.slice(1)}`, e.target.value);
                });
            }
        });

        // Orrery Viz
        const orreryCanvas = document.getElementById('orrery-viz');
        if (orreryCanvas) {
            const ctx = orreryCanvas.getContext('2d');
            const bodies = {
                mercury: { color: '#bdc3c7', dist: 0.3, size: 3 },
                venus: { color: '#f1c40f', dist: 0.5, size: 5 },
                earth: { color: '#3498db', dist: 0.7, size: 5 },
                mars: { color: '#e74c3c', dist: 0.9, size: 4 }
            };

            const animateOrrery = () => {
                const w = orreryCanvas.width = orreryCanvas.clientWidth;
                const h = orreryCanvas.height = orreryCanvas.clientHeight;
                const cx = w / 2;
                const cy = h / 2;
                const minDim = Math.min(w, h) * 0.45;

                ctx.fillStyle = '#0b0d12';
                ctx.fillRect(0, 0, w, h);

                // Sun
                ctx.fillStyle = '#f39c12';
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#f39c12';
                ctx.beginPath();
                ctx.arc(cx, cy, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;

                if (this.audio.orbitalModule) {
                    for (const key in bodies) {
                        const b = bodies[key];
                        const angle = this.audio.orbitalModule.getAngle(key);
                        const r = b.dist * minDim;

                        // Orbit Path
                        ctx.strokeStyle = '#2c3e50';
                        ctx.beginPath();
                        ctx.arc(cx, cy, r, 0, Math.PI * 2);
                        ctx.stroke();

                        // Planet
                        const px = cx + Math.cos(angle) * r;
                        const py = cy + Math.sin(angle) * r;

                        ctx.fillStyle = b.color;
                        ctx.beginPath();
                        ctx.arc(px, py, b.size, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }

                requestAnimationFrame(animateOrrery);
            };
            animateOrrery();
        }

        // Architecture Controls
        this.bindSlider(document.getElementById('param-struct-material'), 'structMaterial', document.getElementById('val-struct-material'), v => {
            if (v < 0.3) return 'Glass';
            if (v < 0.7) return 'Metal';
            return 'Concrete';
        });
        this.bindSlider(document.getElementById('param-struct-tension'), 'structTension', document.getElementById('val-struct-tension'), v => Math.round(v * 100) + '%');

        const btnStrike = document.getElementById('btn-struct-strike');
        let strikeImpact = 0;
        if (btnStrike) {
            btnStrike.addEventListener('click', () => {
                this.audio.strikeStructure();
                strikeImpact = 1.0;
            });
        }

        // Structure Viz (Wireframe Cube)
        const structCanvas = document.getElementById('structure-viz');
        if (structCanvas) {
            const ctx = structCanvas.getContext('2d');
            const animateStructure = () => {
                const w = structCanvas.width = structCanvas.clientWidth;
                const h = structCanvas.height = structCanvas.clientHeight;
                const cx = w / 2;
                const cy = h / 2;

                ctx.fillStyle = '#0b0d12';
                ctx.fillRect(0, 0, w, h);

                const size = 30 + (strikeImpact * 10);
                const rotation = Date.now() * 0.001;

                // Projection
                const points = [];
                for (let i = 0; i < 8; i++) {
                    let x = (i & 1) ? 1 : -1;
                    let y = (i & 2) ? 1 : -1;
                    let z = (i & 4) ? 1 : -1;

                    // Rotate
                    let rx = x * Math.cos(rotation) - z * Math.sin(rotation);
                    let rz = x * Math.sin(rotation) + z * Math.cos(rotation);
                    let ry = y * Math.cos(rotation * 0.5) - rz * Math.sin(rotation * 0.5);
                    rz = y * Math.sin(rotation * 0.5) + rz * Math.cos(rotation * 0.5);

                    points.push({
                        x: cx + rx * size,
                        y: cy + ry * size
                    });
                }

                ctx.strokeStyle = `rgba(0, 255, 200, ${0.2 + strikeImpact * 0.8})`;
                ctx.lineWidth = 1 + strikeImpact * 3;

                // Draw edges
                for (let i = 0; i < 8; i++) {
                    for (let j = i + 1; j < 8; j++) {
                        let diff = 0;
                        if ((i ^ j) === 1) diff++;
                        if ((i ^ j) === 2) diff++;
                        if ((i ^ j) === 4) diff++;
                        if (diff === 1) {
                            ctx.beginPath();
                            ctx.moveTo(points[i].x, points[i].y);
                            ctx.lineTo(points[j].x, points[j].y);
                            ctx.stroke();
                        }
                    }
                }

                strikeImpact *= 0.92;
                requestAnimationFrame(animateStructure);
            };
            animateStructure();
        }

        // Reactor Controls
        this.bindSlider(document.getElementById('param-reactor-drive'), 'reactorDrive', document.getElementById('val-reactor-drive'), v => Math.round(v * 100) + '%');
        this.bindSlider(document.getElementById('param-reactor-crush'), 'reactorCrush', document.getElementById('val-reactor-crush'), v => Math.round(v * 100) + '%');
        this.bindSlider(document.getElementById('param-reactor-meltdown'), 'reactorMeltdown', document.getElementById('val-reactor-meltdown'), v => Math.round(v * 100) + '%');

        // Plasma Viz
        const plasmaCanvas = document.getElementById('plasma-viz');
        if (plasmaCanvas) {
            const ctx = plasmaCanvas.getContext('2d');
            const particles = [];
            for (let i = 0; i < 20; i++) {
                particles.push({
                    x: Math.random(),
                    y: Math.random(),
                    vx: (Math.random() - 0.5) * 0.05,
                    vy: (Math.random() - 0.5) * 0.05
                });
            }

            const animatePlasma = () => {
                const w = plasmaCanvas.width = plasmaCanvas.clientWidth;
                const h = plasmaCanvas.height = plasmaCanvas.clientHeight;

                const drive = this.audio.params.reactorDrive;
                const meltdown = this.audio.params.reactorMeltdown;

                ctx.fillStyle = '#05070a';
                ctx.fillRect(0, 0, w, h);

                particles.forEach(p => {
                    p.x += p.vx * (1 + drive * 4);
                    p.y += p.vy * (1 + drive * 4);
                    if (p.x < 0 || p.x > 1) p.vx *= -1;
                    if (p.y < 0 || p.y > 1) p.vy *= -1;

                    const size = 2 + meltdown * 20;
                    const glow = ctx.createRadialGradient(p.x * w, p.y * h, 0, p.x * w, p.y * h, size * 2);
                    glow.addColorStop(0, `rgba(255, ${50 + meltdown * 200}, 0, 0.8)`);
                    glow.addColorStop(1, 'rgba(255, 0, 0, 0)');

                    ctx.fillStyle = glow;
                    ctx.beginPath();
                    ctx.arc(p.x * w, p.y * h, size * 2, 0, Math.PI * 2);
                    ctx.fill();
                });

                // Core glow
                const coreSize = 20 + drive * 30;
                const coreGlow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, coreSize);
                coreGlow.addColorStop(0, `rgba(0, 255, 255, ${0.1 + meltdown * 0.5})`);
                coreGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = coreGlow;
                ctx.fillRect(0, 0, w, h);

                requestAnimationFrame(animatePlasma);
            };
            animatePlasma();
        }

        // Singularity Controls
        const btnFreeze = document.getElementById('btn-sing-freeze');
        if (btnFreeze) {
            btnFreeze.addEventListener('click', () => {
                const currentState = this.audio.params.singFreeze;
                this.audio.setParam('singFreeze', !currentState);
                btnFreeze.classList.toggle('active', !currentState);
                if (!currentState) {
                    btnFreeze.style.boxShadow = '0 0 40px rgba(0, 119, 255, 0.8)';
                    btnFreeze.style.borderColor = '#00f2ff';
                } else {
                    btnFreeze.style.boxShadow = '0 0 20px rgba(0, 119, 255, 0.3)';
                    btnFreeze.style.borderColor = '#0077ff';
                }
            });
        }

        this.bindSlider(document.getElementById('param-sing-void'), 'singVoid', document.getElementById('val-sing-void'), v => Math.round(v * 100) + '%');
        this.bindSlider(document.getElementById('param-sing-shimmer'), 'singShimmer', document.getElementById('val-sing-shimmer'), v => Math.round(v * 100) + '%');

        // Gravity Well Viz
        const singCanvas = document.getElementById('singularity-viz');
        if (singCanvas) {
            const ctx = singCanvas.getContext('2d');
            let angle = 0;
            const animateSingularity = () => {
                const w = singCanvas.width = singCanvas.clientWidth;
                const h = singCanvas.height = singCanvas.clientHeight;
                const cx = w / 2;
                const cy = h / 2;

                const voidVal = this.audio.params.singVoid;
                const freeze = this.audio.params.singFreeze;
                const shimmer = this.audio.params.singShimmer;

                ctx.fillStyle = 'rgba(0, 0, 5, 0.1)';
                ctx.fillRect(0, 0, w, h);

                // Swirl
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(angle);

                const layers = 5 + Math.floor(voidVal * 10);
                for (let i = 0; i < layers; i++) {
                    const r = 20 + i * 10 * (1 + shimmer);
                    const alpha = 0.5 - (i / layers);
                    ctx.strokeStyle = `rgba(0, 100, 255, ${alpha})`;
                    if (freeze) ctx.strokeStyle = `rgba(0, 255, 255, ${alpha + 0.3})`;

                    ctx.beginPath();
                    ctx.ellipse(0, 0, r, r * 0.4, angle * (i + 1) * 0.1, 0, Math.PI * 2);
                    ctx.stroke();
                }
                ctx.restore();

                angle += 0.01 + (voidVal * 0.05);
                if (freeze) angle *= 0.99; // Slow down on freeze? No, let it jitter

                requestAnimationFrame(animateSingularity);
            };
            animateSingularity();
        }

        // Cartographer Logic
        const mapCanvas = document.getElementById('cartographer-map');
        const nodes = [
            { id: 'nature', label: 'N', color: '#00f2ff', x: 0.5, y: 0.5, param: 'posNature' },
            { id: 'wind', label: 'W', color: '#fff', x: 0.5, y: 0.5, param: 'posWind' },
            { id: 'synth', label: 'S', color: '#ff00ff', x: 0.5, y: 0.5, param: 'posSynth' },
            { id: 'granular', label: 'G', color: '#ffaa00', x: 0.5, y: 0.5, param: 'posGranular' }
        ];

        let draggingNode = null;

        if (mapCanvas) {
            const ctx = mapCanvas.getContext('2d');

            const getMousePos = (e) => {
                const rect = mapCanvas.getBoundingClientRect();
                return {
                    x: (e.clientX - rect.left) / rect.width,
                    y: (e.clientY - rect.top) / rect.height
                };
            };

            mapCanvas.addEventListener('mousedown', (e) => {
                const pos = getMousePos(e);
                nodes.forEach(n => {
                    const dx = n.x - pos.x;
                    const dy = n.y - pos.y;
                    if (Math.sqrt(dx * dx + dy * dy) < 0.1) draggingNode = n;
                });
            });

            window.addEventListener('mousemove', (e) => {
                if (draggingNode) {
                    const pos = getMousePos(e);
                    draggingNode.x = Math.max(0, Math.min(1, pos.x));
                    draggingNode.y = Math.max(0, Math.min(1, pos.y));
                    this.audio.setParam(draggingNode.param, { x: draggingNode.x, y: draggingNode.y });
                }
            });

            window.addEventListener('mouseup', () => {
                draggingNode = null;
            });

            const animateMap = () => {
                const w = mapCanvas.width = mapCanvas.clientWidth;
                const h = mapCanvas.height = mapCanvas.clientHeight;

                ctx.fillStyle = '#0b0d12';
                ctx.fillRect(0, 0, w, h);

                // Grid
                ctx.strokeStyle = '#1a1a1a';
                ctx.lineWidth = 1;
                for (let i = 1; i < 4; i++) {
                    ctx.beginPath(); ctx.moveTo(w * i / 4, 0); ctx.lineTo(w * i / 4, h); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(0, h * i / 4); ctx.lineTo(w, h * i / 4); ctx.stroke();
                }

                // Nodes
                nodes.forEach(n => {
                    ctx.fillStyle = n.color;
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = n.color;
                    ctx.beginPath();
                    ctx.arc(n.x * w, n.y * h, 8, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.shadowBlur = 0;
                    ctx.fillStyle = '#000';
                    ctx.font = 'bold 10px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(n.label, n.x * w, n.y * h);
                });

                requestAnimationFrame(animateMap);
            };
            animateMap();
        }

        // Monolith Logic
        this.bindSlider(document.getElementById('param-macro'), 'macroX', document.getElementById('val-macro'), v => Math.round(v * 100) + '%');

        ['nature', 'synth', 'void'].forEach(target => {
            const btn = document.getElementById(`btn-macro-${target}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    const paramName = `macro${target.charAt(0).toUpperCase() + target.slice(1)}`;
                    const newState = !this.audio.params[paramName];
                    this.audio.setParam(paramName, newState);
                    btn.classList.toggle('active', newState);
                });
            }
        });

        // Monolith Viz
        const monoCanvas = document.getElementById('monolith-viz');
        if (monoCanvas) {
            const ctx = monoCanvas.getContext('2d');
            const animateMonolith = () => {
                const w = monoCanvas.width = monoCanvas.clientWidth;
                const h = monoCanvas.height = monoCanvas.clientHeight;
                const cx = w / 2;
                const cy = h / 2;

                const macro = this.audio.params.macroX || 0;

                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, w, h);

                // Monolith Body
                const mw = 40 + macro * 20;
                const mh = 100 + macro * 40;
                const shake = (Math.random() - 0.5) * macro * 10;

                ctx.save();
                ctx.translate(cx + shake, cy);

                // Glow
                const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, mh);
                grd.addColorStop(0, `rgba(0, 255, 255, ${0.1 + macro * 0.4})`);
                grd.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = grd;
                ctx.fillRect(-w / 2, -h / 2, w, h);

                // Pillar
                ctx.fillStyle = '#111';
                ctx.strokeStyle = `rgba(0, 255, 255, ${0.3 + macro * 0.7})`;
                ctx.lineWidth = 2;

                // Draw a 3D trapezoid
                ctx.beginPath();
                ctx.moveTo(-mw / 2, mh / 2);
                ctx.lineTo(mw / 2, mh / 2);
                ctx.lineTo(mw / 4, -mh / 2);
                ctx.lineTo(-mw / 4, -mh / 2);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Core Light
                if (macro > 0.1) {
                    ctx.fillStyle = `rgba(0, 255, 255, ${macro})`;
                    ctx.shadowBlur = 20 * macro;
                    ctx.shadowColor = '#00f2ff';
                    ctx.beginPath();
                    ctx.arc(0, 0, 5 + macro * 10, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.restore();
                requestAnimationFrame(animateMonolith);
            };
            animateMonolith();
        }

        // Pulsar Logic
        const rateSelect = document.getElementById('param-pulsar-rate');
        if (rateSelect) {
            rateSelect.addEventListener('change', () => {
                this.audio.setParam('pulsarRate', parseFloat(rateSelect.value));
                document.getElementById('val-pulsar-rate').innerText = rateSelect.options[rateSelect.selectedIndex].text.split(' ')[0];
            });
        }

        this.bindSlider(document.getElementById('param-pulsar-depth'), 'pulsarDepth', document.getElementById('val-pulsar-depth'), v => Math.round(v * 100) + '%');

        const btnPulsarSq = document.getElementById('btn-pulsar-sq');
        const btnPulsarTri = document.getElementById('btn-pulsar-tri');
        const btnPulsarSaw = document.getElementById('btn-pulsar-saw');

        if (btnPulsarSq && btnPulsarTri && btnPulsarSaw) {
            btnPulsarSq.addEventListener('click', () => {
                this.audio.setParam('pulsarShape', 'square');
                btnPulsarSq.classList.add('active');
                btnPulsarTri.classList.remove('active');
                btnPulsarSaw.classList.remove('active');
            });
            btnPulsarTri.addEventListener('click', () => {
                this.audio.setParam('pulsarShape', 'triangle');
                btnPulsarTri.classList.add('active');
                btnPulsarSq.classList.remove('active');
                btnPulsarSaw.classList.remove('active');
            });
            btnPulsarSaw.addEventListener('click', () => {
                this.audio.setParam('pulsarShape', 'sawtooth');
                btnPulsarSaw.classList.add('active');
                btnPulsarSq.classList.remove('active');
                btnPulsarTri.classList.remove('active');
            });
        }

        const pulsarCanvas = document.getElementById('pulsar-viz');
        if (pulsarCanvas) {
            const ctx = pulsarCanvas.getContext('2d');
            const bars = 20;
            const animatePulsar = () => {
                const w = pulsarCanvas.width = pulsarCanvas.clientWidth;
                const h = pulsarCanvas.height = pulsarCanvas.clientHeight;

                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, w, h);

                const depth = this.audio.params.pulsarDepth;
                const time = Date.now() / 1000;
                const bps = this.audio.params.bpm / 60;
                const phase = (time * bps * this.audio.params.pulsarRate) % 1;

                let pulse = 0;
                if (this.audio.params.pulsarShape === 'square') pulse = phase < 0.5 ? 1 : 0;
                else if (this.audio.params.pulsarShape === 'triangle') pulse = phase < 0.5 ? phase * 2 : 2 - phase * 2;
                else pulse = 1 - phase;

                const barW = w / bars;
                for (let i = 0; i < bars; i++) {
                    const barH = (h * 0.2) + (pulse * h * 0.6 * (1 - (i / bars) * 0.5));
                    ctx.fillStyle = i % 2 === 0 ? '#00f2ff' : '#0077ff';
                    ctx.globalAlpha = 0.3 + (pulse * 0.7);
                    ctx.fillRect(i * barW, h - barH, barW - 1, barH);
                }
                ctx.globalAlpha = 1.0;

                requestAnimationFrame(animatePulsar);
            };
            animatePulsar();
        }

        // Archive Logic
        const selectMood = document.getElementById('select-mood');
        const btnOracle = document.getElementById('btn-oracle');
        const btnSnapshot = document.getElementById('btn-snapshot');
        const archiveTerm = document.getElementById('archive-terminal');

        const termLog = (msg) => {
            if (archiveTerm) archiveTerm.innerText = `> ${msg}_`;
        };

        if (selectMood) {
            selectMood.addEventListener('change', () => {
                this.audio.archiveModule.loadPreset(selectMood.value);
                termLog(`LOADED MOOD: ${selectMood.value.toUpperCase()}`);
            });
        }

        if (btnOracle) {
            btnOracle.addEventListener('click', () => {
                this.audio.archiveModule.oracle();
                termLog("ORACLE GENERATED NEW STATE");

                // Visual flourish
                btnOracle.style.boxShadow = '0 0 40px rgba(0, 242, 255, 0.8)';
                setTimeout(() => {
                    btnOracle.style.boxShadow = '0 0 15px rgba(0, 242, 255, 0.2)';
                }, 300);
            });
        }

        if (btnSnapshot) {
            btnSnapshot.addEventListener('click', () => {
                const state = this.audio.getState();
                console.log("Petrichor Lab State Snapshot:", state);
                termLog("SNAPSHOT CAPTURED TO CONSOLE");
            });
        }

        // Cassette Transport
        const btnTapePlay = document.getElementById('btn-tape-play');
        const btnTapeStop = document.getElementById('btn-tape-stop');

        if (btnTapePlay && btnTapeStop) {
            btnTapePlay.addEventListener('click', () => {
                this.audio.setParam('tapePlay', true);
                btnTapePlay.classList.add('active');
                btnTapeStop.classList.remove('active');
            });

            btnTapeStop.addEventListener('click', () => {
                this.audio.setParam('tapePlay', false);
                btnTapeStop.classList.add('active');
                btnTapePlay.classList.remove('active');
            });
        }

        this.bindSlider(document.getElementById('param-hiss'), 'hiss', document.getElementById('val-hiss'));
        this.bindSlider(document.getElementById('param-crackle'), 'crackle', document.getElementById('val-crackle'));
        this.bindSlider(document.getElementById('param-wobble'), 'wobble', document.getElementById('val-wobble'));

        // Tape Viz
        const tapeCanvas = document.getElementById('tape-viz');
        if (tapeCanvas) {
            const ctx = tapeCanvas.getContext('2d');
            let rotation = 0;

            const animateTape = () => {
                const w = tapeCanvas.width = tapeCanvas.clientWidth;
                const h = tapeCanvas.height = tapeCanvas.clientHeight;

                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, w, h);

                // Draw Reels
                const cx1 = w * 0.35;
                const cx2 = w * 0.65;
                const cy = h / 2;
                const r = h * 0.35;

                const drawReel = (x, y, r, rot) => {
                    ctx.save();
                    ctx.translate(x, y);
                    ctx.rotate(rot);

                    // Outer Rim
                    ctx.strokeStyle = '#666';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(0, 0, r, 0, Math.PI * 2);
                    ctx.stroke();

                    // Spokes
                    ctx.strokeStyle = '#444';
                    ctx.beginPath();
                    for (let i = 0; i < 3; i++) {
                        ctx.rotate(Math.PI / 1.5);
                        ctx.moveTo(0, 0);
                        ctx.lineTo(0, r);
                    }
                    ctx.stroke();

                    // Tape Cake (White)
                    ctx.fillStyle = '#eee';
                    ctx.beginPath();
                    ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.restore();
                };

                const playing = this.audio.params.tapePlay !== false;
                if (playing) rotation += 0.05;

                drawReel(cx1, cy, r, rotation);
                drawReel(cx2, cy, r, rotation);

                requestAnimationFrame(animateTape);
            };
            animateTape();
        }

        // Broadcast Tuner Viz
        const tunerCanvas = document.getElementById('tuner-viz');
        const tunerNeedle = document.getElementById('tuner-needle');

        if (tunerCanvas && tunerNeedle) {
            const ctx = tunerCanvas.getContext('2d');

            const animateTuner = () => {
                const w = tunerCanvas.width = tunerCanvas.clientWidth;
                const h = tunerCanvas.height = tunerCanvas.clientHeight;

                ctx.fillStyle = '#05070a';
                ctx.fillRect(0, 0, w, h);

                const active = this.audio.params.radio;
                if (active) {
                    // Retro Green/Ambver phosphor look?
                    ctx.fillStyle = 'rgba(100, 255, 218, 0.2)';

                    // Draw Static Snow
                    for (let i = 0; i < 200; i++) {
                        const x = Math.random() * w;
                        const y = Math.random() * h;
                        ctx.fillRect(x, y, 1, 1);
                    }
                }

                // Needle Position
                // We access params directly.
                const val = this.audio.params.tuning || 88;
                const pct = (val - 88) / (108 - 88) * 100;

                // Add jitter to needle based on randomness
                const jitter = active ? (Math.random() - 0.5) * 1.0 : 0;
                tunerNeedle.style.left = `calc(${pct}% + ${jitter}px)`;

                requestAnimationFrame(animateTuner);
            };
            animateTuner();
        }

        // Sliders (Existing)
        const formatTime = (val) => {
            const h = Math.floor(val);
            const m = Math.floor((val - h) * 60);
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        };

        this.bindSlider(this.elements.rain, 'rain', this.elements.valRain);
        this.bindSlider(this.elements.drops, 'drops', this.elements.valDrops);
        this.bindSlider(this.elements.wind, 'wind', this.elements.valWind);
        this.bindSlider(this.elements.thunder, 'thunder', this.elements.valThunder);
        this.bindSlider(this.elements.traffic, 'traffic', this.elements.valTraffic);
        this.bindSlider(this.elements.time, 'time', this.elements.valTime, formatTime);
        this.bindSlider(this.elements.biome, 'biome', this.elements.valBiome);
        this.bindSlider(this.elements.lofi, 'lofi', this.elements.valLoFi);
        this.bindSlider(this.elements.harmony, 'harmony', this.elements.valHarmony);
        this.bindSlider(this.elements.space, 'space', this.elements.valSpace);
        this.bindSlider(this.elements.chimes, 'chimes', this.elements.valChimes);
        this.bindSlider(this.elements.life, 'life', this.elements.valLife);
        this.bindSlider(this.elements.binaural, 'binaural', this.elements.valBinaural);
        this.bindSlider(this.elements.master, 'master', this.elements.valMaster);
        this.bindSlider(this.elements.vox, 'vox', this.elements.valVox);

        // Quantum Mirage (Phase 50)
        this.bindSlider(document.getElementById('param-entropy'), 'entropy', document.getElementById('val-entropy'));
        this.bindSlider(document.getElementById('param-displacement'), 'displacement', document.getElementById('val-displacement'));
        this.bindSlider(document.getElementById('param-quantumFlux'), 'quantumFlux', document.getElementById('val-quantumFlux'));

        // Fractal Echo (Phase 51)
        this.bindSlider(document.getElementById('param-recursion'), 'recursion', document.getElementById('val-recursion'));
        this.bindSlider(document.getElementById('param-symmetry2'), 'symmetry', document.getElementById('val-symmetry2'));
        this.bindSlider(document.getElementById('param-divergence'), 'divergence', document.getElementById('val-divergence'));

        // Tidal Rhythm (MOD-60)
        this.bindSlider(document.getElementById('param-tidal'), 'tidal', document.getElementById('val-tidal'));

        // Tidal Viz Canvas
        const tidalCanvas = document.getElementById('tidal-viz');
        if (tidalCanvas) {
            const ctx = tidalCanvas.getContext('2d');
            const animateTidal = () => {
                const w = tidalCanvas.width = tidalCanvas.clientWidth;
                const h = tidalCanvas.height = tidalCanvas.clientHeight;
                const cx = w / 2;
                const cy = h / 2;
                const tidal = this.audio.params.tidal || 0;

                ctx.fillStyle = 'rgba(0, 10, 20, 0.2)';
                ctx.fillRect(0, 0, w, h);

                if (tidal > 0.01) {
                    const now = Date.now() / 1000;
                    const tidalPhase = (Math.sin(now * Math.PI * 2 / 12) + 1) * 0.5;

                    // Concentric rings
                    for (let i = 0; i < 5; i++) {
                        const r = ((now * 30 + i * 40) % (Math.max(w, h) * 0.6));
                        const alpha = (1 - r / (Math.max(w, h) * 0.6)) * tidal * 0.6;
                        if (alpha > 0) {
                            ctx.beginPath();
                            ctx.arc(cx, cy, r, 0, Math.PI * 2);
                            ctx.strokeStyle = `rgba(0, ${150 + tidalPhase * 100}, 255, ${alpha})`;
                            ctx.lineWidth = 1.5;
                            ctx.stroke();
                        }
                    }

                    // Center glow
                    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 25 + tidalPhase * 15);
                    grd.addColorStop(0, `rgba(0, 200, 255, ${0.3 * tidal * tidalPhase})`);
                    grd.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    ctx.fillStyle = grd;
                    ctx.fillRect(0, 0, w, h);
                }

                requestAnimationFrame(animateTidal);
            };
            animateTidal();
        }

        // Void Whisper (MOD-61)
        this.bindSlider(document.getElementById('param-voidWhisper'), 'voidWhisper', document.getElementById('val-voidWhisper'));

        // Nebula Cloud (MOD-62)
        this.bindSlider(document.getElementById('param-nebula'), 'nebula', document.getElementById('val-nebula'));
        this.bindSlider(document.getElementById('param-nebulaDensity'), 'nebulaDensity', document.getElementById('val-nebulaDensity'));
        this.bindSlider(document.getElementById('param-nebulaShimmer'), 'nebulaShimmer', document.getElementById('val-nebulaShimmer'));

        // Shepard Engine (MOD-63)
        this.bindSlider(document.getElementById('param-shepard'), 'shepard', document.getElementById('val-shepard'));
        this.bindSlider(document.getElementById('param-shepardSpeed'), 'shepardSpeed', document.getElementById('val-shepardSpeed'));

        const btnShepardRise = document.getElementById('btn-shepard-rise');
        const btnShepardFall = document.getElementById('btn-shepard-fall');
        if (btnShepardRise && btnShepardFall) {
            btnShepardRise.addEventListener('click', () => {
                this.audio.setParam('shepardDirection', 1);
                btnShepardRise.classList.add('active');
                btnShepardFall.classList.remove('active');
            });
            btnShepardFall.addEventListener('click', () => {
                this.audio.setParam('shepardDirection', 0);
                btnShepardFall.classList.add('active');
                btnShepardRise.classList.remove('active');
            });
        }

        // Populate Presets
        this.refreshPresets();

        // Focus Listeners
        if (this.elements.btnFocusStart) {
            this.elements.btnFocusStart.addEventListener('click', () => {
                this.focus.startFocus();
            });
        }
        if (this.elements.btnFocusStop) {
            this.elements.btnFocusStop.addEventListener('click', () => {
                this.focus.stop();
            });
        }

        // Focus Events (Window)
        window.addEventListener('focus-tick', (e) => {
            const { time, state } = e.detail;
            if (this.elements.focusDisplay) this.elements.focusDisplay.textContent = FocusModule.formatTime(time);
            if (this.elements.focusStatus) {
                this.elements.focusStatus.textContent = state;
                this.elements.focusStatus.className = 'status-text ' + (state === 'FOCUS' ? 'status-focus' : 'status-break');
            }
        });

        window.addEventListener('focus-start', (e) => this.syncUI(e.detail));
        window.addEventListener('focus-restore', (e) => this.syncUI(e.detail));
        window.addEventListener('focus-stop', () => {
            if (this.elements.focusDisplay) this.elements.focusDisplay.textContent = "25:00";
            if (this.elements.focusStatus) {
                this.elements.focusStatus.textContent = "IDLE";
                this.elements.focusStatus.className = 'status-text';
            }
        });

        // Selects
        if (this.elements.surface) {
            this.elements.surface.addEventListener('change', (e) => this.audio.setSurface(e.target.value));
        }
        if (this.elements.reverb) {
            this.elements.reverb.addEventListener('change', (e) => this.audio.setReverb(e.target.value));
        }
        if (this.elements.vowel) {
            this.elements.vowel.addEventListener('change', (e) => this.audio.setParam('vowel', e.target.value));
        }

        // Toggle Buttons
        this.elements.waves.forEach(btn => {
            btn.addEventListener('click', () => {
                this.elements.waves.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.audio.setBinauralMode(btn.dataset.wave);
            });
        });

        // Recorder
        const recBtn = document.getElementById('rec-btn');
        if (recBtn) {
            recBtn.addEventListener('click', () => {
                const isRecording = this.audio.toggleRecording(() => {
                    recBtn.classList.remove('recording');
                    recBtn.textContent = '● REC';
                });

                if (isRecording) {
                    recBtn.classList.add('recording');
                    recBtn.textContent = '■ STOP';
                }
            });
        }
    }

    refreshPresets() {
        // Use the preset grid from Archive module or select dropdown
        const selectMood = document.getElementById('select-mood');
        if (!selectMood) return;
        // Presets handled via Archive module / Oracle system
    }

    handleSavePreset() {
        const name = prompt('Enter preset name:');
        if (!name || !name.trim()) return;
        this.presetManager.savePreset(name.trim(), this.audio.params);
        console.log(`Preset '${name.trim()}' saved.`);
    }

    syncUI(p) {
        // Update all inputs to match p results
        const setVal = (el, param) => {
            if (el && p[param] !== undefined) {
                el.value = p[param];
                el.dispatchEvent(new Event('input', { bubbles: true })); // Trigger listeners to update display/visuals
            }
        };

        setVal(this.elements.rain, 'rain');
        setVal(this.elements.drops, 'drops');
        setVal(this.elements.wind, 'wind');
        setVal(this.elements.thunder, 'thunder');
        setVal(this.elements.traffic, 'traffic');
        setVal(this.elements.time, 'time');
        setVal(this.elements.biome, 'biome');
        setVal(this.elements.lofi, 'lofi');
        setVal(this.elements.harmony, 'harmony');
        setVal(this.elements.space, 'space');
        setVal(this.elements.chimes, 'chimes');
        setVal(this.elements.life, 'life');
        setVal(this.elements.binaural, 'binaural');
        setVal(this.elements.master, 'master');

        if (this.elements.surface && p.surface) {
            this.elements.surface.value = p.surface;
            this.elements.surface.dispatchEvent(new Event('change'));
        }
        if (this.elements.reverb && p.reverb) {
            this.elements.reverb.value = p.reverb;
            this.elements.reverb.dispatchEvent(new Event('change'));
        }
    }

    setPowerState(isOn) {
        if (isOn) {
            this.elements.powerBtn.classList.add('active');
            this.elements.powerBtn.textContent = "SYSTEM ACTIVE";
            this.elements.statusText.textContent = "ONLINE";
            this.elements.statusDot.style.background = "#64ffda";
        } else {
            this.elements.powerBtn.classList.remove('active');
            this.elements.powerBtn.textContent = "INITIALIZE";
            this.elements.statusText.textContent = "STANDBY";
            this.elements.statusDot.style.background = "#ff4444";
        }
    }

    toggleZenith(active) {
        document.body.classList.toggle('zenith-mode', active);
        this.visual.setZenithActive(active);

        if (active) {
            if (document.documentElement.requestFullscreen) {
                // document.documentElement.requestFullscreen().catch(() => {});
            }
        } else {
            if (document.exitFullscreen && document.fullscreenElement) {
                // document.exitFullscreen().catch(() => {});
            }
        }

        setTimeout(() => this.visual.resize(), 600);
    }

    bindSlider(el, param, display, formatter) {
        if (!el) return;
        el.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.audio.setParam(param, val);

            if (display) {
                if (formatter) {
                    display.textContent = formatter(val);
                } else {
                    display.textContent = val.toFixed(2);
                }
            }

            // Visual Sync
            if (param === 'rain') this.visual.setRainIntensity(val);
            if (param === 'wind') this.visual.setWindSpeed(val);
            if (param === 'time') this.visual.setTimeOfDay(val);
        });
    }

    bindToggle(btnId, param) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.addEventListener('click', () => {
            const on = btn.classList.toggle('active');
            this.audio.setParam(param, on);
            if (this.visual.updateVizParams) this.visual.updateVizParams();
        });
    }

    attachGlobalControls() {
        // Recorder
        const btnRecord = document.getElementById('btn-record');
        if (btnRecord) {
            btnRecord.addEventListener('click', () => {
                const isRecording = btnRecord.classList.contains('recording');
                if (!isRecording) {
                    if (this.audio.startRecording()) {
                        btnRecord.classList.add('recording');
                        btnRecord.textContent = '■ STOP RECORDING';
                    }
                } else {
                    this.audio.stopRecording();
                    btnRecord.classList.remove('recording');
                    btnRecord.textContent = '● RECORD AUDIO';
                }
            });
        }

        // Force Reset
        const btnReset = document.getElementById('btn-force-reset');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                if (confirm('Restart Audio Engine? This will stop playback.')) {
                    window.location.reload();
                }
            });
        }
    }
}
