
        (() => {
            "use strict";

            // -----------------------------
            // Utilities
            // -----------------------------
            const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
            const lerp = (a, b, t) => a + (b - a) * t;

            function vtrap(x, y) {
                // stable x / (1 - exp(-x/y)) near x=0
                if (Math.abs(x) < 1e-7) return y;
                return x / (1 - Math.exp(-x / y));
            }

            const $ = (id) => document.getElementById(id);

            // -----------------------------
            // Global parameters / state
            // -----------------------------
            let running = false;
            let integrator = "rk2"; // euler | rk2 | rk4
            let dt = 0.025;         // ms
            let stepsPerFrame = 18;
            let windowMs = 300;

            let N = 64;
            let gAx = 1.20; // mS/cm^2 axial coupling gain (dimensionless-ish in this discretization)
            let dx_um = 50; // µm per compartment (for velocity estimate)

            let bc = "sealed"; // sealed | clamped
            const Vrest = -65.0;
            let thresh = 0; // mV

            // Stim targeting
            let stimIdx = 8;
            let stimSigma = 0.0;
            let probeIdx = 8;
            let velOn = true;

            // Temperature scaling
            let T = 6.3;
            let Q10 = 3.0;
            const Tref = 6.3;

            // HH params
            let Cm = 1.0;
            let gNa = 120.0;
            let gK = 36.0;
            let gL = 0.3;
            let ENa = 50.0;
            let EK = -77.0;
            let EL = -54.387;

            // Manual stimulus
            let IDC = 0.0;
            let pulseAmp = 10.0;
            let pulsePeriodMs = 20.0;
            let pulseDutyPct = 5;
            let pulseOn = true;

            let sineAmp = 0.0;
            let sineFreqHz = 8.0;
            let sinePhaseDeg = 0.0;

            let noiseAmp = 0.0;
            let noiseLPHz = 30;

            // DSL
            let useDSL = true;
            let loopProto = true;

            // Autopilot
            let autoMode = "off"; // off | pid_idc | pid_pulse
            let targetHz = 10.0;
            let rateWinMs = 1000;
            let Kp = 0.6, Ki = 0.12, Kd = 0.08;
            let ctlMax = 30.0;

            // Audio params
            let audMode = "ionic";
            let audGain = 0.25;
            let audBaseHz = 110;
            let audSpanOct = 2.0;
            let audClick = 0.35;
            let audLPF = 1800;
            let audDrive = 0.18;

            // Recording
            let recOn = false;
            let recEveryMs = 1.0;

            // Time
            let t_ms = 0;

            // Arrays (typed)
            let V, m, h, n;
            let Iinj; // per compartment injection (µA/cm^2)
            let INa_arr, IK_arr, IL_arr; // only for debug/optional; keep for probe calc quickly

            // Derivative work arrays
            let dV1, dm1, dh1, dn1;
            let Vt, mt, ht, nt;
            let dV2, dm2, dh2, dn2;

            // RK4 extras
            let dV3, dm3, dh3, dn3;
            let dV4, dm4, dh4, dn4;

            // For plotting time traces at probe
            class Ring {
                constructor(cap) { this.cap = cap | 0; this.a = new Float32Array(this.cap); this.i = 0; this.full = false; }
                push(x) { this.a[this.i] = x; this.i++; if (this.i >= this.cap) { this.i = 0; this.full = true; } }
                clear() { this.i = 0; this.full = false; }
                length() { return this.full ? this.cap : this.i; }
                forEach(fn) {
                    const n = this.length();
                    if (!this.full) { for (let k = 0; k < n; k++) fn(this.a[k], k, n); }
                    else {
                        let idx = 0;
                        for (let k = this.i; k < this.cap; k++) fn(this.a[k], idx++, n);
                        for (let k = 0; k < this.i; k++) fn(this.a[k], idx++, n);
                    }
                }
            }

            let cap = Math.max(200, Math.floor(windowMs / dt));
            let rbVt = new Ring(cap);
            let rbI0 = new Ring(cap);
            let rbRate = new Ring(cap);

            // Spike tracking for probe rate
            let prevVprobe = Vrest;
            let spikeTimes = []; // ms

            // Velocity estimation: detect spikes at two positions
            // Choose two measurement points separated in space.
            function velPoints() {
                // pick near stim site and a distal site
                const a = clamp(stimIdx | 0, 0, N - 1);
                const b = clamp(a + Math.max(3, Math.floor(N * 0.35)), 0, N - 1);
                return [a, b];
            }
            let prevV_a = Vrest, prevV_b = Vrest;
            let lastCross_a = null, lastCross_b = null;
            let lastVel_mps = null;

            // Kymograph
            const cvKymo = $("cvKymo");
            const cvVt = $("cvVt");
            const cvVx = $("cvVx");
            const cvProbe = $("cvProbe");
            const ctxK = cvKymo.getContext("2d");
            const ctxT = cvVt.getContext("2d");
            const ctxX = cvVx.getContext("2d");
            const ctxP = cvProbe.getContext("2d");

            function fitCanvas(canvas) {
                const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
                const rect = canvas.getBoundingClientRect();
                const w = Math.max(2, Math.floor(rect.width * dpr));
                const h = Math.max(2, Math.floor(rect.height * dpr));
                if (canvas.width !== w || canvas.height !== h) {
                    canvas.width = w; canvas.height = h;
                    return true;
                }
                return false;
            }

            function drawGrid(ctx, w, h) {
                ctx.save();
                ctx.clearRect(0, 0, w, h);
                ctx.globalAlpha = 0.75;
                ctx.lineWidth = 1;
                const gx = 10, gy = 8;
                for (let i = 1; i < gx; i++) {
                    const x = Math.floor(i * w / gx) + 0.5;
                    ctx.strokeStyle = "rgba(255,255,255,0.05)";
                    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
                }
                for (let j = 1; j < gy; j++) {
                    const y = Math.floor(j * h / gy) + 0.5;
                    ctx.strokeStyle = "rgba(255,255,255,0.05)";
                    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
                }
                ctx.globalAlpha = 1;
                ctx.strokeStyle = "rgba(122,166,255,0.15)";
                ctx.lineWidth = 1;
                ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
                ctx.restore();
            }

            function drawLineSeries(ctx, w, h, ring, yMin, yMax, color, lw = 2) {
                const n = ring.length();
                if (n < 2) return;
                ctx.save();
                ctx.strokeStyle = color;
                ctx.lineWidth = lw;
                ctx.globalAlpha = 0.95;
                let first = true;
                ctx.beginPath();
                ring.forEach((v, idx, Nn) => {
                    const x = (idx / (Nn - 1)) * (w - 1);
                    const t = (v - yMin) / (yMax - yMin);
                    const y = (1 - clamp(t, 0, 1)) * (h - 1);
                    if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
                });
                ctx.stroke();
                ctx.restore();
            }

            function drawText(ctx, w, h, lines) {
                ctx.save();
                ctx.fillStyle = "rgba(234,240,255,0.85)";
                ctx.font = `${Math.floor(Math.max(10, w / 60))}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace`;
                ctx.textBaseline = "top";
                let y = 10;
                for (const ln of lines) { ctx.fillText(ln, 12, y); y += 16; }
                ctx.restore();
            }

            // Map voltage to RGB for kymograph
            function vToRGB(v) {
                // normalize v in [-90..+50]
                const t = clamp((v + 90) / 140, 0, 1);
                // 3-stop gradient: deep blue -> violet -> warm red
                const c0 = [20, 40, 120], c1 = [130, 80, 210], c2 = [240, 90, 90];
                let r, g, b;
                if (t < 0.55) {
                    const u = t / 0.55;
                    r = lerp(c0[0], c1[0], u); g = lerp(c0[1], c1[1], u); b = lerp(c0[2], c1[2], u);
                } else {
                    const u = (t - 0.55) / 0.45;
                    r = lerp(c1[0], c2[0], u); g = lerp(c1[1], c2[1], u); b = lerp(c1[2], c2[2], u);
                }
                return [r | 0, g | 0, b | 0];
            }

            // -----------------------------
            // HH rates and phi
            // -----------------------------
            function phi() {
                return Math.pow(Q10, (T - Tref) / 10.0);
            }

            function rates(Vm) {
                // classic HH 1952 rates
                const an = 0.01 * vtrap(Vm + 55.0, 10.0);
                const bn = 0.125 * Math.exp(-(Vm + 65.0) / 80.0);

                const am = 0.1 * vtrap(Vm + 40.0, 10.0);
                const bm = 4.0 * Math.exp(-(Vm + 65.0) / 18.0);

                const ah = 0.07 * Math.exp(-(Vm + 65.0) / 20.0);
                const bh = 1.0 / (1.0 + Math.exp(-(Vm + 35.0) / 10.0));
                return { an, bn, am, bm, ah, bh };
            }

            // -----------------------------
            // Stimulus generators
            // -----------------------------
            // Manual noise filter state
            let noiseState = 0.0;

            function onePoleLP(prev, x, fcHz, dt_ms) {
                const fc = Math.max(0.5, fcHz);
                const tau = 1 / (2 * Math.PI * fc);
                const dts = dt_ms * 1e-3;
                const a = clamp(dts / (tau + dts), 0, 1);
                return prev + a * (x - prev);
            }

            function manualI0(t_ms_local, dt_ms_local) {
                let I0 = IDC;

                if (pulseOn) {
                    const P = Math.max(1e-6, pulsePeriodMs);
                    const duty = clamp(pulseDutyPct / 100, 0.01, 0.99);
                    const w = P * duty;
                    const x = t_ms_local % P;
                    if (x < w) I0 += pulseAmp;
                }

                if (sineAmp !== 0) {
                    const ph = (sinePhaseDeg * Math.PI / 180);
                    const ts = t_ms_local * 1e-3;
                    I0 += sineAmp * Math.sin(2 * Math.PI * sineFreqHz * ts + ph);
                }

                if (noiseAmp !== 0) {
                    const white = (Math.random() * 2 - 1) * noiseAmp;
                    noiseState = onePoleLP(noiseState, white, noiseLPHz, dt_ms_local);
                    I0 += noiseState;
                }

                return I0;
            }

            // -----------------------------
            // NeuroProtocol DSL engine
            // -----------------------------
            class ProtocolEngine {
                constructor() {
                    this.segs = [];
                    this.totalMs = 0;
                    this.compiled = false;
                    this.err = null;
                    this.idx = 0;
                    this.segT0 = 0;
                    this._noise = 0; // internal noise state
                }

                resetRuntime() {
                    this.idx = 0;
                    this.segT0 = 0;
                    this._noise = 0;
                }

                // parse time token: "300ms", "2s", "1500" (ms)
                parseTime(tok) {
                    if (!tok) throw new Error("Missing duration.");
                    const m = String(tok).trim().match(/^([0-9]*\.?[0-9]+)\s*(ms|s)?$/i);
                    if (!m) throw new Error(`Bad duration: ${tok}`);
                    const v = parseFloat(m[1]);
                    const u = (m[2] || "ms").toLowerCase();
                    return u === "s" ? v * 1000 : v;
                }

                parseNumber(tok, name) {
                    if (tok == null) throw new Error(`Missing ${name}.`);
                    const v = Number(tok);
                    if (!Number.isFinite(v)) throw new Error(`Bad ${name}: ${tok}`);
                    return v;
                }

                compile(text) {
                    this.segs = [];
                    this.totalMs = 0;
                    this.err = null;
                    this.compiled = false;
                    this.resetRuntime();

                    const lines = text.split(/\r?\n/);
                    for (let li = 0; li < lines.length; li++) {
                        let line = lines[li].trim();
                        if (!line) continue;
                        if (line.startsWith("#")) continue;

                        // remove inline comments
                        const hash = line.indexOf("#");
                        if (hash >= 0) line = line.slice(0, hash).trim();
                        if (!line) continue;

                        const toks = line.split(/\s+/);
                        if (toks[0].toLowerCase() !== "block") throw new Error(`Line ${li + 1}: expected "block"`);
                        if (toks.length < 3) throw new Error(`Line ${li + 1}: incomplete block.`);

                        const durMs = this.parseTime(toks[1]);
                        const type = toks[2].toLowerCase();

                        const seg = {
                            durMs,
                            type,
                            at: null,
                            spread: null,
                            params: {}
                        };

                        // parse the remainder as key-value-ish
                        // supported patterns:
                        //  dc <val>
                        //  off
                        //  pulse amp <A> period <P> duty <D>
                        //  sine amp <A> freq <F> phase <deg>
                        //  noise amp <A> lp <Hz>
                        //  ramp from <a> to <b>
                        //  chirp amp <A> f0 <a> f1 <b> phase <deg>
                        //
                        // modifiers:
                        //  at <idx>
                        //  spread <sigma>
                        let i = 3;
                        const needKV = (key) => {
                            if (i >= toks.length) throw new Error(`Line ${li + 1}: missing value after "${key}"`);
                            return toks[i++];
                        };

                        const readMod = (key) => {
                            const v = needKV(key);
                            if (key === "at") seg.at = clamp(parseInt(v, 10), 0, N - 1);
                            if (key === "spread") seg.spread = Math.max(0, Number(v));
                        };

                        if (type === "off") {
                            // nothing
                        } else if (type === "dc") {
                            if (i >= toks.length) throw new Error(`Line ${li + 1}: dc needs a value.`);
                            seg.params.value = Number(toks[i++]);
                        } else if (type === "pulse") {
                            seg.params.amp = 10;
                            seg.params.period = 20;
                            seg.params.duty = 5;
                            while (i < toks.length) {
                                const k = toks[i++].toLowerCase();
                                if (k === "amp") seg.params.amp = this.parseNumber(needKV(k), "amp");
                                else if (k === "period") seg.params.period = this.parseNumber(needKV(k), "period");
                                else if (k === "duty") seg.params.duty = this.parseNumber(needKV(k), "duty");
                                else if (k === "at" || k === "spread") { i--; readMod(k); }
                                else throw new Error(`Line ${li + 1}: unknown token "${k}" in pulse block.`);
                            }
                        } else if (type === "sine") {
                            seg.params.amp = 1;
                            seg.params.freq = 8;
                            seg.params.phase = 0;
                            while (i < toks.length) {
                                const k = toks[i++].toLowerCase();
                                if (k === "amp") seg.params.amp = this.parseNumber(needKV(k), "amp");
                                else if (k === "freq") seg.params.freq = this.parseNumber(needKV(k), "freq");
                                else if (k === "phase") seg.params.phase = this.parseNumber(needKV(k), "phase");
                                else if (k === "at" || k === "spread") { i--; readMod(k); }
                                else throw new Error(`Line ${li + 1}: unknown token "${k}" in sine block.`);
                            }
                        } else if (type === "noise") {
                            seg.params.amp = 0.5;
                            seg.params.lp = 30;
                            while (i < toks.length) {
                                const k = toks[i++].toLowerCase();
                                if (k === "amp") seg.params.amp = this.parseNumber(needKV(k), "amp");
                                else if (k === "lp") seg.params.lp = this.parseNumber(needKV(k), "lp");
                                else if (k === "at" || k === "spread") { i--; readMod(k); }
                                else throw new Error(`Line ${li + 1}: unknown token "${k}" in noise block.`);
                            }
                        } else if (type === "ramp") {
                            seg.params.from = 0;
                            seg.params.to = 10;
                            while (i < toks.length) {
                                const k = toks[i++].toLowerCase();
                                if (k === "from") seg.params.from = this.parseNumber(needKV(k), "from");
                                else if (k === "to") seg.params.to = this.parseNumber(needKV(k), "to");
                                else if (k === "at" || k === "spread") { i--; readMod(k); }
                                else throw new Error(`Line ${li + 1}: unknown token "${k}" in ramp block.`);
                            }
                        } else if (type === "chirp") {
                            seg.params.amp = 1.0;
                            seg.params.f0 = 2;
                            seg.params.f1 = 30;
                            seg.params.phase = 0;
                            while (i < toks.length) {
                                const k = toks[i++].toLowerCase();
                                if (k === "amp") seg.params.amp = this.parseNumber(needKV(k), "amp");
                                else if (k === "f0") seg.params.f0 = this.parseNumber(needKV(k), "f0");
                                else if (k === "f1") seg.params.f1 = this.parseNumber(needKV(k), "f1");
                                else if (k === "phase") seg.params.phase = this.parseNumber(needKV(k), "phase");
                                else if (k === "at" || k === "spread") { i--; readMod(k); }
                                else throw new Error(`Line ${li + 1}: unknown token "${k}" in chirp block.`);
                            }
                        } else {
                            throw new Error(`Line ${li + 1}: unknown block type "${type}".`);
                        }

                        // defaults for targeting if not provided
                        if (seg.at == null) seg.at = null;       // means use global stimIdx
                        if (seg.spread == null) seg.spread = null; // means use global stimSigma

                        this.segs.push(seg);
                        this.totalMs += durMs;
                    }

                    if (this.segs.length === 0) throw new Error("Protocol is empty.");

                    this.compiled = true;
                    this.err = null;
                    this.resetRuntime();
                }

                // returns {I0, center, sigma, protoT, segIndex}
                value(tGlobalMs, dtMs) {
                    if (!this.compiled) return { I0: 0, center: stimIdx, sigma: stimSigma, protoT: 0, segIndex: 0 };

                    const total = this.totalMs;
                    let t = tGlobalMs;
                    if (loopProto) {
                        t = ((t % total) + total) % total;
                    } else {
                        t = clamp(t, 0, total - 1e-9);
                    }

                    // find seg by walking from cached index (fast for small steps)
                    let idx = this.idx;
                    let segT0 = this.segT0;

                    // if time went backwards (e.g. reset) or jumped, reset scan
                    if (t < segT0 || idx >= this.segs.length) {
                        idx = 0; segT0 = 0; this._noise = 0;
                    }

                    // advance until t in segment
                    while (idx < this.segs.length) {
                        const seg = this.segs[idx];
                        const segT1 = segT0 + seg.durMs;
                        if (t < segT1) break;
                        idx++;
                        segT0 = segT1;
                        this._noise = 0; // reset noise between segments (intentional)
                    }
                    if (idx >= this.segs.length) {
                        idx = this.segs.length - 1;
                        segT0 = total - this.segs[idx].durMs;
                    }

                    // cache
                    this.idx = idx;
                    this.segT0 = segT0;

                    const seg = this.segs[idx];
                    const local = t - segT0;
                    const u = seg.durMs > 0 ? (local / seg.durMs) : 0;

                    let I0 = 0;
                    if (seg.type === "off") {
                        I0 = 0;
                    } else if (seg.type === "dc") {
                        I0 = seg.params.value || 0;
                    } else if (seg.type === "pulse") {
                        const amp = seg.params.amp ?? 10;
                        const P = Math.max(1e-6, seg.params.period ?? 20);
                        const duty = clamp((seg.params.duty ?? 5) / 100, 0.01, 0.99);
                        const w = P * duty;
                        const x = local % P;
                        I0 = (x < w) ? amp : 0;
                    } else if (seg.type === "sine") {
                        const amp = seg.params.amp ?? 1;
                        const f = seg.params.freq ?? 8;
                        const ph = (seg.params.phase ?? 0) * Math.PI / 180;
                        I0 = amp * Math.sin(2 * Math.PI * f * (local * 1e-3) + ph);
                    } else if (seg.type === "noise") {
                        const amp = seg.params.amp ?? 0.5;
                        const lp = seg.params.lp ?? 30;
                        const white = (Math.random() * 2 - 1) * amp;
                        this._noise = onePoleLP(this._noise, white, lp, dtMs);
                        I0 = this._noise;
                    } else if (seg.type === "ramp") {
                        const a = seg.params.from ?? 0;
                        const b = seg.params.to ?? 10;
                        I0 = lerp(a, b, clamp(u, 0, 1));
                    } else if (seg.type === "chirp") {
                        const amp = seg.params.amp ?? 1;
                        const f0 = Math.max(0.001, seg.params.f0 ?? 2);
                        const f1 = Math.max(0.001, seg.params.f1 ?? 30);
                        const ph0 = (seg.params.phase ?? 0) * Math.PI / 180;
                        // linear chirp: f(t)=f0 + (f1-f0)*u, phase = 2π ∫ f dt
                        // For linear frequency sweep, phase = 2π (f0*t + 0.5*k*t^2), where k=(f1-f0)/dur
                        const durS = Math.max(1e-6, seg.durMs * 1e-3);
                        const tt = local * 1e-3;
                        const k = (f1 - f0) / durS;
                        const phase = 2 * Math.PI * (f0 * tt + 0.5 * k * tt * tt) + ph0;
                        I0 = amp * Math.sin(phase);
                    }

                    const center = seg.at != null ? seg.at : stimIdx;
                    const sigma = seg.spread != null ? seg.spread : stimSigma;

                    return { I0, center, sigma, protoT: t, segIndex: idx };
                }
            }

            const proto = new ProtocolEngine();

            // -----------------------------
            // Autopilot (PID)
            // -----------------------------
            const pid = {
                i: 0, prevErr: 0, lastUpdate: 0, updateEveryMs: 50
            };
            function pidReset() { pid.i = 0; pid.prevErr = 0; pid.lastUpdate = 0; }
            function pidUpdate(tNow, measuredHz) {
                if (autoMode === "off") return;
                if ((tNow - pid.lastUpdate) < pid.updateEveryMs) return;
                pid.lastUpdate = tNow;

                const err = targetHz - measuredHz;
                pid.i += err * (pid.updateEveryMs * 1e-3);
                pid.i = clamp(pid.i, -80, 80);
                const d = (err - pid.prevErr) / (pid.updateEveryMs * 1e-3);
                pid.prevErr = err;

                const u = Kp * err + Ki * pid.i + Kd * d;

                if (autoMode === "pid_idc") {
                    IDC = clamp(IDC + u * 0.08, -20, ctlMax);
                    // reflect UI quickly
                    $("rngIDC").value = IDC;
                    $("rngIDC").dispatchEvent(new Event("input"));
                } else if (autoMode === "pid_pulse") {
                    pulseAmp = clamp(pulseAmp + u * 0.08, 0, ctlMax);
                    $("rngIPulse").value = pulseAmp;
                    $("rngIPulse").dispatchEvent(new Event("input"));
                }
            }

            // -----------------------------
            // Cable + HH dynamics (vectorized)
            // -----------------------------
            function allocArrays() {
                V = new Float32Array(N);
                m = new Float32Array(N);
                h = new Float32Array(N);
                n = new Float32Array(N);

                Iinj = new Float32Array(N);
                INa_arr = new Float32Array(N);
                IK_arr = new Float32Array(N);
                IL_arr = new Float32Array(N);

                dV1 = new Float32Array(N);
                dm1 = new Float32Array(N);
                dh1 = new Float32Array(N);
                dn1 = new Float32Array(N);

                Vt = new Float32Array(N);
                mt = new Float32Array(N);
                ht = new Float32Array(N);
                nt = new Float32Array(N);

                dV2 = new Float32Array(N);
                dm2 = new Float32Array(N);
                dh2 = new Float32Array(N);
                dn2 = new Float32Array(N);

                // RK4 arrays
                dV3 = new Float32Array(N);
                dm3 = new Float32Array(N);
                dh3 = new Float32Array(N);
                dn3 = new Float32Array(N);
                dV4 = new Float32Array(N);
                dm4 = new Float32Array(N);
                dh4 = new Float32Array(N);
                dn4 = new Float32Array(N);

                // resize ring buffers
                cap = Math.max(200, Math.floor(windowMs / dt));
                rbVt = new Ring(cap);
                rbI0 = new Ring(cap);
                rbRate = new Ring(cap);

                // update stim/probe sliders max
                $("rngStimIdx").max = String(N - 1);
                $("rngProbeIdx").max = String(N - 1);

                if (stimIdx >= N) stimIdx = N - 1;
                if (probeIdx >= N) probeIdx = N - 1;

                $("rngStimIdx").value = String(stimIdx);
                $("rngStimIdx").dispatchEvent(new Event("input"));

                $("rngProbeIdx").value = String(probeIdx);
                $("rngProbeIdx").dispatchEvent(new Event("input"));
            }

            function resetCable() {
                // initialize to rest, and approximate steady gating at rest
                for (let i = 0; i < N; i++) {
                    V[i] = Vrest;

                    // classic approximate steady-state at rest:
                    // Use alpha/(alpha+beta) evaluated at Vrest
                    const { an, bn, am, bm, ah, bh } = rates(Vrest);
                    m[i] = am / (am + bm);
                    h[i] = ah / (ah + bh);
                    n[i] = an / (an + bn);
                }

                t_ms = 0;
                noiseState = 0;
                prevVprobe = V[probeIdx];
                spikeTimes = [];
                rbVt.clear(); rbI0.clear(); rbRate.clear();

                const [a, b] = velPoints();
                prevV_a = V[a]; prevV_b = V[b];
                lastCross_a = null; lastCross_b = null; lastVel_mps = null;

                pidReset();
                proto.resetRuntime();

                // reset kymograph by clearing to transparent
                fitCanvas(cvKymo);
                ctxK.clearRect(0, 0, cvKymo.width, cvKymo.height);

                recorder.clear();

                refreshJSONBox();
            }

            function computeDerivs(Vsrc, msrc, hsrc, nsrc, IinjSrc, out_dV, out_dm, out_dh, out_dn, out_INa = null, out_IK = null, out_IL = null) {
                const ph = phi();
                const clampEnds = (bc === "clamped");
                for (let i = 0; i < N; i++) {
                    const Vi = Vsrc[i];
                    const { an, bn, am, bm, ah, bh } = rates(Vi);

                    // gating
                    const dmi = ph * (am * (1 - msrc[i]) - bm * msrc[i]);
                    const dhi = ph * (ah * (1 - hsrc[i]) - bh * hsrc[i]);
                    const dni = ph * (an * (1 - nsrc[i]) - bn * nsrc[i]);

                    // conductances
                    const gNa_t = gNa * (msrc[i] * msrc[i] * msrc[i]) * hsrc[i];
                    const n4 = nsrc[i] * nsrc[i] * nsrc[i] * nsrc[i];
                    const gK_t = gK * n4;

                    const INa = gNa_t * (Vi - ENa);
                    const IK = gK_t * (Vi - EK);
                    const IL = gL * (Vi - EL);

                    // axial coupling
                    // sealed: ghost V(-1)=V(0), V(N)=V(N-1)
                    // clamped: ends are pulled toward Vrest via extra leak-like term
                    let Vim1 = (i === 0) ? (bc === "sealed" ? Vsrc[0] : Vrest) : Vsrc[i - 1];
                    let Vip1 = (i === N - 1) ? (bc === "sealed" ? Vsrc[N - 1] : Vrest) : Vsrc[i + 1];
                    let Iax = gAx * ((Vim1 - Vi) + (Vip1 - Vi));

                    // if clamped: add a stronger boundary "return" term at ends
                    if (clampEnds && (i === 0 || i === N - 1)) {
                        // boundary clamp strength ties end nodes to Vrest
                        const gClamp = gAx * 2.5;
                        Iax += gClamp * (Vrest - Vi);
                    }

                    const Iion = INa + IK + IL;
                    const dVi = (IinjSrc[i] - Iion + Iax) / Cm;

                    out_dV[i] = dVi;
                    out_dm[i] = dmi;
                    out_dh[i] = dhi;
                    out_dn[i] = dni;

                    if (out_INa) out_INa[i] = INa;
                    if (out_IK) out_IK[i] = IK;
                    if (out_IL) out_IL[i] = IL;
                }
            }

            function applyStepEuler() {
                computeDerivs(V, m, h, n, Iinj, dV1, dm1, dh1, dn1, INa_arr, IK_arr, IL_arr);
                for (let i = 0; i < N; i++) {
                    V[i] += dt * dV1[i];
                    m[i] = clamp(m[i] + dt * dm1[i], 0, 1);
                    h[i] = clamp(h[i] + dt * dh1[i], 0, 1);
                    n[i] = clamp(n[i] + dt * dn1[i], 0, 1);
                }
            }

            function applyStepRK2() {
                computeDerivs(V, m, h, n, Iinj, dV1, dm1, dh1, dn1, null, null, null);

                for (let i = 0; i < N; i++) {
                    Vt[i] = V[i] + dt * dV1[i];
                    mt[i] = clamp(m[i] + dt * dm1[i], 0, 1);
                    ht[i] = clamp(h[i] + dt * dh1[i], 0, 1);
                    nt[i] = clamp(n[i] + dt * dn1[i], 0, 1);
                }

                computeDerivs(Vt, mt, ht, nt, Iinj, dV2, dm2, dh2, dn2, INa_arr, IK_arr, IL_arr);

                for (let i = 0; i < N; i++) {
                    V[i] += dt * 0.5 * (dV1[i] + dV2[i]);
                    m[i] = clamp(m[i] + dt * 0.5 * (dm1[i] + dm2[i]), 0, 1);
                    h[i] = clamp(h[i] + dt * 0.5 * (dh1[i] + dh2[i]), 0, 1);
                    n[i] = clamp(n[i] + dt * 0.5 * (dn1[i] + dn2[i]), 0, 1);
                }
            }

            function applyStepRK4() {
                // k1
                computeDerivs(V, m, h, n, Iinj, dV1, dm1, dh1, dn1, null, null, null);
                for (let i = 0; i < N; i++) {
                    Vt[i] = V[i] + 0.5 * dt * dV1[i];
                    mt[i] = clamp(m[i] + 0.5 * dt * dm1[i], 0, 1);
                    ht[i] = clamp(h[i] + 0.5 * dt * dh1[i], 0, 1);
                    nt[i] = clamp(n[i] + 0.5 * dt * dn1[i], 0, 1);
                }

                // k2
                computeDerivs(Vt, mt, ht, nt, Iinj, dV2, dm2, dh2, dn2, null, null, null);
                for (let i = 0; i < N; i++) {
                    Vt[i] = V[i] + 0.5 * dt * dV2[i];
                    mt[i] = clamp(m[i] + 0.5 * dt * dm2[i], 0, 1);
                    ht[i] = clamp(h[i] + 0.5 * dt * dh2[i], 0, 1);
                    nt[i] = clamp(n[i] + 0.5 * dt * dn2[i], 0, 1);
                }

                // k3
                computeDerivs(Vt, mt, ht, nt, Iinj, dV3, dm3, dh3, dn3, null, null, null);
                for (let i = 0; i < N; i++) {
                    Vt[i] = V[i] + dt * dV3[i];
                    mt[i] = clamp(m[i] + dt * dm3[i], 0, 1);
                    ht[i] = clamp(h[i] + dt * dh3[i], 0, 1);
                    nt[i] = clamp(n[i] + dt * dn3[i], 0, 1);
                }

                // k4
                computeDerivs(Vt, mt, ht, nt, Iinj, dV4, dm4, dh4, dn4, INa_arr, IK_arr, IL_arr);

                for (let i = 0; i < N; i++) {
                    V[i] += (dt / 6) * (dV1[i] + 2 * dV2[i] + 2 * dV3[i] + dV4[i]);
                    m[i] = clamp(m[i] + (dt / 6) * (dm1[i] + 2 * dm2[i] + 2 * dm3[i] + dm4[i]), 0, 1);
                    h[i] = clamp(h[i] + (dt / 6) * (dh1[i] + 2 * dh2[i] + 2 * dh3[i] + dh4[i]), 0, 1);
                    n[i] = clamp(n[i] + (dt / 6) * (dn1[i] + 2 * dn2[i] + 2 * dn3[i] + dn4[i]), 0, 1);
                }
            }

            function applyIntegratorStep() {
                if (integrator === "euler") applyStepEuler();
                else if (integrator === "rk4") applyStepRK4();
                else applyStepRK2();
            }

            // -----------------------------
            // Build Iinj profile each substep
            // -----------------------------
            function buildIinj(I0, center, sigma) {
                // sigma in compartments; if 0 -> delta injection
                if (sigma <= 0) {
                    Iinj.fill(0);
                    const c = clamp(center | 0, 0, N - 1);
                    Iinj[c] = I0;
                    return;
                }
                const c = center;
                const s2 = sigma * sigma * 2;
                for (let i = 0; i < N; i++) {
                    const d = i - c;
                    Iinj[i] = I0 * Math.exp(-(d * d) / s2);
                }
            }

            // -----------------------------
            // Probe rate (sliding window)
            // -----------------------------
            function computeRateHz(tNow) {
                const tMin = tNow - rateWinMs;
                while (spikeTimes.length && spikeTimes[0] < tMin) spikeTimes.shift();
                return spikeTimes.length / (rateWinMs * 1e-3);
            }

            // -----------------------------
            // Velocity estimation (threshold crossing at two points)
            // -----------------------------
            function updateVelocity() {
                if (!velOn) { lastVel_mps = null; return; }
                const [a, b] = velPoints();
                const Va = V[a], Vb = V[b];

                // detect rising crossings for each point
                if (prevV_a < thresh && Va >= thresh) lastCross_a = t_ms;
                if (prevV_b < thresh && Vb >= thresh) lastCross_b = t_ms;

                prevV_a = Va; prevV_b = Vb;

                if (lastCross_a != null && lastCross_b != null) {
                    // prefer propagation from a->b
                    const dt_ms_ab = lastCross_b - lastCross_a;
                    if (dt_ms_ab > 0.05 && dt_ms_ab < 2000) {
                        const dx_m = ((b - a) * dx_um) * 1e-6;
                        const v = dx_m / (dt_ms_ab * 1e-3);
                        // clamp to sane range (avoid single-step noise)
                        if (Number.isFinite(v) && v > 0 && v < 200) {
                            lastVel_mps = v;
                        }
                    }
                }
            }

            // -----------------------------
            // Kymograph update (scrolling canvas)
            // -----------------------------
            function kymoPushColumn() {
                fitCanvas(cvKymo);
                const w = cvKymo.width, hgt = cvKymo.height;

                // shift image left by 1 pixel
                ctxK.drawImage(cvKymo, -1, 0);

                // draw new column at right
                const x = w - 1;
                // Map compartments to y
                // We'll draw 1px height per compartment if enough height; else scale
                for (let i = 0; i < N; i++) {
                    const y0 = Math.floor((i / N) * hgt);
                    const y1 = Math.floor(((i + 1) / N) * hgt);
                    const [r, g, b] = vToRGB(V[i]);
                    ctxK.fillStyle = `rgb(${r},${g},${b})`;
                    ctxK.fillRect(x, y0, 1, Math.max(1, y1 - y0));
                }

                // marker lines for stim/probe points (subtle)
                ctxK.save();
                ctxK.globalAlpha = 0.55;

                const ysStim = Math.floor((stimIdx / N) * hgt);
                ctxK.fillStyle = "rgba(116,246,198,0.20)";
                ctxK.fillRect(x, ysStim, 1, Math.max(1, Math.floor(hgt / N)));

                const ysProbe = Math.floor((probeIdx / N) * hgt);
                ctxK.fillStyle = "rgba(255,214,110,0.20)";
                ctxK.fillRect(x, ysProbe, 1, Math.max(1, Math.floor(hgt / N)));

                ctxK.restore();
            }

            // -----------------------------
            // Probe readouts (currents, gates)
            // -----------------------------
            function computeProbeCurrents(i) {
                const Vi = V[i];
                const mi = m[i], hi = h[i], ni = n[i];
                const gNa_t = gNa * (mi * mi * mi) * hi;
                const n4 = ni * ni * ni * ni;
                const gK_t = gK * n4;

                const INa = gNa_t * (Vi - ENa);
                const IK = gK_t * (Vi - EK);
                const IL = gL * (Vi - EL);
                return { INa, IK, IL };
            }

            // -----------------------------
            // Audio engine (probe-based)
            // -----------------------------
            class AudioEngine {
                constructor() {
                    this.ctx = null; this.enabled = false;
                    this.master = null; this.osc = null;
                    this.modOsc = null; this.modGain = null;
                    this.shaper = null; this.filter = null;
                    this.clickHP = null; this.clickMix = null;
                    this.mode = "ionic";
                    this._lastSpikeT = -1e9;
                }

                _makeDriveCurve(amount) {
                    const k = 1 + amount * 30;
                    const n = 2048;
                    const curve = new Float32Array(n);
                    for (let i = 0; i < n; i++) {
                        const x = (i / (n - 1)) * 2 - 1;
                        curve[i] = Math.tanh(k * x) / Math.tanh(k);
                    }
                    return curve;
                }

                async enable() {
                    if (this.ctx) return true;
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    if (!AudioContext) return false;

                    this.ctx = new AudioContext({ latencyHint: "interactive" });

                    this.master = this.ctx.createGain();
                    this.master.gain.value = audGain;

                    this.osc = this.ctx.createOscillator();
                    this.osc.type = "sawtooth";

                    this.modOsc = this.ctx.createOscillator();
                    this.modOsc.type = "sine";
                    this.modOsc.frequency.value = 6;

                    this.modGain = this.ctx.createGain();
                    this.modGain.gain.value = 0;
                    this.modOsc.connect(this.modGain);
                    this.modGain.connect(this.osc.frequency);

                    this.shaper = this.ctx.createWaveShaper();
                    this.shaper.curve = this._makeDriveCurve(audDrive);
                    this.shaper.oversample = "2x";

                    this.filter = this.ctx.createBiquadFilter();
                    this.filter.type = "lowpass";
                    this.filter.frequency.value = audLPF;
                    this.filter.Q.value = 0.7;

                    this.clickMix = this.ctx.createGain();
                    this.clickMix.gain.value = 1;

                    this.clickHP = this.ctx.createBiquadFilter();
                    this.clickHP.type = "highpass";
                    this.clickHP.frequency.value = 900;
                    this.clickHP.Q.value = 0.9;

                    this.osc.connect(this.shaper);
                    this.shaper.connect(this.filter);
                    this.filter.connect(this.master);

                    this.clickMix.connect(this.clickHP);
                    this.clickHP.connect(this.master);

                    this.master.connect(this.ctx.destination);

                    this.osc.start();
                    this.modOsc.start();
                    this.enabled = true;
                    return true;
                }

                disable() {
                    this.enabled = false;
                    if (this.ctx) {
                        try { this.osc?.stop(); this.modOsc?.stop(); } catch (e) { }
                        this.ctx.close();
                    }
                    this.ctx = null;
                    this.master = this.osc = this.modOsc = this.modGain = this.shaper = this.filter = null;
                    this.clickHP = this.clickMix = null;
                }

                setParams() {
                    if (!this.ctx) return;
                    this.master.gain.setTargetAtTime(audGain, this.ctx.currentTime, 0.01);
                    this.filter.frequency.setTargetAtTime(audLPF, this.ctx.currentTime, 0.01);
                    this.shaper.curve = this._makeDriveCurve(audDrive);
                    this.mode = audMode;
                }

                triggerSpike() {
                    if (!this.ctx || !this.enabled) return;
                    const t = this.ctx.currentTime;
                    // noise burst
                    const dur = 0.02;
                    const sr = this.ctx.sampleRate;
                    const len = Math.floor(sr * dur);
                    const buf = this.ctx.createBuffer(1, len, sr);
                    const d = buf.getChannelData(0);
                    for (let i = 0; i < len; i++) {
                        const env = Math.exp(-i / (sr * 0.004));
                        d[i] = (Math.random() * 2 - 1) * env;
                    }
                    const src = this.ctx.createBufferSource();
                    src.buffer = buf;

                    const g = this.ctx.createGain();
                    g.gain.setValueAtTime(0, t);
                    g.gain.linearRampToValueAtTime(audClick, t + 0.001);
                    g.gain.exponentialRampToValueAtTime(1e-4, t + dur);

                    src.connect(g);
                    g.connect(this.clickMix);

                    src.start(t);
                    src.stop(t + dur + 0.01);
                }

                updateFromProbe(probe, spiked) {
                    if (!this.ctx || !this.enabled) return;
                    const t = this.ctx.currentTime;

                    const Vn = clamp((probe.V + 90) / 140, 0, 1);
                    const pitch = audBaseHz * Math.pow(2, (Vn - 0.5) * audSpanOct);

                    if (this.mode === "ionic") {
                        this.osc.frequency.setTargetAtTime(pitch, t, 0.01);

                        const outward = clamp((probe.IK + probe.IL) / 200, 0, 1);
                        const inward = clamp((-probe.INa) / 400, 0, 1);
                        const cutoff = clamp(lerp(700, 5200, 0.25 + 0.55 * outward + 0.35 * inward), 200, 8000);

                        this.filter.frequency.setTargetAtTime(cutoff, t, 0.015);
                        const fm = 40 + 240 * (0.6 * probe.m + 0.4 * probe.n);
                        this.modOsc.frequency.setTargetAtTime(2 + 18 * probe.n, t, 0.02);
                        this.modGain.gain.setTargetAtTime(fm, t, 0.02);

                    } else if (this.mode === "spike") {
                        this.osc.frequency.setTargetAtTime(audBaseHz * Math.pow(2, 0.12 * (Vn - 0.5)), t, 0.02);
                        this.modGain.gain.setTargetAtTime(0, t, 0.02);
                        this.filter.frequency.setTargetAtTime(audLPF, t, 0.03);
                        if (spiked) this.triggerSpike();

                    } else {
                        const idx = 50 + 900 * (probe.m * (1 - probe.h)) + 500 * probe.n;
                        this.osc.frequency.setTargetAtTime(pitch, t, 0.01);
                        this.modOsc.frequency.setTargetAtTime(3 + 22 * probe.n + 10 * probe.m, t, 0.01);
                        this.modGain.gain.setTargetAtTime(idx, t, 0.01);
                        const cutoff = clamp(lerp(500, 6500, 0.2 + 0.8 * (probe.m + probe.n) / 2), 200, 8000);
                        this.filter.frequency.setTargetAtTime(cutoff, t, 0.01);
                        if (spiked) this.triggerSpike();
                    }
                }

                async renderWav10s(snapshotJSON) {
                    const durationSec = 10;
                    const sampleRate = 44100;
                    const OfflineAudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
                    if (!OfflineAudioContext) throw new Error("OfflineAudioContext not supported.");

                    const snap = JSON.parse(snapshotJSON);

                    const ctx = new OfflineAudioContext(1, durationSec * sampleRate, sampleRate);

                    const master = ctx.createGain();
                    master.gain.value = snap.aud.gain;

                    const osc = ctx.createOscillator();
                    osc.type = "sawtooth";

                    const modOsc = ctx.createOscillator();
                    modOsc.type = "sine";
                    const modGain = ctx.createGain();
                    modGain.gain.value = 0;
                    modOsc.connect(modGain);
                    modGain.connect(osc.frequency);

                    const shaper = ctx.createWaveShaper();
                    shaper.curve = this._makeDriveCurve(snap.aud.drive);
                    shaper.oversample = "2x";

                    const filter = ctx.createBiquadFilter();
                    filter.type = "lowpass";
                    filter.frequency.value = snap.aud.lpf;
                    filter.Q.value = 0.7;

                    const clickMix = ctx.createGain();
                    clickMix.gain.value = 1;
                    const clickHP = ctx.createBiquadFilter();
                    clickHP.type = "highpass";
                    clickHP.frequency.value = 900;
                    clickHP.Q.value = 0.9;

                    osc.connect(shaper); shaper.connect(filter); filter.connect(master);
                    clickMix.connect(clickHP); clickHP.connect(master);
                    master.connect(ctx.destination);

                    osc.start(0); modOsc.start(0);

                    // Reconstruct model arrays
                    const Ns = snap.cable.N;
                    const V0 = new Float32Array(Ns);
                    const m0 = new Float32Array(Ns);
                    const h0 = new Float32Array(Ns);
                    const n0 = new Float32Array(Ns);

                    for (let i = 0; i < Ns; i++) {
                        V0[i] = snap.state.V[i];
                        m0[i] = snap.state.m[i];
                        h0[i] = snap.state.h[i];
                        n0[i] = snap.state.n[i];
                    }

                    // Use a mini-deriv with snapshot params (avoid touching live globals)
                    const params = snap.hh;
                    const cable = snap.cable;
                    const stimCfg = snap.stim;
                    const protoSnap = snap.proto;

                    // protocol
                    const pe = new ProtocolEngine();
                    // temporarily override N for compile parsing
                    const oldN = N; // stash global
                    // HACK: ProtocolEngine uses global N in compile; emulate by setting global N
                    // We only do this in offline render; restore immediately.
                    N = Ns;
                    try {
                        if (protoSnap.compiled && protoSnap.text) {
                            pe.compile(protoSnap.text);
                            pe.compiled = true;
                        } else {
                            pe.compiled = false;
                        }
                    } finally {
                        N = oldN;
                    }
                    pe.resetRuntime();

                    let tms = 0;
                    let noiseSt = 0;
                    let prevVp = V0[stimCfg.probeIdx];
                    let spikeCooldown = -1e9;

                    // helper: compute phi from snapshot temp
                    const phiS = () => Math.pow(params.Q10, (params.T - params.Tref) / 10);

                    const IinjS = new Float32Array(Ns);
                    const dV = new Float32Array(Ns), dm_ = new Float32Array(Ns), dh_ = new Float32Array(Ns), dn_ = new Float32Array(Ns);
                    const Vt_ = new Float32Array(Ns), mt_ = new Float32Array(Ns), ht_ = new Float32Array(Ns), nt_ = new Float32Array(Ns);
                    const dV2_ = new Float32Array(Ns), dm2_ = new Float32Array(Ns), dh2_ = new Float32Array(Ns), dn2_ = new Float32Array(Ns);

                    function ratesS(Vm) {
                        const an = 0.01 * vtrap(Vm + 55.0, 10.0);
                        const bn = 0.125 * Math.exp(-(Vm + 65.0) / 80.0);
                        const am = 0.1 * vtrap(Vm + 40.0, 10.0);
                        const bm = 4.0 * Math.exp(-(Vm + 65.0) / 18.0);
                        const ah = 0.07 * Math.exp(-(Vm + 65.0) / 20.0);
                        const bh = 1.0 / (1.0 + Math.exp(-(Vm + 35.0) / 10.0));
                        return { an, bn, am, bm, ah, bh };
                    }

                    function derivS(Vs, ms, hs, ns) {
                        const ph = phiS();
                        for (let i = 0; i < Ns; i++) {
                            const Vi = Vs[i];
                            const { an, bn, am, bm, ah, bh } = ratesS(Vi);
                            const dmi = ph * (am * (1 - ms[i]) - bm * ms[i]);
                            const dhi = ph * (ah * (1 - hs[i]) - bh * hs[i]);
                            const dni = ph * (an * (1 - ns[i]) - bn * ns[i]);

                            const gNa_t = params.gNa * (ms[i] * ms[i] * ms[i]) * hs[i];
                            const n4 = ns[i] * ns[i] * ns[i] * ns[i];
                            const gK_t = params.gK * n4;
                            const INa = gNa_t * (Vi - params.ENa);
                            const IK = gK_t * (Vi - params.EK);
                            const IL = params.gL * (Vi - params.EL);

                            let Vim1 = (i === 0) ? (cable.bc === "sealed" ? Vs[0] : Vrest) : Vs[i - 1];
                            let Vip1 = (i === Ns - 1) ? (cable.bc === "sealed" ? Vs[Ns - 1] : Vrest) : Vs[i + 1];
                            let Iax = cable.gAx * ((Vim1 - Vi) + (Vip1 - Vi));
                            if (cable.bc === "clamped" && (i === 0 || i === Ns - 1)) {
                                Iax += (cable.gAx * 2.5) * (Vrest - Vi);
                            }

                            const Iion = INa + IK + IL;
                            dV[i] = (IinjS[i] - Iion + Iax) / params.Cm;
                            dm_[i] = dmi; dh_[i] = dhi; dn_[i] = dni;
                        }
                    }

                    function buildIinjSnapshot(I0, center, sigma) {
                        if (sigma <= 0) {
                            IinjS.fill(0);
                            const c = clamp(center | 0, 0, Ns - 1);
                            IinjS[c] = I0;
                            return;
                        }
                        const s2 = sigma * sigma * 2;
                        for (let i = 0; i < Ns; i++) {
                            const d = i - center;
                            IinjS[i] = I0 * Math.exp(-(d * d) / s2);
                        }
                    }

                    const dtMs = snap.engine.dt;
                    const stepsPerSample = Math.max(1, Math.round((1e3 / sampleRate) / dtMs));
                    const controlHop = 64;

                    for (let sample = 0; sample < durationSec * sampleRate; sample += controlHop) {
                        for (let k = 0; k < controlHop; k++) {
                            for (let s = 0; s < stepsPerSample; s++) {
                                // stimulus scalar
                                let I0 = 0;
                                let center = stimCfg.stimIdx;
                                let sigma = stimCfg.stimSigma;

                                if (stimCfg.useDSL && pe.compiled) {
                                    const v = pe.value(tms, dtMs);
                                    I0 = v.I0; center = v.center; sigma = v.sigma;
                                } else {
                                    // manual
                                    I0 = stimCfg.IDC;
                                    if (stimCfg.pulseOn) {
                                        const P = Math.max(1e-6, stimCfg.pulsePeriodMs);
                                        const duty = clamp(stimCfg.pulseDutyPct / 100, 0.01, 0.99);
                                        const w = P * duty;
                                        const x = tms % P;
                                        if (x < w) I0 += stimCfg.pulseAmp;
                                    }
                                    if (stimCfg.sineAmp !== 0) {
                                        const ph = stimCfg.sinePhaseDeg * Math.PI / 180;
                                        I0 += stimCfg.sineAmp * Math.sin(2 * Math.PI * stimCfg.sineFreqHz * (tms * 1e-3) + ph);
                                    }
                                    if (stimCfg.noiseAmp !== 0) {
                                        const white = (Math.random() * 2 - 1) * stimCfg.noiseAmp;
                                        noiseSt = onePoleLP(noiseSt, white, stimCfg.noiseLPHz, dtMs);
                                        I0 += noiseSt;
                                    }
                                }

                                buildIinjSnapshot(I0, center, sigma);

                                // RK2 step (fast & stable)
                                derivS(V0, m0, h0, n0);
                                for (let i = 0; i < Ns; i++) {
                                    Vt_[i] = V0[i] + dtMs * dV[i];
                                    mt_[i] = clamp(m0[i] + dtMs * dm_[i], 0, 1);
                                    ht_[i] = clamp(h0[i] + dtMs * dh_[i], 0, 1);
                                    nt_[i] = clamp(n0[i] + dtMs * dn_[i], 0, 1);
                                }
                                // second slope
                                // reuse arrays
                                const ph = phiS();
                                for (let i = 0; i < Ns; i++) {
                                    const Vi = Vt_[i];
                                    const { an, bn, am, bm, ah, bh } = ratesS(Vi);
                                    const dmi = ph * (am * (1 - mt_[i]) - bm * mt_[i]);
                                    const dhi = ph * (ah * (1 - ht_[i]) - bh * ht_[i]);
                                    const dni = ph * (an * (1 - nt_[i]) - bn * nt_[i]);

                                    const gNa_t = params.gNa * (mt_[i] * mt_[i] * mt_[i]) * ht_[i];
                                    const n4 = nt_[i] * nt_[i] * nt_[i] * nt_[i];
                                    const gK_t = params.gK * n4;
                                    const INa = gNa_t * (Vi - params.ENa);
                                    const IK = gK_t * (Vi - params.EK);
                                    const IL = params.gL * (Vi - params.EL);

                                    let Vim1 = (i === 0) ? (cable.bc === "sealed" ? Vt_[0] : Vrest) : Vt_[i - 1];
                                    let Vip1 = (i === Ns - 1) ? (cable.bc === "sealed" ? Vt_[Ns - 1] : Vrest) : Vt_[i + 1];
                                    let Iax = cable.gAx * ((Vim1 - Vi) + (Vip1 - Vi));
                                    if (cable.bc === "clamped" && (i === 0 || i === Ns - 1)) {
                                        Iax += (cable.gAx * 2.5) * (Vrest - Vi);
                                    }

                                    const Iion = INa + IK + IL;
                                    dV2_[i] = (IinjS[i] - Iion + Iax) / params.Cm;
                                    dm2_[i] = dmi; dh2_[i] = dhi; dn2_[i] = dni;
                                }

                                for (let i = 0; i < Ns; i++) {
                                    V0[i] += dtMs * 0.5 * (dV[i] + dV2_[i]);
                                    m0[i] = clamp(m0[i] + dtMs * 0.5 * (dm_[i] + dm2_[i]), 0, 1);
                                    h0[i] = clamp(h0[i] + dtMs * 0.5 * (dh_[i] + dh2_[i]), 0, 1);
                                    n0[i] = clamp(n0[i] + dtMs * 0.5 * (dn_[i] + dn2_[i]), 0, 1);
                                }

                                // spike detect at probe for click scheduling
                                const Vp = V0[stimCfg.probeIdx];
                                const spiked = (prevVp < snap.engine.thresh && Vp >= snap.engine.thresh);
                                if (spiked) {
                                    const spikeT = (sample + k) / sampleRate;
                                    if ((spikeT - spikeCooldown) > 0.006) {
                                        spikeCooldown = spikeT;
                                        const dur = 0.02;
                                        const len = Math.floor(sampleRate * dur);
                                        const buf = ctx.createBuffer(1, len, sampleRate);
                                        const dd = buf.getChannelData(0);
                                        for (let i = 0; i < len; i++) {
                                            const env = Math.exp(-i / (sampleRate * 0.004));
                                            dd[i] = (Math.random() * 2 - 1) * env;
                                        }
                                        const src = ctx.createBufferSource(); src.buffer = buf;
                                        const g = ctx.createGain();
                                        g.gain.setValueAtTime(0, spikeT);
                                        g.gain.linearRampToValueAtTime(snap.aud.click, spikeT + 0.001);
                                        g.gain.exponentialRampToValueAtTime(1e-4, spikeT + dur);
                                        src.connect(g); g.connect(clickMix);
                                        src.start(spikeT); src.stop(spikeT + dur + 0.01);
                                    }
                                }
                                prevVp = Vp;

                                tms += dtMs;
                            }
                        }

                        // update synth at control rate
                        const iProbe = stimCfg.probeIdx;
                        const Vp = V0[iProbe];
                        const Vn = clamp((Vp + 90) / 140, 0, 1);
                        const pitch = snap.aud.baseHz * Math.pow(2, (Vn - 0.5) * snap.aud.spanOct);
                        const time = sample / sampleRate;

                        // compute probe currents quickly
                        const mi = m0[iProbe], hi = h0[iProbe], ni = n0[iProbe];
                        const gNa_t = params.gNa * (mi * mi * mi) * hi;
                        const n4 = ni * ni * ni * ni;
                        const gK_t = params.gK * n4;
                        const INa = gNa_t * (Vp - params.ENa);
                        const IK = gK_t * (Vp - params.EK);
                        const IL = params.gL * (Vp - params.EL);

                        if (snap.aud.mode === "ionic") {
                            osc.frequency.setValueAtTime(pitch, time);
                            const outward = clamp((IK + IL) / 200, 0, 1);
                            const inward = clamp((-INa) / 400, 0, 1);
                            filter.frequency.setValueAtTime(clamp(lerp(700, 5200, 0.25 + 0.55 * outward + 0.35 * inward), 200, 8000), time);
                            modOsc.frequency.setValueAtTime(2 + 18 * ni, time);
                            modGain.gain.setValueAtTime(40 + 240 * (0.6 * mi + 0.4 * ni), time);
                        } else if (snap.aud.mode === "spike") {
                            osc.frequency.setValueAtTime(snap.aud.baseHz * Math.pow(2, 0.12 * (Vn - 0.5)), time);
                            modGain.gain.setValueAtTime(0, time);
                            filter.frequency.setValueAtTime(snap.aud.lpf, time);
                        } else {
                            osc.frequency.setValueAtTime(pitch, time);
                            modOsc.frequency.setValueAtTime(3 + 22 * ni + 10 * mi, time);
                            modGain.gain.setValueAtTime(50 + 900 * (mi * (1 - hi)) + 500 * ni, time);
                            filter.frequency.setValueAtTime(clamp(lerp(500, 6500, 0.2 + 0.8 * (mi + ni) / 2), 200, 8000), time);
                        }
                    }

                    const rendered = await ctx.startRendering();
                    const wav = encodeWAV(rendered.getChannelData(0), sampleRate);
                    return wav;
                }
            }

            const audio = new AudioEngine();

            // -----------------------------
            // WAV encoding (PCM 16-bit)
            // -----------------------------
            function encodeWAV(float32, sampleRate) {
                const numSamples = float32.length;
                const buffer = new ArrayBuffer(44 + numSamples * 2);
                const view = new DataView(buffer);

                function writeString(off, s) { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); }

                writeString(0, "RIFF");
                view.setUint32(4, 36 + numSamples * 2, true);
                writeString(8, "WAVE");
                writeString(12, "fmt ");
                view.setUint32(16, 16, true);
                view.setUint16(20, 1, true);
                view.setUint16(22, 1, true);
                view.setUint32(24, sampleRate, true);
                view.setUint32(28, sampleRate * 2, true);
                view.setUint16(32, 2, true);
                view.setUint16(34, 16, true);
                writeString(36, "data");
                view.setUint32(40, numSamples * 2, true);

                let off = 44;
                for (let i = 0; i < numSamples; i++) {
                    let x = clamp(float32[i], -1, 1);
                    const s = x < 0 ? x * 0x8000 : x * 0x7FFF;
                    view.setInt16(off, s, true);
                    off += 2;
                }
                return new Blob([buffer], { type: "audio/wav" });
            }

            function downloadBlob(blob, filename) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1500);
            }

            // -----------------------------
            // Recording (CSV)
            // -----------------------------
            class Recorder {
                constructor() {
                    this.rows = [];
                    this.lastT = -1e9;
                }
                clear() {
                    this.rows = [];
                    this.lastT = -1e9;
                }
                push(tms, Vprobe, I0, rateHz, vel, checkpoints) {
                    if (!recOn) return;
                    if ((tms - this.lastT) < recEveryMs) return;
                    this.lastT = tms;

                    const velStr = (vel == null) ? "" : vel.toFixed(4);
                    const parts = [
                        tms.toFixed(3),
                        Vprobe.toFixed(4),
                        I0.toFixed(4),
                        rateHz.toFixed(4),
                        velStr
                    ];
                    for (const v of checkpoints) parts.push(v.toFixed(4));
                    this.rows.push(parts.join(","));
                }
                exportCSV() {
                    const header = [
                        "t_ms", "V_probe_mV", "I0_uAcm2", "rate_Hz", "vel_mps",
                        "V_x0", "V_x25", "V_x50", "V_x75", "V_x100"
                    ].join(",");
                    const csv = header + "\n" + this.rows.join("\n");
                    return new Blob([csv], { type: "text/csv" });
                }
            }
            const recorder = new Recorder();

            // -----------------------------
            // UI helpers
            // -----------------------------
            function setDot(dot, state) {
                dot.classList.remove("ok", "warn", "bad");
                if (state === "ok") dot.classList.add("ok");
                else if (state === "warn") dot.classList.add("warn");
                else if (state === "bad") dot.classList.add("bad");
            }

            function bindRange(id, valId, fmt, onChange) {
                const rng = $(id);
                const val = $(valId);
                const update = () => {
                    const x = parseFloat(rng.value);
                    val.textContent = fmt(x);
                    onChange(x);
                };
                rng.addEventListener("input", update);
                update();
            }

            function updateSimUI() {
                if (running) {
                    setDot($("dotSim"), "ok");
                    $("simState").textContent = "running";
                    $("btnRun").textContent = "Pause";
                } else {
                    setDot($("dotSim"), "warn");
                    $("simState").textContent = "paused";
                    $("btnRun").textContent = "Run";
                }
            }

            function updateAudioUI() {
                if (audio.ctx && audio.enabled) {
                    setDot($("dotAudio"), "ok");
                    $("audState").textContent = "on";
                    $("btnAudio").textContent = "Disable Audio";
                } else {
                    setDot($("dotAudio"), "warn");
                    $("audState").textContent = "locked";
                    $("btnAudio").textContent = "Enable Audio";
                }
            }

            function updateProtoUI() {
                const badge = $("badgeProto");
                const badgeTop = $("badgeProto");
                const protoState = $("protoState");
                if (useDSL) {
                    if (proto.compiled) {
                        setDot($("dotProto"), "ok");
                        protoState.textContent = "compiled";
                        badge.textContent = `proto: compiled (${proto.segs.length} blocks)`;
                    } else if (proto.err) {
                        setDot($("dotProto"), "bad");
                        protoState.textContent = "error";
                        badge.textContent = `proto: ERROR`;
                    } else {
                        setDot($("dotProto"), "warn");
                        protoState.textContent = "idle";
                        badge.textContent = "proto: idle";
                    }
                } else {
                    setDot($("dotProto"), "warn");
                    protoState.textContent = "manual";
                    badge.textContent = "proto: manual";
                }
                $("badgeProto").textContent = badge.textContent;
                $("badgeProto").title = proto.err ? proto.err : "";
            }

            function refreshJSONBox() {
                $("txtJSON").value = JSON.stringify(exportState(), null, 2);
            }

            // -----------------------------
            // Presets for manual stim
            // -----------------------------
            function setManualPreset(name) {
                if (name === "none") {
                    IDC = 0; pulseAmp = 0; pulseOn = false; sineAmp = 0; noiseAmp = 0;
                } else if (name === "excite") {
                    IDC = 8.0; pulseAmp = 2.0; pulseOn = true; pulsePeriodMs = 20; pulseDutyPct = 5;
                    sineAmp = 0.5; sineFreqHz = 6; sinePhaseDeg = 0;
                    noiseAmp = 0.2; noiseLPHz = 40;
                } else if (name === "burst") {
                    IDC = 6.0; pulseAmp = 18.0; pulseOn = true; pulsePeriodMs = 40; pulseDutyPct = 10;
                    sineAmp = 6.0; sineFreqHz = 1.2; sinePhaseDeg = 0;
                    noiseAmp = 0.5; noiseLPHz = 25;
                }
                syncManualStimUI();
            }

            function syncManualStimUI() {
                const setR = (id, val) => { const r = $(id); r.value = String(val); r.dispatchEvent(new Event("input")); };
                setR("rngIDC", IDC);
                setR("rngIPulse", pulseAmp);
                setR("rngPP", pulsePeriodMs);
                setR("rngPD", pulseDutyPct);
                $("selPulseOn").value = pulseOn ? "on" : "off";
                $("selPulseOn").dispatchEvent(new Event("change"));
                setR("rngISine", sineAmp);
                setR("rngFSine", sineFreqHz);
                setR("rngPSine", sinePhaseDeg);
                setR("rngINoise", noiseAmp);
                setR("rngNoiseLP", noiseLPHz);
            }

            // -----------------------------
            // Export / Import preset JSON
            // -----------------------------
            function exportState() {
                return {
                    version: 2,
                    engine: { integrator, dt, stepsPerFrame, windowMs, thresh },
                    cable: { N, gAx, dx_um, bc },
                    hh: { Cm, gNa, gK, gL, ENa, EK, EL, T, Q10, Tref },
                    stim: {
                        stimIdx, stimSigma, probeIdx, velOn,
                        // manual
                        IDC, pulseAmp, pulsePeriodMs, pulseDutyPct, pulseOn,
                        sineAmp, sineFreqHz, sinePhaseDeg,
                        noiseAmp, noiseLPHz,
                        useDSL, loopProto
                    },
                    proto: { compiled: proto.compiled, text: $("txtDSL").value || "" },
                    autopilot: { autoMode, targetHz, rateWinMs, Kp, Ki, Kd, ctlMax },
                    aud: { mode: audMode, gain: audGain, baseHz: audBaseHz, spanOct: audSpanOct, click: audClick, lpf: audLPF, drive: audDrive },
                    state: {
                        t_ms,
                        V: Array.from(V),
                        m: Array.from(m),
                        h: Array.from(h),
                        n: Array.from(n)
                    }
                };
            }

            function applyState(st) {
                if (!st || typeof st !== "object") throw new Error("Invalid preset.");

                integrator = st.engine?.integrator ?? integrator;
                dt = st.engine?.dt ?? dt;
                stepsPerFrame = st.engine?.stepsPerFrame ?? stepsPerFrame;
                windowMs = st.engine?.windowMs ?? windowMs;
                thresh = st.engine?.thresh ?? thresh;

                N = st.cable?.N ?? N;
                gAx = st.cable?.gAx ?? gAx;
                dx_um = st.cable?.dx_um ?? dx_um;
                bc = st.cable?.bc ?? bc;

                Cm = st.hh?.Cm ?? Cm;
                gNa = st.hh?.gNa ?? gNa;
                gK = st.hh?.gK ?? gK;
                gL = st.hh?.gL ?? gL;
                ENa = st.hh?.ENa ?? ENa;
                EK = st.hh?.EK ?? EK;
                EL = st.hh?.EL ?? EL;
                T = st.hh?.T ?? T;
                Q10 = st.hh?.Q10 ?? Q10;

                stimIdx = st.stim?.stimIdx ?? stimIdx;
                stimSigma = st.stim?.stimSigma ?? stimSigma;
                probeIdx = st.stim?.probeIdx ?? probeIdx;
                velOn = st.stim?.velOn ?? velOn;

                IDC = st.stim?.IDC ?? IDC;
                pulseAmp = st.stim?.pulseAmp ?? pulseAmp;
                pulsePeriodMs = st.stim?.pulsePeriodMs ?? pulsePeriodMs;
                pulseDutyPct = st.stim?.pulseDutyPct ?? pulseDutyPct;
                pulseOn = st.stim?.pulseOn ?? pulseOn;

                sineAmp = st.stim?.sineAmp ?? sineAmp;
                sineFreqHz = st.stim?.sineFreqHz ?? sineFreqHz;
                sinePhaseDeg = st.stim?.sinePhaseDeg ?? sinePhaseDeg;

                noiseAmp = st.stim?.noiseAmp ?? noiseAmp;
                noiseLPHz = st.stim?.noiseLPHz ?? noiseLPHz;

                useDSL = st.stim?.useDSL ?? useDSL;
                loopProto = st.stim?.loopProto ?? loopProto;

                autoMode = st.autopilot?.autoMode ?? autoMode;
                targetHz = st.autopilot?.targetHz ?? targetHz;
                rateWinMs = st.autopilot?.rateWinMs ?? rateWinMs;
                Kp = st.autopilot?.Kp ?? Kp;
                Ki = st.autopilot?.Ki ?? Ki;
                Kd = st.autopilot?.Kd ?? Kd;
                ctlMax = st.autopilot?.ctlMax ?? ctlMax;

                audMode = st.aud?.mode ?? audMode;
                audGain = st.aud?.gain ?? audGain;
                audBaseHz = st.aud?.baseHz ?? audBaseHz;
                audSpanOct = st.aud?.spanOct ?? audSpanOct;
                audClick = st.aud?.click ?? audClick;
                audLPF = st.aud?.lpf ?? audLPF;
                audDrive = st.aud?.drive ?? audDrive;

                // allocate arrays with new N
                allocArrays();

                // load state vectors if present
                if (st.state?.V && st.state.V.length === N) {
                    t_ms = st.state.t_ms ?? 0;
                    for (let i = 0; i < N; i++) {
                        V[i] = st.state.V[i];
                        m[i] = st.state.m[i];
                        h[i] = st.state.h[i];
                        n[i] = st.state.n[i];
                    }
                } else {
                    resetCable();
                    return;
                }

                // UI sync
                $("selIntegrator").value = integrator; $("selIntegrator").dispatchEvent(new Event("change"));
                $("rngDt").value = dt; $("rngDt").dispatchEvent(new Event("input"));
                $("rngSteps").value = stepsPerFrame; $("rngSteps").dispatchEvent(new Event("input"));
                $("rngWindow").value = windowMs; $("rngWindow").dispatchEvent(new Event("input"));

                $("rngN").value = N; $("rngN").dispatchEvent(new Event("input"));
                $("rngGAx").value = gAx; $("rngGAx").dispatchEvent(new Event("input"));
                $("rngDx").value = dx_um; $("rngDx").dispatchEvent(new Event("input"));
                $("selBC").value = bc; $("selBC").dispatchEvent(new Event("change"));

                $("rngGNa").value = gNa; $("rngGNa").dispatchEvent(new Event("input"));
                $("rngGK").value = gK; $("rngGK").dispatchEvent(new Event("input"));
                $("rngGL").value = gL; $("rngGL").dispatchEvent(new Event("input"));
                $("rngENa").value = ENa; $("rngENa").dispatchEvent(new Event("input"));
                $("rngEK").value = EK; $("rngEK").dispatchEvent(new Event("input"));
                $("rngEL").value = EL; $("rngEL").dispatchEvent(new Event("input"));
                $("rngCm").value = Cm; $("rngCm").dispatchEvent(new Event("input"));
                $("rngThresh").value = thresh; $("rngThresh").dispatchEvent(new Event("input"));

                $("rngTemp").value = T; $("rngTemp").dispatchEvent(new Event("input"));
                $("rngQ10").value = Q10; $("rngQ10").dispatchEvent(new Event("input"));

                $("rngStimIdx").value = stimIdx; $("rngStimIdx").dispatchEvent(new Event("input"));
                $("rngStimSigma").value = stimSigma; $("rngStimSigma").dispatchEvent(new Event("input"));
                $("rngProbeIdx").value = probeIdx; $("rngProbeIdx").dispatchEvent(new Event("input"));
                $("selVelOn").value = velOn ? "on" : "off"; $("selVelOn").dispatchEvent(new Event("change"));

                syncManualStimUI();

                $("selUseDSL").value = useDSL ? "on" : "off"; $("selUseDSL").dispatchEvent(new Event("change"));
                $("selLoopProto").value = loopProto ? "on" : "off"; $("selLoopProto").dispatchEvent(new Event("change"));

                $("selAuto").value = autoMode; $("selAuto").dispatchEvent(new Event("change"));
                $("rngTargetHz").value = targetHz; $("rngTargetHz").dispatchEvent(new Event("input"));
                $("rngRateWin").value = rateWinMs; $("rngRateWin").dispatchEvent(new Event("input"));
                $("rngKp").value = Kp; $("rngKp").dispatchEvent(new Event("input"));
                $("rngKi").value = Ki; $("rngKi").dispatchEvent(new Event("input"));
                $("rngKd").value = Kd; $("rngKd").dispatchEvent(new Event("input"));
                $("rngCtlMax").value = ctlMax; $("rngCtlMax").dispatchEvent(new Event("input"));

                $("selAudMode").value = audMode; $("selAudMode").dispatchEvent(new Event("change"));
                $("rngGain").value = audGain; $("rngGain").dispatchEvent(new Event("input"));
                $("rngBaseHz").value = audBaseHz; $("rngBaseHz").dispatchEvent(new Event("input"));
                $("rngSpan").value = audSpanOct; $("rngSpan").dispatchEvent(new Event("input"));
                $("rngClick").value = audClick; $("rngClick").dispatchEvent(new Event("input"));
                $("rngLPF").value = audLPF; $("rngLPF").dispatchEvent(new Event("input"));
                $("rngDrive").value = audDrive; $("rngDrive").dispatchEvent(new Event("input"));

                // Protocol text
                if (st.proto?.text != null) {
                    $("txtDSL").value = st.proto.text;
                    if (useDSL) {
                        try {
                            proto.compile(st.proto.text);
                            proto.err = null;
                        } catch (e) {
                            proto.compiled = false;
                            proto.err = e.message || String(e);
                        }
                    }
                }

                // reset dependent trackers
                prevVprobe = V[probeIdx];
                spikeTimes = [];
                pidReset();
                updateProtoUI();
                refreshJSONBox();
            }

            // -----------------------------
            // DSL example
            // -----------------------------
            const DSL_EXAMPLE =
                `# NeuroProtocol example: layered excitability + propagation
block 300ms dc 0
block 700ms dc 8 at 8 spread 0
block 800ms pulse amp 18 period 20 duty 5 at 8 spread 0
block 1200ms ramp from 0 to 12 at 8 spread 2
block 1500ms chirp amp 3 f0 2 f1 30 at 8 spread 1.5
block 800ms noise amp 0.6 lp 40 at 8 spread 2
block 500ms off
`;

            // -----------------------------
            // Wire UI
            // -----------------------------
            // Run/reset/panic
            $("btnRun").addEventListener("click", () => { running = !running; updateSimUI(); });
            $("btnReset").addEventListener("click", () => resetCable());
            $("btnPanic").addEventListener("click", () => { running = false; updateSimUI(); audio.disable(); updateAudioUI(); });

            // Integrator
            $("selIntegrator").addEventListener("change", (e) => {
                integrator = e.target.value;
                $("valIntegrator").textContent = (integrator === "rk4" ? "RK4" : integrator === "euler" ? "Euler" : "RK2 (Heun)");
            });

            bindRange("rngDt", "valDt", x => x.toFixed(3), x => { dt = x; allocArrays(); });
            bindRange("rngSteps", "valSteps", x => String(x | 0), x => { stepsPerFrame = x | 0; });
            bindRange("rngWindow", "valWindow", x => String(x | 0), x => { windowMs = x; allocArrays(); });

            // Cable
            bindRange("rngN", "valN", x => String(x | 0), x => {
                N = x | 0;
                allocArrays();
                resetCable();
            });
            bindRange("rngGAx", "valGAx", x => x.toFixed(2), x => { gAx = x; });
            bindRange("rngDx", "valDx", x => String(x | 0), x => { dx_um = x | 0; });
            $("selBC").addEventListener("change", (e) => {
                bc = e.target.value;
                $("valBC").textContent = (bc === "sealed" ? "Sealed" : "Clamped");
            });

            // HH params
            bindRange("rngGNa", "valGNa", x => x.toFixed(1), x => { gNa = x; });
            bindRange("rngGK", "valGK", x => x.toFixed(1), x => { gK = x; });
            bindRange("rngGL", "valGL", x => x.toFixed(2), x => { gL = x; });
            bindRange("rngENa", "valENa", x => x.toFixed(1), x => { ENa = x; });
            bindRange("rngEK", "valEK", x => x.toFixed(1), x => { EK = x; });
            bindRange("rngEL", "valEL", x => x.toFixed(1), x => { EL = x; });
            bindRange("rngCm", "valCm", x => x.toFixed(2), x => { Cm = x; });
            bindRange("rngThresh", "valThresh", x => String(x | 0), x => { thresh = x; });

            bindRange("rngTemp", "valTemp", x => x.toFixed(1), x => { T = x; });
            bindRange("rngQ10", "valQ10", x => x.toFixed(2), x => { Q10 = x; });

            // Targeting
            bindRange("rngStimIdx", "valStimIdx", x => String(x | 0), x => { stimIdx = x | 0; });
            bindRange("rngStimSigma", "valStimSigma", x => x.toFixed(1), x => { stimSigma = x; });
            bindRange("rngProbeIdx", "valProbeIdx", x => String(x | 0), x => { probeIdx = x | 0; prevVprobe = V ? V[probeIdx] : Vrest; });
            $("selVelOn").addEventListener("change", (e) => {
                velOn = (e.target.value === "on");
                $("valVelOn").textContent = velOn ? "ON" : "OFF";
            });

            // Manual stim
            bindRange("rngIDC", "valIDC", x => x.toFixed(2), x => { IDC = x; });
            bindRange("rngIPulse", "valIPulse", x => x.toFixed(2), x => { pulseAmp = x; });
            bindRange("rngPP", "valPP", x => x.toFixed(1), x => { pulsePeriodMs = x; });
            bindRange("rngPD", "valPD", x => String(x | 0), x => { pulseDutyPct = x | 0; });
            $("selPulseOn").addEventListener("change", (e) => {
                pulseOn = (e.target.value === "on");
                $("valPulseOn").textContent = pulseOn ? "ON" : "OFF";
            });

            bindRange("rngISine", "valISine", x => x.toFixed(2), x => { sineAmp = x; });
            bindRange("rngFSine", "valFSine", x => x.toFixed(1), x => { sineFreqHz = x; });
            bindRange("rngPSine", "valPSine", x => String(x | 0), x => { sinePhaseDeg = x | 0; });

            bindRange("rngINoise", "valINoise", x => x.toFixed(2), x => { noiseAmp = x; });
            bindRange("rngNoiseLP", "valNoiseLP", x => String(x | 0), x => { noiseLPHz = x | 0; });

            $("btnStimNone").addEventListener("click", () => setManualPreset("none"));
            $("btnStimExcite").addEventListener("click", () => setManualPreset("excite"));
            $("btnStimBurst").addEventListener("click", () => setManualPreset("burst"));

            // DSL
            $("selUseDSL").addEventListener("change", (e) => {
                useDSL = (e.target.value === "on");
                $("valUseDSL").textContent = useDSL ? "ON" : "OFF";
                updateProtoUI();
            });
            $("selLoopProto").addEventListener("change", (e) => {
                loopProto = (e.target.value === "on");
                $("valLoopProto").textContent = loopProto ? "ON" : "OFF";
            });

            $("btnDSLExample").addEventListener("click", () => {
                $("txtDSL").value = DSL_EXAMPLE;
            });
            $("btnDSLClear").addEventListener("click", () => {
                $("txtDSL").value = "";
                proto.compiled = false; proto.err = null;
                updateProtoUI();
            });
            $("btnDSLCompile").addEventListener("click", () => {
                try {
                    proto.compile($("txtDSL").value || "");
                    proto.err = null;
                    updateProtoUI();
                    alert(`Compiled OK: ${proto.segs.length} blocks, total ${proto.totalMs.toFixed(1)} ms`);
                } catch (e) {
                    proto.compiled = false;
                    proto.err = e.message || String(e);
                    updateProtoUI();
                    alert("Compile failed: " + proto.err);
                }
            });

            // Autopilot
            $("selAuto").addEventListener("change", (e) => {
                autoMode = e.target.value;
                $("valAuto").textContent = autoMode.toUpperCase();
                pidReset();
            });
            bindRange("rngTargetHz", "valTargetHz", x => x.toFixed(1), x => { targetHz = x; });
            bindRange("rngRateWin", "valRateWin", x => String(x | 0), x => { rateWinMs = x | 0; });
            bindRange("rngKp", "valKp", x => x.toFixed(2), x => { Kp = x; });
            bindRange("rngKi", "valKi", x => x.toFixed(2), x => { Ki = x; });
            bindRange("rngKd", "valKd", x => x.toFixed(2), x => { Kd = x; });
            bindRange("rngCtlMax", "valCtlMax", x => x.toFixed(1), x => { ctlMax = x; });

            // Audio
            $("btnAudio").addEventListener("click", async () => {
                if (audio.ctx && audio.enabled) {
                    audio.disable();
                    updateAudioUI();
                    return;
                }
                const ok = await audio.enable();
                if (!ok) { alert("Web Audio not available."); return; }
                audio.setParams();
                updateAudioUI();
            });

            $("selAudMode").addEventListener("change", (e) => {
                audMode = e.target.value;
                $("valAudMode").textContent = audMode.toUpperCase();
                audio.setParams();
            });
            bindRange("rngGain", "valGain", x => x.toFixed(2), x => { audGain = x; audio.setParams(); });
            bindRange("rngBaseHz", "valBaseHz", x => String(x | 0), x => { audBaseHz = x | 0; });
            bindRange("rngSpan", "valSpan", x => x.toFixed(2), x => { audSpanOct = x; });
            bindRange("rngClick", "valClick", x => x.toFixed(2), x => { audClick = x; });
            bindRange("rngLPF", "valLPF", x => String(x | 0), x => { audLPF = x | 0; audio.setParams(); });
            bindRange("rngDrive", "valDrive", x => x.toFixed(3), x => { audDrive = x; audio.setParams(); });

            $("btnMute").addEventListener("click", () => {
                audGain = 0;
                $("rngGain").value = "0";
                $("rngGain").dispatchEvent(new Event("input"));
            });

            $("btnRenderWav").addEventListener("click", async () => {
                try {
                    const snap = exportState();
                    const blob = await audio.renderWav10s(JSON.stringify(snap));
                    downloadBlob(blob, `neuropulse_cable_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.wav`);
                } catch (err) {
                    alert("WAV render failed: " + (err?.message || String(err)));
                }
            });

            // Recording
            $("selRec").addEventListener("change", (e) => {
                recOn = (e.target.value === "on");
                $("valRec").textContent = recOn ? "ON" : "OFF";
            });
            bindRange("rngRecEvery", "valRecEvery", x => x.toFixed(1), x => { recEveryMs = x; });

            $("btnRecClear").addEventListener("click", () => {
                recorder.clear();
                alert("Cleared recorded data.");
            });
            $("btnCSVExport").addEventListener("click", () => {
                if (recorder.rows.length === 0) {
                    alert("No data recorded. Turn Recording ON, run, then export.");
                    return;
                }
                const blob = recorder.exportCSV();
                downloadBlob(blob, `cablelab_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`);
            });

            // Preset JSON box
            $("btnCopy").addEventListener("click", async () => {
                try { await navigator.clipboard.writeText($("txtJSON").value); }
                catch (e) { $("txtJSON").select(); document.execCommand("copy"); }
            });
            $("btnPaste").addEventListener("click", async () => {
                try { $("txtJSON").value = await navigator.clipboard.readText(); }
                catch (e) { alert("Clipboard read blocked. Paste manually."); }
            });
            $("btnApply").addEventListener("click", () => {
                try { applyState(JSON.parse($("txtJSON").value)); }
                catch (e) { alert("Apply failed: " + (e?.message || String(e))); }
            });
            $("btnStore").addEventListener("click", () => {
                try { localStorage.setItem("cablelab_preset", $("txtJSON").value); alert("Saved to localStorage (cablelab_preset)."); }
                catch (e) { alert("Save failed: " + (e?.message || String(e))); }
            });

            $("btnExportPreset").addEventListener("click", () => {
                refreshJSONBox();
                const blob = new Blob([$("txtJSON").value], { type: "application/json" });
                downloadBlob(blob, `cablelab_preset_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`);
            });
            $("btnImportPreset").addEventListener("click", () => {
                const choice = confirm("OK = import from JSON box. Cancel = import from file.");
                if (choice) {
                    try { applyState(JSON.parse($("txtJSON").value)); }
                    catch (e) { alert("Import failed: " + (e?.message || String(e))); }
                    return;
                }
                const inp = document.createElement("input");
                inp.type = "file";
                inp.accept = ".json,application/json";
                inp.onchange = async () => {
                    const f = inp.files?.[0];
                    if (!f) return;
                    const txt = await f.text();
                    $("txtJSON").value = txt;
                    try { applyState(JSON.parse(txt)); }
                    catch (e) { alert("File import failed: " + (e?.message || String(e))); }
                };
                inp.click();
            });

            // Tabs
            let view = "prop";
            document.querySelectorAll(".tab").forEach(tab => {
                tab.addEventListener("click", () => {
                    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
                    tab.classList.add("active");
                    view = tab.dataset.view;
                });
            });

            // Keyboard shortcuts
            window.addEventListener("keydown", (e) => {
                if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT")) return;
                if (e.code === "Space") { e.preventDefault(); running = !running; updateSimUI(); }
                else if (e.key.toLowerCase() === "r") { resetCable(); }
                else if (e.key.toLowerCase() === "p") { running = false; updateSimUI(); audio.disable(); updateAudioUI(); }
                else if (e.key.toLowerCase() === "a") { $("btnAudio").click(); }
                else if (e.key.toLowerCase() === "c") { $("btnDSLCompile").click(); }
            });

            // -----------------------------
            // Simulation loop
            // -----------------------------
            function simStep() {
                let I0 = 0, protoT = 0, segIndex = 0;

                for (let k = 0; k < stepsPerFrame; k++) {
                    // stimulus scalar + targeting
                    let center = stimIdx;
                    let sigma = stimSigma;

                    if (useDSL && proto.compiled) {
                        const v = proto.value(t_ms, dt);
                        I0 = v.I0; center = v.center; sigma = v.sigma; protoT = v.protoT; segIndex = v.segIndex;
                    } else {
                        I0 = manualI0(t_ms, dt);
                        protoT = t_ms; segIndex = 0;
                    }

                    buildIinj(I0, center, sigma);

                    // integrate one dt
                    applyIntegratorStep();

                    // probe spike detection
                    const Vp = V[probeIdx];
                    if (prevVprobe < thresh && Vp >= thresh) {
                        spikeTimes.push(t_ms);
                    }
                    prevVprobe = Vp;

                    // velocity
                    updateVelocity();

                    // advance time
                    t_ms += dt;

                    // kymograph: push one pixel column per dt-step (cheap)
                    kymoPushColumn();

                    // record downsampled
                    const rateHz = computeRateHz(t_ms);
                    const checkpoints = [
                        V[0],
                        V[Math.floor((N - 1) * 0.25)],
                        V[Math.floor((N - 1) * 0.50)],
                        V[Math.floor((N - 1) * 0.75)],
                        V[N - 1]
                    ];
                    recorder.push(t_ms, Vp, I0, rateHz, lastVel_mps, checkpoints);
                }

                const rateHz = computeRateHz(t_ms);
                // autopilot adjusts manual control variables only (even if DSL on, that’s intentional)
                pidUpdate(t_ms, rateHz);

                // plot rings
                rbVt.push(V[probeIdx]);
                rbI0.push(I0);
                rbRate.push(rateHz);

                // update UI
                $("badgeRate").textContent = `rate: ${rateHz.toFixed(1)} Hz`;
                $("badgePhi").textContent = `phi: ${phi().toFixed(2)}`;

                const velStr = (lastVel_mps == null) ? "vel: —" : `vel: ${lastVel_mps.toFixed(2)} m/s`;
                $("badgeVel").textContent = velStr;

                if (useDSL) {
                    if (proto.compiled) {
                        $("badgeProto").textContent = `proto: block ${segIndex + 1}/${proto.segs.length}`;
                        $("badgeProto").title = `t=${protoT.toFixed(1)} ms of total ${proto.totalMs.toFixed(1)} ms`;
                        $("badgeProto").textContent = $("badgeProto").textContent;
                        $("badgeProto").textContent = $("badgeProto").textContent;
                    } else if (proto.err) {
                        $("badgeProto").textContent = "proto: ERROR";
                    } else {
                        $("badgeProto").textContent = "proto: idle";
                    }
                } else {
                    $("badgeProto").textContent = "proto: manual";
                }
                $("badgeProto").textContent = $("badgeProto").textContent;

                // probe readouts
                const Vp = V[probeIdx];
                const { INa, IK, IL } = computeProbeCurrents(probeIdx);

                $("rdV").textContent = Vp.toFixed(2);
                $("rdMHN").textContent = `${m[probeIdx].toFixed(3)} / ${h[probeIdx].toFixed(3)} / ${n[probeIdx].toFixed(3)}`;
                $("rdI").textContent = `${INa.toFixed(2)} / ${IK.toFixed(2)} / ${IL.toFixed(2)}`;

                const protoTimeShow = useDSL && proto.compiled ? proto.value(t_ms, dt).protoT : t_ms;
                $("rdStim").textContent = `${I0.toFixed(2)} / ${protoTimeShow.toFixed(1)} ms`;

                // audio mapping from probe
                const spiked = (spikeTimes.length > 0 && Math.abs(spikeTimes[spikeTimes.length - 1] - (t_ms - dt)) < 1e-6);
                audio.updateFromProbe({ V: Vp, m: m[probeIdx], h: h[probeIdx], n: n[probeIdx], INa, IK, IL }, spiked);

                return { rateHz, I0 };
            }

            // -----------------------------
            // Rendering (trace, space, probe panel)
            // -----------------------------
            function render() {
                fitCanvas(cvVt); fitCanvas(cvVx); fitCanvas(cvProbe);

                // Trace V(t)
                const wT = cvVt.width, hT = cvVt.height;
                drawGrid(ctxT, wT, hT);
                drawLineSeries(ctxT, wT, hT, rbVt, -90, 60, "rgba(122,166,255,0.95)", 2);

                // threshold line
                ctxT.save();
                ctxT.strokeStyle = "rgba(255,214,110,0.18)";
                ctxT.lineWidth = 1.5;
                const yt = (1 - clamp((thresh + 90) / 150, 0, 1)) * (hT - 1); // approximate mapping
                ctxT.beginPath(); ctxT.moveTo(0, yt); ctxT.lineTo(wT, yt); ctxT.stroke();
                ctxT.restore();

                drawText(ctxT, wT, hT, [
                    `probe=${probeIdx}  stim=${stimIdx}  σ=${stimSigma.toFixed(1)}`,
                    `V=${V[probeIdx].toFixed(2)} mV`
                ]);

                // Spatial V(x)
                const wX = cvVx.width, hX = cvVx.height;
                drawGrid(ctxX, wX, hX);

                ctxX.save();
                ctxX.strokeStyle = "rgba(116,246,198,0.90)";
                ctxX.lineWidth = 2;
                ctxX.globalAlpha = 0.95;
                ctxX.beginPath();
                for (let i = 0; i < N; i++) {
                    const x = (i / (N - 1)) * (wX - 1);
                    const t = (V[i] + 90) / 150; // -90..60
                    const y = (1 - clamp(t, 0, 1)) * (hX - 1);
                    if (i === 0) ctxX.moveTo(x, y); else ctxX.lineTo(x, y);
                }
                ctxX.stroke();

                // markers: stim/probe
                const xsStim = (stimIdx / (N - 1)) * (wX - 1);
                const xsProbe = (probeIdx / (N - 1)) * (wX - 1);

                ctxX.fillStyle = "rgba(116,246,198,0.95)";
                ctxX.beginPath(); ctxX.arc(xsStim, 18, 4, 0, Math.PI * 2); ctxX.fill();

                ctxX.fillStyle = "rgba(255,214,110,0.95)";
                ctxX.beginPath(); ctxX.arc(xsProbe, 18, 4, 0, Math.PI * 2); ctxX.fill();

                ctxX.restore();

                drawText(ctxX, wX, hX, [
                    `V(x) snapshot`,
                    `gAx=${gAx.toFixed(2)}  bc=${bc}`
                ]);

                // Probe panel: overlay currents & gates (simple stacked trace)
                const wP = cvProbe.width, hP = cvProbe.height;
                drawGrid(ctxP, wP, hP);

                // Build a mini plot from most recent values (not a full history to keep it light):
                // Render gauges at top as bars, plus recent I0 and rate from rings as short series
                const { INa, IK, IL } = computeProbeCurrents(probeIdx);
                const mi = m[probeIdx], hi = h[probeIdx], ni = n[probeIdx];
                const rate = rbRate.length() > 0 ? (() => {
                    let last = 0; rbRate.forEach((v) => last = v); return last;
                })() : 0;

                // bars
                const bar = (y, label, value, vmin, vmax, color) => {
                    const x0 = 12, x1 = wP - 12;
                    const t = clamp((value - vmin) / (vmax - vmin), 0, 1);
                    const w = (x1 - x0) * t;

                    ctxP.fillStyle = "rgba(255,255,255,0.05)";
                    ctxP.fillRect(x0, y, x1 - x0, 10);
                    ctxP.fillStyle = color;
                    ctxP.fillRect(x0, y, w, 10);
                    ctxP.fillStyle = "rgba(234,240,255,0.85)";
                    ctxP.font = `12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace`;
                    ctxP.fillText(`${label} ${value.toFixed(3)}`, x0, y - 14);
                };

                ctxP.save();
                bar(38, "m", mi, 0, 1, "rgba(192,123,255,0.75)");
                bar(74, "h", hi, 0, 1, "rgba(122,166,255,0.75)");
                bar(110, "n", ni, 0, 1, "rgba(116,246,198,0.75)");

                // currents magnitude bars (use absolute scale)
                bar(160, "INa", INa, -400, 400, "rgba(192,123,255,0.55)");
                bar(196, "IK", IK, -400, 400, "rgba(255,214,110,0.55)");
                bar(232, "IL", IL, -100, 100, "rgba(169,183,227,0.45)");

                ctxP.fillStyle = "rgba(234,240,255,0.85)";
                ctxP.fillText(`rate ${rate.toFixed(2)} Hz`, 12, 270);
                ctxP.fillText(`phi ${phi().toFixed(2)} @ T=${T.toFixed(1)}°C`, 12, 286);
                ctxP.restore();

                // View selection: simple fade emphasis (no DOM rearrangement)
                const cards = document.querySelectorAll(".card");
                cards.forEach((c) => c.style.opacity = "1");
                // no-op currently; you can extend by hiding cards per view if you want.
            }

            // ==========================================================
            // INNOVATIONS v2: Scientific Colormaps
            // ==========================================================
            const COLORMAPS = {
                neural: (t) => {
                    const c0 = [20, 40, 120], c1 = [130, 80, 210], c2 = [240, 90, 90];
                    let r, g, b;
                    if (t < 0.55) { const u = t / 0.55; r = lerp(c0[0], c1[0], u); g = lerp(c0[1], c1[1], u); b = lerp(c0[2], c1[2], u); }
                    else { const u = (t - 0.55) / 0.45; r = lerp(c1[0], c2[0], u); g = lerp(c1[1], c2[1], u); b = lerp(c1[2], c2[2], u); }
                    return [r | 0, g | 0, b | 0];
                },
                viridis: (t) => {
                    const c = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];
                    const s = t * (c.length - 1), i = Math.min(c.length - 2, s | 0), f = s - i;
                    return [lerp(c[i][0], c[i + 1][0], f) | 0, lerp(c[i][1], c[i + 1][1], f) | 0, lerp(c[i][2], c[i + 1][2], f) | 0];
                },
                magma: (t) => {
                    const c = [[0, 0, 4], [80, 18, 123], [183, 55, 121], [254, 136, 85], [252, 253, 191]];
                    const s = t * (c.length - 1), i = Math.min(c.length - 2, s | 0), f = s - i;
                    return [lerp(c[i][0], c[i + 1][0], f) | 0, lerp(c[i][1], c[i + 1][1], f) | 0, lerp(c[i][2], c[i + 1][2], f) | 0];
                },
                inferno: (t) => {
                    const c = [[0, 0, 4], [87, 16, 110], [188, 55, 84], [249, 142, 9], [252, 255, 164]];
                    const s = t * (c.length - 1), i = Math.min(c.length - 2, s | 0), f = s - i;
                    return [lerp(c[i][0], c[i + 1][0], f) | 0, lerp(c[i][1], c[i + 1][1], f) | 0, lerp(c[i][2], c[i + 1][2], f) | 0];
                },
                turbo: (t) => {
                    const c = [[48, 18, 59], [70, 130, 180], [86, 204, 96], [245, 230, 66], [182, 55, 36]];
                    const s = t * (c.length - 1), i = Math.min(c.length - 2, s | 0), f = s - i;
                    return [lerp(c[i][0], c[i + 1][0], f) | 0, lerp(c[i][1], c[i + 1][1], f) | 0, lerp(c[i][2], c[i + 1][2], f) | 0];
                }
            };
            let activeColormap = "neural";

            function vToRGBColormapped(v) {
                const t = clamp((v + 90) / 140, 0, 1);
                return (COLORMAPS[activeColormap] || COLORMAPS.neural)(t);
            }

            function drawColorbar() {
                const cv = $("cvColorbar");
                if (!cv) return;
                const ctx = cv.getContext("2d");
                const dpr = Math.max(1, window.devicePixelRatio || 1);
                const rect = cv.getBoundingClientRect();
                cv.width = Math.floor(rect.width * dpr);
                cv.height = Math.floor(rect.height * dpr);
                for (let x = 0; x < cv.width; x++) {
                    const t = x / (cv.width - 1);
                    const [r, g, b] = (COLORMAPS[activeColormap] || COLORMAPS.neural)(t);
                    ctx.fillStyle = `rgb(${r},${g},${b})`;
                    ctx.fillRect(x, 0, 1, cv.height);
                }
            }

            const selC = $("selColormap");
            if (selC) {
                selC.addEventListener("change", (e) => {
                    activeColormap = e.target.value;
                    drawColorbar();
                });
            }

            // ==========================================================
            // INNOVATIONS v2: Synaptic Conductance Model
            // ==========================================================
            let synGAmpa = 0.50, synGNmda = 0.20, synGGaba = 0.30;
            let synIdx = 8, synAutoIvl = 0, synLastFire = -1e9;
            const E_AMPA = 0, E_NMDA = 0, E_GABA = -80;

            class SynapticEvent {
                constructor(type, tStart, gMax, target) {
                    this.type = type; this.t0 = tStart; this.gMax = gMax; this.target = target;
                    if (type === "ampa") { this.tauR = 0.5; this.tauD = 3.0; }
                    else if (type === "nmda") { this.tauR = 2.0; this.tauD = 80.0; }
                    else { this.tauR = 0.5; this.tauD = 7.0; }
                }
                g(t) {
                    const dt = t - this.t0;
                    if (dt < 0) return 0;
                    const peak = this.tauD * this.tauR / (this.tauD - this.tauR);
                    const norm = 1 / (Math.exp(-peak / this.tauD) - Math.exp(-peak / this.tauR));
                    return this.gMax * norm * (Math.exp(-dt / this.tauD) - Math.exp(-dt / this.tauR));
                }
                erev() { return this.type === "gaba" ? E_GABA : (this.type === "nmda" ? E_NMDA : E_AMPA); }
                mgBlock(V) {
                    if (this.type !== "nmda") return 1.0;
                    const Mg = 1.0;
                    return 1.0 / (1.0 + (Mg / 3.57) * Math.exp(-0.062 * V));
                }
                expired(t) { return (t - this.t0) > this.tauD * 8; }
            }

            let synEvents = [];

            function fireSynapse(type) {
                const gMap = { ampa: synGAmpa, nmda: synGNmda, gaba: synGGaba };
                synEvents.push(new SynapticEvent(type, t_ms, gMap[type] || 0.5, clamp(synIdx, 0, N - 1)));
            }

            function computeSynapticCurrent(compartIdx, Vi, tNow) {
                let Isyn = 0;
                for (const ev of synEvents) {
                    if (ev.target !== compartIdx) continue;
                    const gs = ev.g(tNow);
                    if (gs < 1e-12) continue;
                    Isyn += gs * ev.mgBlock(Vi) * (Vi - ev.erev());
                }
                return -Isyn; // negative because we want depolarizing current to be positive
            }

            function cleanupSynapses() {
                synEvents = synEvents.filter(e => !e.expired(t_ms));
            }

            // ==========================================================
            // INNOVATIONS v2: Myelination Model
            // ==========================================================
            let myelinated = false;
            let nodeSpacing = 8;

            function isNode(i) {
                if (!myelinated) return true;
                return (i % nodeSpacing) === 0;
            }

            function myelinFactor(i) {
                if (!myelinated || isNode(i)) return { cmScale: 1, glScale: 1, channelScale: 1 };
                return { cmScale: 1 / 50, glScale: 1 / 50, channelScale: 0 };
            }

            // ==========================================================
            // INNOVATIONS v2: Phase Plane (V vs dV/dt)
            // ==========================================================
            const PHASE_CAP = 2000;
            let phaseV = new Float32Array(PHASE_CAP);
            let phaseDV = new Float32Array(PHASE_CAP);
            let phaseIdx = 0, phaseFull = false;
            let prevProbeV_phase = -65;

            function pushPhase(v, dvdt) {
                phaseV[phaseIdx] = v;
                phaseDV[phaseIdx] = dvdt;
                phaseIdx++;
                if (phaseIdx >= PHASE_CAP) { phaseIdx = 0; phaseFull = true; }
            }

            function resetPhase() {
                phaseIdx = 0; phaseFull = false;
                phaseV.fill(0); phaseDV.fill(0);
                prevProbeV_phase = Vrest;
            }

            function drawPhase() {
                const cv = $("cvPhase");
                if (!cv) return;
                fitCanvas(cv);
                const ctx = cv.getContext("2d");
                const w = cv.width, h = cv.height;
                drawGrid(ctx, w, h);

                const vMin = -90, vMax = 60, dvMin = -80, dvMax = 80;
                const n = phaseFull ? PHASE_CAP : phaseIdx;
                if (n < 2) {
                    drawText(ctx, w, h, ["Waiting for trajectory data..."]);
                    return;
                }

                // Draw trajectory with fading tail
                const startI = phaseFull ? phaseIdx : 0;
                ctx.save();
                ctx.lineWidth = 1.5;
                for (let k = 1; k < n; k++) {
                    const i0 = (startI + k - 1) % PHASE_CAP;
                    const i1 = (startI + k) % PHASE_CAP;
                    const alpha = 0.1 + 0.85 * (k / n);
                    const x0 = ((phaseV[i0] - vMin) / (vMax - vMin)) * (w - 1);
                    const y0 = (1 - (phaseDV[i0] - dvMin) / (dvMax - dvMin)) * (h - 1);
                    const x1 = ((phaseV[i1] - vMin) / (vMax - vMin)) * (w - 1);
                    const y1 = (1 - (phaseDV[i1] - dvMin) / (dvMax - dvMin)) * (h - 1);
                    ctx.strokeStyle = `rgba(192,123,255,${alpha.toFixed(3)})`;
                    ctx.beginPath();
                    ctx.moveTo(x0, y0);
                    ctx.lineTo(x1, y1);
                    ctx.stroke();
                }

                // Current point
                if (n > 0) {
                    const last = (startI + n - 1) % PHASE_CAP;
                    const cx = ((phaseV[last] - vMin) / (vMax - vMin)) * (w - 1);
                    const cy = (1 - (phaseDV[last] - dvMin) / (dvMax - dvMin)) * (h - 1);
                    ctx.fillStyle = "rgba(255,255,255,0.95)";
                    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
                }

                // Axis labels
                ctx.fillStyle = "rgba(234,240,255,0.7)";
                ctx.font = `${Math.floor(Math.max(10, w / 55))}px ui-monospace,monospace`;
                ctx.textBaseline = "top";
                ctx.fillText("V (mV) \u2192", w / 2 - 20, h - 16);
                ctx.save();
                ctx.translate(14, h / 2);
                ctx.rotate(-Math.PI / 2);
                ctx.fillText("dV/dt \u2192", -20, 0);
                ctx.restore();
                ctx.restore();
            }

            // ==========================================================
            // INNOVATIONS v2: Conduction Block Detector
            // ==========================================================
            let blockDetected = false;
            let blockCount = 0, totalSpikesAtStim = 0;
            let lastStimSpike = -1e9, lastProbeSpike = -1e9;
            let prevV_stim_block = Vrest;

            function updateBlockDetection() {
                const Vs = V[clamp(stimIdx, 0, N - 1)];
                const Vp = V[clamp(probeIdx, 0, N - 1)];
                // Detect spike at stim site
                if (prevV_stim_block < thresh && Vs >= thresh) {
                    lastStimSpike = t_ms;
                    totalSpikesAtStim++;
                }
                prevV_stim_block = Vs;

                // Check if a recent stim spike failed to reach probe
                if (lastStimSpike > 0 && (t_ms - lastStimSpike) > 15) {
                    // Check if probe had a spike within a reasonable window
                    const probeHadSpike = spikeTimes.length > 0 &&
                        Math.abs(spikeTimes[spikeTimes.length - 1] - lastStimSpike) < 50;
                    if (!probeHadSpike && stimIdx !== probeIdx) {
                        blockDetected = true;
                        blockCount++;
                    } else {
                        blockDetected = false;
                    }
                    lastStimSpike = -1e9; // reset
                }

                const el = $("blockAlert");
                if (el) {
                    if (blockDetected) el.classList.add("active");
                    else el.classList.remove("active");
                }
            }

            // ==========================================================
            // INNOVATIONS v2: F-I Curve Generator
            // ==========================================================
            let fiStartI = 0, fiEndI = 25, fiSteps = 25, fiHoldMs = 500, fiSettleMs = 200;
            let fiData = []; // [{I, rate}]
            let fiRunning = false;

            async function runFICurve() {
                if (fiRunning) return;
                fiRunning = true;
                if ($("fiStatus")) $("fiStatus").textContent = "Running F-I sweep...";
                if ($("badgeFI")) $("badgeFI").textContent = "sweeping...";
                fiData = [];
                const wasRunning = running;
                running = false;

                const stepSize = (fiEndI - fiStartI) / Math.max(1, fiSteps - 1);

                for (let s = 0; s < fiSteps; s++) {
                    const Idc = fiStartI + s * stepSize;
                    // Reset cable
                    for (let i = 0; i < N; i++) {
                        V[i] = Vrest;
                        const { an, bn, am, bm, ah, bh } = rates(Vrest);
                        m[i] = am / (am + bm); h[i] = ah / (ah + bh); n[i] = an / (an + bn);
                    }
                    let localT = 0;
                    let localSpikes = 0;
                    const dtLocal = dt;

                    // Settle phase
                    while (localT < fiSettleMs) {
                        Iinj.fill(0);
                        Iinj[clamp(stimIdx, 0, N - 1)] = Idc;
                        applyIntegratorStep();
                        localT += dtLocal;
                    }

                    // Measure phase
                    let prevV = V[clamp(probeIdx, 0, N - 1)];
                    const measureStart = localT;
                    while (localT < fiSettleMs + fiHoldMs) {
                        Iinj.fill(0);
                        Iinj[clamp(stimIdx, 0, N - 1)] = Idc;
                        applyIntegratorStep();
                        localT += dtLocal;
                        const Vp = V[clamp(probeIdx, 0, N - 1)];
                        if (prevV < thresh && Vp >= thresh) localSpikes++;
                        prevV = Vp;
                    }

                    const rateHz = localSpikes / (fiHoldMs * 1e-3);
                    fiData.push({ I: Idc, rate: rateHz });
                    if ($("fiStatus")) $("fiStatus").textContent = `Step ${s + 1}/${fiSteps}: I=${Idc.toFixed(1)} \u2192 ${rateHz.toFixed(1)} Hz`;

                    // Yield to UI
                    if (s % 3 === 0) await new Promise(r => setTimeout(r, 0));
                }

                // Classify excitability type
                let smooth = true;
                for (let i = 2; i < fiData.length; i++) {
                    if (fiData[i].rate > 0 && fiData[i - 1].rate === 0) {
                        if (fiData[i].rate > 15) smooth = false;
                    }
                }
                const typeStr = smooth ? "Type I (smooth onset)" : "Type II (discontinuous)";

                // Restore cable
                resetCable();
                running = wasRunning;
                fiRunning = false;

                if ($("fiStatus")) $("fiStatus").textContent = `Done. ${fiData.length} points. ${typeStr}`;
                if ($("badgeFI")) $("badgeFI").textContent = typeStr;
                drawFICurve();
            }

            function drawFICurve() {
                const cv = $("cvFI");
                if (!cv) return;
                fitCanvas(cv);
                const ctx = cv.getContext("2d");
                const w = cv.width, h = cv.height;
                drawGrid(ctx, w, h);

                if (fiData.length < 2) {
                    drawText(ctx, w, h, ["No F-I data yet.", "Press 'Run F-I Sweep' to generate."]);
                    return;
                }

                const iMax = Math.max(...fiData.map(d => d.I));
                const iMin = Math.min(...fiData.map(d => d.I));
                const rMax = Math.max(1, Math.max(...fiData.map(d => d.rate)));

                ctx.save();
                // Draw area fill
                ctx.fillStyle = "rgba(116,246,198,0.08)";
                ctx.beginPath();
                ctx.moveTo(0, h - 1);
                for (const d of fiData) {
                    const x = ((d.I - iMin) / (iMax - iMin || 1)) * (w - 20) + 10;
                    const y = (1 - d.rate / rMax) * (h - 20) + 10;
                    ctx.lineTo(x, y);
                }
                ctx.lineTo(w - 10, h - 1);
                ctx.closePath();
                ctx.fill();

                // Draw line
                ctx.strokeStyle = "rgba(116,246,198,0.95)";
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                let first = true;
                for (const d of fiData) {
                    const x = ((d.I - iMin) / (iMax - iMin || 1)) * (w - 20) + 10;
                    const y = (1 - d.rate / rMax) * (h - 20) + 10;
                    if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
                }
                ctx.stroke();

                // Draw dots
                ctx.fillStyle = "rgba(116,246,198,0.95)";
                for (const d of fiData) {
                    const x = ((d.I - iMin) / (iMax - iMin || 1)) * (w - 20) + 10;
                    const y = (1 - d.rate / rMax) * (h - 20) + 10;
                    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
                }

                drawText(ctx, w, h, [
                    `F-I: ${iMin.toFixed(1)}\u2013${iMax.toFixed(1)} \u00b5A/cm\u00b2`,
                    `max ${rMax.toFixed(1)} Hz`
                ]);
                ctx.restore();
            }

            function exportFICSV() {
                if (fiData.length === 0) { alert("No F-I data. Run sweep first."); return; }
                const header = "I_uA_cm2,rate_Hz";
                const rows = fiData.map(d => `${d.I.toFixed(4)},${d.rate.toFixed(4)}`);
                const blob = new Blob([header + "\\n" + rows.join("\\n")], { type: "text/csv" });
                downloadBlob(blob, "fi_curve.csv");
            }

            // ==========================================================
            // INNOVATIONS v2: Bifurcation Scanner
            // ==========================================================
            let bifMaxI = 30, bifPrecision = 0.05;

            async function runBifurcation() {
                if ($("bifStatus")) $("bifStatus").textContent = "Scanning...";
                let lo = 0, hi = bifMaxI;

                function testI(Idc) {
                    // Quick sim: run for ~300ms at given DC
                    const tempV = new Float32Array(N);
                    const tempM = new Float32Array(N);
                    const tempH = new Float32Array(N);
                    const tempN = new Float32Array(N);
                    for (let i = 0; i < N; i++) {
                        tempV[i] = Vrest;
                        const { an, bn, am, bm, ah, bh } = rates(Vrest);
                        tempM[i] = am / (am + bm); tempH[i] = ah / (ah + bh); tempN[i] = an / (an + bn);
                    }

                    let spiked = false, prevVp = Vrest;
                    const stim = clamp(stimIdx, 0, N - 1);
                    for (let step = 0; step < 300 / dt; step++) {
                        Iinj.fill(0);
                        Iinj[stim] = Idc;
                        // Quick Euler for speed
                        computeDerivs(tempV, tempM, tempH, tempN, Iinj, dV1, dm1, dh1, dn1, null, null, null);
                        for (let i = 0; i < N; i++) {
                            tempV[i] += dt * dV1[i];
                            tempM[i] = clamp(tempM[i] + dt * dm1[i], 0, 1);
                            tempH[i] = clamp(tempH[i] + dt * dh1[i], 0, 1);
                            tempN[i] = clamp(tempN[i] + dt * dn1[i], 0, 1);
                        }
                        const Vp = tempV[clamp(probeIdx, 0, N - 1)];
                        if (prevVp < thresh && Vp >= thresh) spiked = true;
                        prevVp = Vp;
                    }
                    return spiked;
                }

                // Binary search
                let iterations = 0;
                while ((hi - lo) > bifPrecision && iterations < 50) {
                    const mid = (lo + hi) / 2;
                    if (testI(mid)) hi = mid;
                    else lo = mid;
                    iterations++;
                    if (iterations % 5 === 0) {
                        if ($("bifStatus")) $("bifStatus").textContent = `Scanning: ${lo.toFixed(2)}\u2013${hi.toFixed(2)} \u00b5A/cm\u00b2...`;
                        await new Promise(r => setTimeout(r, 0));
                    }
                }

                const rheobase = (lo + hi) / 2;
                if ($("bifStatus")) $("bifStatus").textContent = `Rheobase \u2248 ${rheobase.toFixed(3)} \u00b5A/cm\u00b2 (${iterations} iterations)`;
            }

            // ==========================================================
            // INNOVATIONS v2: Particle Background
            // ==========================================================
            function initParticles() {
                const cv = $("particleBg");
                if (!cv) return;
                const ctx = cv.getContext("2d");
                const particles = [];
                const COUNT = 60;

                function resize() { cv.width = window.innerWidth; cv.height = window.innerHeight; }
                resize();
                window.addEventListener("resize", resize);

                for (let i = 0; i < COUNT; i++) {
                    particles.push({
                        x: Math.random() * cv.width,
                        y: Math.random() * cv.height,
                        vx: (Math.random() - 0.5) * 0.3,
                        vy: (Math.random() - 0.5) * 0.2,
                        r: 1 + Math.random() * 2,
                        a: 0.05 + Math.random() * 0.15
                    });
                }

                function animParticles() {
                    ctx.clearRect(0, 0, cv.width, cv.height);
                    for (const p of particles) {
                        p.x += p.vx; p.y += p.vy;
                        if (p.x < 0) p.x = cv.width;
                        if (p.x > cv.width) p.x = 0;
                        if (p.y < 0) p.y = cv.height;
                        if (p.y > cv.height) p.y = 0;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                        ctx.fillStyle = `rgba(122,166,255,${p.a})`;
                        ctx.fill();
                    }
                    // Connections
                    for (let i = 0; i < particles.length; i++) {
                        for (let j = i + 1; j < particles.length; j++) {
                            const dx = particles[i].x - particles[j].x;
                            const dy = particles[i].y - particles[j].y;
                            const d = Math.sqrt(dx * dx + dy * dy);
                            if (d < 120) {
                                ctx.strokeStyle = `rgba(122,166,255,${0.03 * (1 - d / 120)})`;
                                ctx.lineWidth = 0.5;
                                ctx.beginPath();
                                ctx.moveTo(particles[i].x, particles[i].y);
                                ctx.lineTo(particles[j].x, particles[j].y);
                                ctx.stroke();
                            }
                        }
                    }
                    requestAnimationFrame(animParticles);
                }
                animParticles();
            }

            // ==========================================================
            // INNOVATIONS v2: Collapsible Sections
            // ==========================================================
            function initCollapsible() {
                document.querySelectorAll(".section h2").forEach(h2 => {
                    h2.addEventListener("click", (e) => {
                        if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
                        const section = h2.closest(".section");
                        if (section) section.classList.toggle("collapsed");
                    });
                });
            }

            // ==========================================================
            // INNOVATIONS v2: Wire New UI Controls
            // ==========================================================
            function wireInnovationUI() {
                // Synapse sliders
                bindRange("rngGAmpa", "valGAmpa", x => x.toFixed(2), x => { synGAmpa = x; });
                bindRange("rngGNmda", "valGNmda", x => x.toFixed(2), x => { synGNmda = x; });
                bindRange("rngGGaba", "valGGaba", x => x.toFixed(2), x => { synGGaba = x; });
                bindRange("rngSynIdx", "valSynIdx", x => String(x | 0), x => { synIdx = x | 0; });
                bindRange("rngSynIvl", "valSynIvl", x => String(x | 0), x => { synAutoIvl = x | 0; });

                if ($("btnAmpa")) $("btnAmpa").addEventListener("click", () => fireSynapse("ampa"));
                if ($("btnNmda")) $("btnNmda").addEventListener("click", () => fireSynapse("nmda"));
                if ($("btnGaba")) $("btnGaba").addEventListener("click", () => fireSynapse("gaba"));
                if ($("btnSynAll")) $("btnSynAll").addEventListener("click", () => { fireSynapse("ampa"); fireSynapse("nmda"); });

                // Myelination
                if ($("selMyelin")) $("selMyelin").addEventListener("change", (e) => {
                    myelinated = (e.target.value === "myelin");
                    if ($("valMyelin")) $("valMyelin").textContent = myelinated ? "Myelinated" : "Bare";
                });
                bindRange("rngNodeSpc", "valNodeSpc", x => String(x | 0), x => { nodeSpacing = x | 0; });

                // F-I Curve
                bindRange("rngFIS", "valFIS", x => String(x), x => { fiStartI = x; });
                bindRange("rngFIE", "valFIE", x => String(x), x => { fiEndI = x; });
                bindRange("rngFIN", "valFIN", x => String(x | 0), x => { fiSteps = x | 0; });
                bindRange("rngFIH", "valFIH", x => String(x | 0), x => { fiHoldMs = x | 0; });
                bindRange("rngFIT", "valFIT", x => String(x | 0), x => { fiSettleMs = x | 0; });
                if ($("btnFIRun")) $("btnFIRun").addEventListener("click", runFICurve);
                if ($("btnFIExp")) $("btnFIExp").addEventListener("click", exportFICSV);

                // Bifurcation
                bindRange("rngBifMax", "valBifMax", x => String(x), x => { bifMaxI = x; });
                bindRange("rngBifP", "valBifP", x => x.toFixed(2), x => { bifPrecision = x; });
                if ($("btnBifScan")) $("btnBifScan").addEventListener("click", runBifurcation);

                // Tabs selection update for new views
                document.querySelectorAll(".tabs .tab").forEach(tab => {
                    tab.addEventListener("click", (e) => {
                        document.querySelectorAll(".tabs .tab").forEach(t => t.classList.remove("active"));
                        e.target.classList.add("active");
                    });
                });
            }

            // ==========================================================
            // Override vToRGB to use colormap
            // ==========================================================
            const _origVToRGB = window.vToRGB || function () { };
            vToRGB = vToRGBColormapped;

            // ==========================================================
            // Main animation (updated)
            // ==========================================================
            function loop() {
                if (running) {
                    // Auto-fire synapses
                    if (synAutoIvl > 0 && (t_ms - synLastFire) >= synAutoIvl) {
                        synLastFire = t_ms;
                        if (synGAmpa > 0) fireSynapse("ampa");
                        if (synGNmda > 0) fireSynapse("nmda");
                    }

                    simStep();

                    // Phase plane data
                    const Vp = V[probeIdx];
                    const dvdt = (Vp - prevProbeV_phase) / (dt * stepsPerFrame);
                    prevProbeV_phase = Vp;
                    pushPhase(Vp, dvdt);

                    // Conduction block
                    updateBlockDetection();

                    // Cleanup old synapse events
                    if (synEvents.length > 50) cleanupSynapses();

                    // Add synapsis currents directly to Iinj for next step
                    for (let i = 0; i < N; i++) {
                        let isyn = computeSynapticCurrent(i, V[i], t_ms);
                        if (isyn !== 0) {
                            Iinj[i] += isyn;
                        }
                    }
                }

                render();
                drawPhase();
                if (!fiRunning) drawFICurve(); // draw F-I curve if not currently animating sweep

                requestAnimationFrame(loop);
            }

            // Patch computeDerivs for synaptic and myelination
            const _origComputeDerivs = computeDerivs;
            computeDerivs = function (Vsrc, msrc, hsrc, nsrc, IinjSrc, out_dV, out_dm, out_dh, out_dn, out_INa, out_IK, out_IL) {
                const ph = phi();
                const clampEnds = (bc === "clamped");
                for (let i = 0; i < N; i++) {
                    const Vi = Vsrc[i];
                    const { an, bn, am, bm, ah, bh } = rates(Vi);
                    const mf = myelinFactor(i);

                    const dmi = ph * (am * (1 - msrc[i]) - bm * msrc[i]);
                    const dhi = ph * (ah * (1 - hsrc[i]) - bh * hsrc[i]);
                    const dni = ph * (an * (1 - nsrc[i]) - bn * nsrc[i]);

                    const gNa_t = gNa * mf.channelScale * (msrc[i] * msrc[i] * msrc[i]) * hsrc[i];
                    const n4 = nsrc[i] * nsrc[i] * nsrc[i] * nsrc[i];
                    const gK_t = gK * mf.channelScale * n4;
                    const gL_eff = gL * mf.glScale;

                    const INa_v = gNa_t * (Vi - ENa);
                    const IK_v = gK_t * (Vi - EK);
                    const IL_v = gL_eff * (Vi - EL);

                    let Vim1 = (i === 0) ? (bc === "sealed" ? Vsrc[0] : Vrest) : Vsrc[i - 1];
                    let Vip1 = (i === N - 1) ? (bc === "sealed" ? Vsrc[N - 1] : Vrest) : Vsrc[i + 1];
                    let Iax = gAx * ((Vim1 - Vi) + (Vip1 - Vi));

                    if (clampEnds && (i === 0 || i === N - 1)) {
                        Iax += (gAx * 2.5) * (Vrest - Vi);
                    }

                    const Iion = INa_v + IK_v + IL_v;
                    const Cm_eff = Cm * mf.cmScale;
                    out_dV[i] = (IinjSrc[i] - Iion + Iax) / Cm_eff;
                    out_dm[i] = dmi;
                    out_dh[i] = dhi;
                    out_dn[i] = dni;

                    if (out_INa) out_INa[i] = INa_v;
                    if (out_IK) out_IK[i] = IK_v;
                    if (out_IL) out_IL[i] = IL_v;
                }
            };

            // -----------------------------
            // Boot (updated)
            // -----------------------------
            function boot() {
                allocArrays();
                // initial DSL example and compile
                if ($("txtDSL")) $("txtDSL").value = DSL_EXAMPLE;
                if ($("txtDSL")) { try { proto.compile($("txtDSL").value); proto.err = null; } catch (e) { proto.compiled = false; proto.err = e.message || String(e); } }

                resetCable();
                resetPhase();

                // apply saved preset if present
                const saved = localStorage.getItem("cablelab_preset");
                if (saved) {
                    if ($("txtJSON")) $("txtJSON").value = saved;
                    try { applyState(JSON.parse(saved)); } catch (e) { /* ignore */ }
                } else {
                    refreshJSONBox();
                }

                updateSimUI();
                updateAudioUI();
                updateProtoUI();

                // INNOVATIONS v2 init
                initParticles();
                initCollapsible();
                wireInnovationUI();
                drawColorbar();
                drawFICurve();

                loop();
            }

            boot();

        })();
    