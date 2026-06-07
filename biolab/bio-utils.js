(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    root.BioUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const DNA_COMPLEMENT = { A: 'T', T: 'A', C: 'G', G: 'C' };
    const IUPAC = {
        A: 'A',
        C: 'C',
        G: 'G',
        T: 'T',
        R: 'AG',
        Y: 'CT',
        S: 'GC',
        W: 'AT',
        K: 'GT',
        M: 'AC',
        B: 'CGT',
        D: 'AGT',
        H: 'ACT',
        V: 'ACG',
        N: 'ACGT'
    };
    const RESIDUE_MASSES = {
        A: 71.0788,
        R: 156.1875,
        N: 114.1038,
        D: 115.0886,
        C: 103.1388,
        E: 129.1155,
        Q: 128.1307,
        G: 57.0519,
        H: 137.1411,
        I: 113.1594,
        L: 113.1594,
        K: 128.1741,
        M: 131.1926,
        F: 147.1766,
        P: 97.1167,
        S: 87.0782,
        T: 101.1051,
        W: 186.2132,
        Y: 163.176,
        V: 99.1326
    };
    const HYDROPATHY = {
        A: 1.8,
        R: -4.5,
        N: -3.5,
        D: -3.5,
        C: 2.5,
        E: -3.5,
        Q: -3.5,
        G: -0.4,
        H: -3.2,
        I: 4.5,
        L: 3.8,
        K: -3.9,
        M: 1.9,
        F: 2.8,
        P: -1.6,
        S: -0.8,
        T: -0.7,
        W: -0.9,
        Y: -1.3,
        V: 4.2
    };
    const HYDROPHOBIC = new Set(['A', 'I', 'L', 'M', 'F', 'W', 'V', 'P', 'G']);

    function sanitizeDna(sequence) {
        return String(sequence || '')
            .toUpperCase()
            .replace(/U/g, 'T')
            .replace(/[^ACGT]/g, '');
    }

    function sanitizeProtein(sequence) {
        return String(sequence || '')
            .toUpperCase()
            .replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, '');
    }

    function reverseComplement(sequence) {
        return sanitizeDna(sequence)
            .split('')
            .reverse()
            .map(base => DNA_COMPLEMENT[base])
            .join('');
    }

    function matchesIupac(sequence, pattern) {
        if (sequence.length !== pattern.length) return false;
        for (let i = 0; i < pattern.length; i++) {
            if (!IUPAC[pattern[i]]?.includes(sequence[i])) return false;
        }
        return true;
    }

    function longestHomopolymer(sequence) {
        let longest = 0;
        let current = 0;
        let previous = '';
        for (const character of sequence) {
            current = character === previous ? current + 1 : 1;
            previous = character;
            longest = Math.max(longest, current);
        }
        return longest;
    }

    function guideQuality(sequence) {
        const gcCount = sequence.split('').filter(base => base === 'G' || base === 'C').length;
        const gc = (gcCount / sequence.length) * 100;
        const flags = [];
        let score = 100;

        if (gc < 40) {
            score -= (40 - gc) * 1.4;
            flags.push('low GC');
        } else if (gc > 60) {
            score -= (gc - 60) * 1.4;
            flags.push('high GC');
        }

        const homopolymer = longestHomopolymer(sequence);
        if (homopolymer >= 5) {
            score -= 24;
            flags.push(`${homopolymer}-base homopolymer`);
        } else if (homopolymer === 4) {
            score -= 10;
            flags.push('4-base homopolymer');
        }

        if (sequence.includes('TTTT')) {
            score -= 18;
            flags.push('poly-T may terminate U6 transcription');
        }

        const uniqueTriplets = new Set();
        for (let i = 0; i <= sequence.length - 3; i++) {
            uniqueTriplets.add(sequence.slice(i, i + 3));
        }
        const complexity = uniqueTriplets.size / Math.max(1, sequence.length - 2);
        if (complexity < 0.5) {
            score -= 15;
            flags.push('low sequence complexity');
        }

        const roundedScore = Math.max(0, Math.min(100, Math.round(score)));
        const band = roundedScore >= 80 ? 'preferred' : roundedScore >= 60 ? 'usable' : 'caution';
        return { score: roundedScore, band, gc: Number(gc.toFixed(1)), flags };
    }

    function findGuideCandidates(inputSequence, config) {
        const sequence = sanitizeDna(inputSequence);
        const guideLength = config.guideLength;
        const pamLength = config.pam.length;
        const candidates = [];

        function scan(orientedSequence, strand) {
            const totalLength = orientedSequence.length;
            for (let pamStart = 0; pamStart <= totalLength - pamLength; pamStart++) {
                const pam = orientedSequence.slice(pamStart, pamStart + pamLength);
                if (!matchesIupac(pam, config.pam)) continue;

                const guideStart =
                    config.pamSide === '5prime' ? pamStart + pamLength : pamStart - guideLength;
                const guideEnd = guideStart + guideLength;
                if (guideStart < 0 || guideEnd > totalLength) continue;

                const guideSequence = orientedSequence.slice(guideStart, guideEnd);
                const quality = guideQuality(guideSequence);
                const mappedStart =
                    strand === '+' ? guideStart : sequence.length - guideEnd;
                const mappedEnd =
                    strand === '+' ? guideEnd : sequence.length - guideStart;

                candidates.push({
                    sequence: guideSequence,
                    pam,
                    strand,
                    start: mappedStart,
                    end: mappedEnd,
                    pamStart:
                        strand === '+' ? pamStart : sequence.length - (pamStart + pamLength),
                    ...quality
                });
            }
        }

        scan(sequence, '+');
        scan(reverseComplement(sequence), '-');

        return candidates
            .sort((a, b) => b.score - a.score || a.start - b.start || a.strand.localeCompare(b.strand))
            .slice(0, config.limit || 24);
    }

    function createRng(seed) {
        let state = Number(seed) >>> 0;
        if (!state) state = 0x6d2b79f5;
        return function () {
            state += 0x6d2b79f5;
            let value = state;
            value = Math.imul(value ^ (value >>> 15), value | 1);
            value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
            return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
        };
    }

    function netCharge(sequence, pH) {
        const counts = {};
        for (const residue of sequence) counts[residue] = (counts[residue] || 0) + 1;

        const positive =
            1 / (1 + 10 ** (pH - 9.69)) +
            (counts.K || 0) / (1 + 10 ** (pH - 10.5)) +
            (counts.R || 0) / (1 + 10 ** (pH - 12.4)) +
            (counts.H || 0) / (1 + 10 ** (pH - 6.0));
        const negative =
            1 / (1 + 10 ** (2.34 - pH)) +
            (counts.D || 0) / (1 + 10 ** (3.9 - pH)) +
            (counts.E || 0) / (1 + 10 ** (4.1 - pH)) +
            (counts.C || 0) / (1 + 10 ** (8.3 - pH)) +
            (counts.Y || 0) / (1 + 10 ** (10.1 - pH));
        return positive - negative;
    }

    function estimatePI(sequence) {
        let low = 0;
        let high = 14;
        for (let i = 0; i < 80; i++) {
            const midpoint = (low + high) / 2;
            if (netCharge(sequence, midpoint) > 0) low = midpoint;
            else high = midpoint;
        }
        return (low + high) / 2;
    }

    function transmembraneWindows(sequence) {
        const windows = [];
        const windowSize = 19;
        for (let i = 0; i <= sequence.length - windowSize; i++) {
            const segment = sequence.slice(i, i + windowSize);
            const average =
                segment.split('').reduce((sum, residue) => sum + HYDROPATHY[residue], 0) /
                windowSize;
            if (average >= 1.6) {
                windows.push({ start: i + 1, end: i + windowSize, average });
                i += Math.floor(windowSize / 2);
            }
        }
        return windows;
    }

    function analyzeProtein(inputSequence, pH = 7) {
        const sequence = sanitizeProtein(inputSequence);
        if (!sequence) {
            return {
                sequence,
                residues: 0,
                molecularWeight: 0,
                pI: 0,
                gravy: 0,
                netCharge: 0,
                hydrophobicPercent: 0,
                aromaticity: 0,
                transmembraneWindows: []
            };
        }

        const molecularWeight =
            sequence.split('').reduce((sum, residue) => sum + RESIDUE_MASSES[residue], 18.0153);
        const hydropathy =
            sequence.split('').reduce((sum, residue) => sum + HYDROPATHY[residue], 0) /
            sequence.length;
        const hydrophobicCount = sequence
            .split('')
            .filter(residue => HYDROPHOBIC.has(residue)).length;
        const aromaticCount = sequence
            .split('')
            .filter(residue => residue === 'F' || residue === 'W' || residue === 'Y').length;

        return {
            sequence,
            residues: sequence.length,
            molecularWeight: molecularWeight / 1000,
            pI: estimatePI(sequence),
            gravy: hydropathy,
            netCharge: netCharge(sequence, Number(pH)),
            hydrophobicPercent: (hydrophobicCount / sequence.length) * 100,
            aromaticity: (aromaticCount / sequence.length) * 100,
            transmembraneWindows: transmembraneWindows(sequence)
        };
    }

    return {
        analyzeProtein,
        createRng,
        findGuideCandidates,
        guideQuality,
        matchesIupac,
        reverseComplement,
        sanitizeDna,
        sanitizeProtein
    };
});
