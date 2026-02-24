// webgl-backdrop.js
// A raw WebGL implementation of a reactive, fluid-like "quantum-fractal" shader

const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

if (!gl) {
    console.error("WebGL not supported");
}

let time = 0;
let mouseX = 0.5;
let mouseY = 0.5;
let ecosystemEnergy = 0.5; // Linked to population later
let neuralActivation = 0.0;
let genomeEntropy = 0.0;
let stormIntensity = 0.0;
let dominantHue = 0.55;

// Resize canvas to full screen
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const vertexShaderSource = `
    attribute vec2 position;
    void main() {
        gl_Position = vec4(position, 0.0, 1.0);
    }
`;

// A complex, glowing fractal-esque shader
const fragmentShaderSource = `
    precision highp float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec2 u_mouse;
    uniform float u_energy;
    uniform float u_network_activation;
    uniform float u_entropy;
    uniform float u_storm;
    uniform float u_hue;

    // Pseudo-random noise
    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        uv = uv * 2.0 - 1.0;
        uv.x *= u_resolution.x / u_resolution.y;

        vec2 m = u_mouse * 2.0 - 1.0;
        m.x *= u_resolution.x / u_resolution.y;
        
        // Distance to mouse (for interactive glow)
        float dMouse = length(uv - m);
        float interaction = smoothstep(0.5, 0.0, dMouse);

        // Core fractal/fluid calculation
        vec2 p = uv;
        float f = 0.0;
        float neural = clamp(u_network_activation, 0.0, 1.5);
        float entropy = clamp(u_entropy, 0.0, 1.0);
        float storm = clamp(u_storm, 0.0, 1.0);
        
        // Multiple ecosystem channels shape the fractal independently.
        int iters = int(8.0 + u_energy * 4.0 + neural * 6.0 + entropy * 2.0);
        float time_warp = u_time * (0.1 + u_energy * 0.35 + neural * 0.65 + storm * 0.4);
        float stormPulse = 0.5 + 0.5 * sin(u_time * 2.0 + length(uv) * 8.0);
        vec2 centerShift = vec2(
            0.50 + interaction * 0.10 + storm * 0.25 * stormPulse,
            0.80 + u_energy * 0.35 + neural * 0.55
        );

        for(int i = 0; i < 20; i++) {
            if(i > iters) break;
            
            // Fractal field is bent by neural activity, storms, and diversity.
            p = abs(p) / max(dot(p, p), 0.08) - centerShift;
            float d = length(p);
            f += exp(-d * (2.0 - u_energy + storm * 0.4));
            float angle = time_warp + float(i) * 0.03 * (1.0 + entropy * 2.0);
            p *= mat2(cos(angle), sin(angle), -sin(angle), cos(angle));
            p += vec2(sin(u_time + float(i)) * 0.003, cos(u_time * 1.3 + float(i)) * 0.003) * (storm + entropy);
        }
        
        f = f / float(iters);

        vec3 baseColor = hsv2rgb(vec3(fract(u_hue + entropy * 0.12), 0.75, 1.0));
        vec3 neuralColor = hsv2rgb(vec3(fract(u_hue + 0.18 + neural * 0.08), 0.85, 1.0));
        vec3 stormColor = hsv2rgb(vec3(fract(u_hue + 0.35 + storm * 0.08), 0.9, 1.0));

        float grain = hash(floor((uv + u_time * 0.02) * vec2(180.0, 120.0)));
        vec3 color = vec3(0.0);
        color += baseColor * (f * (0.9 + entropy * 0.7));
        color += neuralColor * (interaction * f * (0.8 + neural * 1.5));
        color += stormColor * (storm * stormPulse * (0.3 + f * 0.8));
        color += vec3(grain) * 0.03 * entropy;
        
        // Fade out edges
        color *= 1.0 - length(uv) * (0.25 + storm * 0.1);

        gl_FragColor = vec4(color, 1.0);
    }
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);

const positionAttributeLocation = gl.getAttribLocation(program, "position");
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
const positions = [
    -1.0, -1.0,
    1.0, -1.0,
    -1.0, 1.0,
    -1.0, 1.0,
    1.0, -1.0,
    1.0, 1.0,
];
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
const timeLocation = gl.getUniformLocation(program, "u_time");
const mouseLocation = gl.getUniformLocation(program, "u_mouse");
const energyLocation = gl.getUniformLocation(program, "u_energy");
const networkActivationLocation = gl.getUniformLocation(program, "u_network_activation");
const entropyLocation = gl.getUniformLocation(program, "u_entropy");
const stormLocation = gl.getUniformLocation(program, "u_storm");
const hueLocation = gl.getUniformLocation(program, "u_hue");

// Track Mouse
window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX / window.innerWidth;
    // WebGL Y is flipped
    mouseY = 1.0 - (e.clientY / window.innerHeight);
});

// Expose API for ecosystem to update energy
window.setBackdropEnergy = function (val) {
    // Smooth transition could be added here
    ecosystemEnergy = Math.max(0.1, Math.min(1.0, val));
};

window.setBackdropNeuralState = function (state = {}) {
    if (typeof state.activation === 'number') {
        neuralActivation = Math.max(0, Math.min(1.5, state.activation));
    }
    if (typeof state.entropy === 'number') {
        genomeEntropy = Math.max(0, Math.min(1, state.entropy));
    }
    if (typeof state.storm === 'number') {
        stormIntensity = Math.max(0, Math.min(1, state.storm));
    }
    if (typeof state.hue === 'number') {
        dominantHue = ((state.hue % 1) + 1) % 1;
    }
};

function renderWebGL() {
    time += 0.01;

    gl.useProgram(program);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, time);
    gl.uniform2f(mouseLocation, mouseX, mouseY);
    gl.uniform1f(energyLocation, ecosystemEnergy);
    gl.uniform1f(networkActivationLocation, neuralActivation);
    gl.uniform1f(entropyLocation, genomeEntropy);
    gl.uniform1f(stormLocation, stormIntensity);
    gl.uniform1f(hueLocation, dominantHue);

    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // The main loop will call this, but we can fallback to rAF here if running solo
    // requestAnimationFrame(renderWebGL); 
}
