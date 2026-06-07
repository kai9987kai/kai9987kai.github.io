const assert = require('node:assert/strict');
const {
    analyzeProtein,
    createRng,
    findGuideCandidates,
    guideQuality,
    matchesIupac,
    reverseComplement,
    sanitizeDna
} = require('../bio-utils.js');

assert.equal(sanitizeDna('aug c-x'), 'ATGC');
assert.equal(reverseComplement('ATGCCG'), 'CGGCAT');
assert.equal(matchesIupac('TTTC', 'TTTV'), true);
assert.equal(matchesIupac('TTCT', 'TTTV'), false);
assert.equal(matchesIupac('AGG', 'NGG'), true);

const preferredGuide = guideQuality('GACTGACTGACTGACTGACT');
assert.equal(preferredGuide.gc, 50);
assert.equal(preferredGuide.band, 'preferred');

const flaggedGuide = guideQuality('TTTTAAAAAAAAAAAAAAAA');
assert.ok(flaggedGuide.score < preferredGuide.score);
assert.ok(flaggedGuide.flags.some(flag => flag.includes('poly-T')));

const cas9Candidates = findGuideCandidates(
    `GACTGACTGACTGACTGACTAGG${'A'.repeat(12)}CCA${'T'.repeat(20)}`,
    {
        pam: 'NGG',
        pamSide: '3prime',
        guideLength: 20,
        limit: 24
    }
);
assert.ok(cas9Candidates.some(candidate => candidate.strand === '+'));
assert.ok(cas9Candidates.some(candidate => candidate.strand === '-'));
assert.ok(cas9Candidates.every(candidate => candidate.start >= 0));

const firstRng = createRng(42);
const secondRng = createRng(42);
assert.deepEqual(
    Array.from({ length: 8 }, firstRng),
    Array.from({ length: 8 }, secondRng)
);

const protein = analyzeProtein('ACDEFGHIKLMNPQRSTVWY', 7);
assert.equal(protein.residues, 20);
assert.ok(protein.molecularWeight > 2);
assert.ok(protein.pI > 0 && protein.pI < 14);
assert.ok(Number.isFinite(protein.netCharge));
assert.ok(Number.isFinite(protein.gravy));

console.log('bio-utils tests passed');
