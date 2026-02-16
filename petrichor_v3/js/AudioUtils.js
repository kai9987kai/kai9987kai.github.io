/**
 * AudioUtils.js
 * Helpers for generating noise buffers and impulses.
 */
export default class AudioUtils {
    static createWhiteNoise(ctx, seconds = 4) {
        const bufferSize = ctx.sampleRate * seconds;
        const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
        }
        return buffer;
    }

    static createBrownNoise(ctx, seconds = 4) {
        const bufferSize = ctx.sampleRate * seconds;
        const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            let lastOut = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                lastOut = (lastOut + (0.02 * white)) / 1.02;
                data[i] = lastOut * 3.5; // Compensate for gain loss
                if (Math.abs(data[i]) > 1) data[i] /= Math.abs(data[i]); // Clip safety
            }
        }
        return buffer;
    }

    static createPinkNoise(ctx, seconds = 4) {
        const bufferSize = ctx.sampleRate * seconds;
        const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
                data[i] *= 0.11; // Normalize roughly
                if (isNaN(data[i])) data[i] = 0;
                if (Math.abs(data[i]) > 1) data[i] /= Math.abs(data[i]);
                b6 = white * 0.115926;
            }
        }
        return buffer;
    }

    static createImpulseResponse(ctx, decay, dens, bright, stereo) {
        const length = Math.floor(ctx.sampleRate * decay);
        const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
        const L = buffer.getChannelData(0);
        const R = buffer.getChannelData(1);

        for (let i = 0; i < length; i++) {
            const t = i / ctx.sampleRate;
            const env = Math.exp(-t * (3 / decay));
            const lp = 1 / (1 + t * bright);
            const early = t < 0.08 ? 1 + dens * 2 : 1;
            const pre = t < (decay > 0.15 ? 0.015 : 0.004) ? 0 : 1;
            const amp = env * lp * early * pre * 0.15;

            const nL = Math.random() * 2 - 1;
            const nR = Math.random() * 2 - 1;

            L[i] = nL * amp;
            R[i] = (nR * stereo + nL * (1 - stereo)) * amp;
        }
        return buffer;
    }
}
