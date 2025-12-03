(() => {
    const casSystems = {
        cas9: { pam: 'NGG', length: 20 },
        cas12: { pam: 'TTTV', length: 23 },
        cas13: { pam: 'NNN', length: 22 }
    };

    const casSelect = document.getElementById('crispr-cas-system');
    const modeSelect = document.getElementById('crispr-mode');
    const targetInput = document.getElementById('crispr-target');
    const designBtn = document.getElementById('crispr-design');
    const analyzeBtn = document.getElementById('crispr-analyze');
    const listEl = document.getElementById('crispr-grna-list');
    const canvas = document.getElementById('crispr-canvas');
    const offTargetEl = document.getElementById('crispr-offtarget-results');

    const ctx = canvas?.getContext('2d');

    let guides = [];

    function sanitizeSequence(seq) {
        return (seq || '').toUpperCase().replace(/[^ATCG]/g, '');
    }

    function pamMatches(segment, pam) {
        const degenerate = {
            N: ['A', 'T', 'C', 'G'],
            V: ['A', 'C', 'G']
        };
        for (let i = 0; i < pam.length; i++) {
            const pamChar = pam[i];
            if (pamChar === 'N' || pamChar === 'V') {
                const allowed = degenerate[pamChar];
                if (!allowed.includes(segment[i])) return false;
            } else if (pamChar !== segment[i]) {
                return false;
            }
        }
        return true;
    }

    function findCandidates(sequence, pam, guideLength) {
        const results = [];
        for (let i = 0; i < sequence.length - pam.length - guideLength; i++) {
            const pamSite = sequence.slice(i + guideLength, i + guideLength + pam.length);
            if (pamMatches(pamSite, pam)) {
                const guideSeq = sequence.slice(i, i + guideLength);
                const gc =
                    (guideSeq.split('').filter(ch => ch === 'G' || ch === 'C').length /
                        guideSeq.length) *
                    100;
                results.push({
                    sequence: guideSeq,
                    pam: pamSite,
                    start: i,
                    end: i + guideLength,
                    gc: Number(gc.toFixed(1))
                });
            }
        }
        return results.slice(0, 12);
    }

    function renderGuides(data) {
        listEl.innerHTML = '';
        if (!data.length) {
            listEl.innerHTML = '<p>No PAM sites detected in the provided sequence.</p>';
            return;
        }

        data.forEach((guide, idx) => {
            const card = document.createElement('div');
            card.className = 'guide-card';
            const label = `${guide.sequence.slice(0, 10)}…${guide.sequence.slice(-4)}`;
            card.innerHTML = `
                <div class="guide-meta">
                    <strong>gRNA ${idx + 1}</strong>
                    <span>PAM: ${guide.pam}</span>
                    <span>GC: ${guide.gc}%</span>
                    <span>Window: ${guide.start}-${guide.end}</span>
                </div>
                <div class="dna-sequence">${guide.sequence}</div>
            `;
            listEl.appendChild(card);
        });
    }

    function renderOffTargets(data, sequence) {
        if (!data.length) {
            offTargetEl.textContent = 'Design a gRNA to see off-target predictions...';
            return;
        }

        const rows = data.map(guide => {
            const risk = Math.max(
                5,
                100 -
                    guide.gc -
                    Math.min(15, Math.abs(sequence.length - guide.sequence.length)) * 0.8
            );
            const specificity = Math.min(99, 60 + guide.gc * 0.25);
            return `
                <div class="guide-card">
                    <div class="guide-meta">
                        <span>Specificity: ${specificity.toFixed(1)}%</span>
                        <span>Predicted off-target risk: ${risk.toFixed(1)}%</span>
                        <span>Potential mismatches: ${Math.max(
                            0,
                            Math.round((100 - specificity) / 12)
                        )}</span>
                    </div>
                    <div class="dna-sequence">${guide.sequence}</div>
                </div>
            `;
        });
        offTargetEl.innerHTML = rows.join('');
    }

    function drawSites(data, sequence) {
        if (!ctx || !canvas) return;
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(0, 0, w, h);

        if (!data.length) return;

        data.forEach((guide, idx) => {
            const startX = (guide.start / sequence.length) * w;
            const width = (guide.sequence.length / sequence.length) * w;
            ctx.fillStyle = `hsla(${(idx * 35) % 360}, 80%, 60%, 0.8)`;
            ctx.fillRect(startX, h / 2 - 20, width, 40);
        });

        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillRect(0, h / 2 - 2, w, 4);
    }

    function designGuides() {
        const sequence = sanitizeSequence(targetInput.value);
        targetInput.value = sequence;
        const cas = casSystems[casSelect.value] || casSystems.cas9;
        if (!sequence || sequence.length < cas.length + cas.pam.length) {
            listEl.innerHTML = '<p>Sequence is too short to design a guide.</p>';
            return;
        }

        guides = findCandidates(sequence, cas.pam, cas.length);
        renderGuides(guides);
        drawSites(guides, sequence);
        renderOffTargets(guides, sequence);
        bioLab.updateSection('crispr', {
            cas: casSelect.value,
            mode: modeSelect.value,
            target: sequence,
            guides
        });
    }

    function analyzeOffTargets() {
        if (!guides.length) {
            offTargetEl.textContent = 'Design a guide first to analyze off-targets.';
            return;
        }
        renderOffTargets(guides, targetInput.value);
    }

    function hydrate() {
        const state = bioLab.state.crispr || {};
        if (state.cas) casSelect.value = state.cas;
        if (state.mode) modeSelect.value = state.mode;
        if (state.target) targetInput.value = state.target;
        if (Array.isArray(state.guides) && state.guides.length) {
            guides = state.guides;
            renderGuides(guides);
            drawSites(guides, targetInput.value);
            renderOffTargets(guides, targetInput.value);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        hydrate();
        designBtn?.addEventListener('click', designGuides);
        analyzeBtn?.addEventListener('click', analyzeOffTargets);
        [casSelect, modeSelect].forEach(el =>
            el?.addEventListener('change', () => bioLab.updateSection('crispr', { [el.id === 'crispr-cas-system' ? 'cas' : 'mode']: el.value }))
        );
    });

    bioLab.registerExporter('crisprDesigner', () => ({
        target: targetInput?.value || '',
        cas: casSelect?.value,
        mode: modeSelect?.value,
        guides
    }));
})();
