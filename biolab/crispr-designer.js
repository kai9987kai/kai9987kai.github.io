(() => {
    const casSystems = {
        cas9: {
            name: 'SpCas9',
            pam: 'NGG',
            pamSide: '3prime',
            guideLength: 20,
            limit: 24
        },
        cas12: {
            name: 'Cas12a',
            pam: 'TTTV',
            pamSide: '5prime',
            guideLength: 23,
            limit: 24
        }
    };

    const casSelect = document.getElementById('crispr-cas-system');
    const modeSelect = document.getElementById('crispr-mode');
    const targetInput = document.getElementById('crispr-target');
    const designBtn = document.getElementById('crispr-design');
    const analyzeBtn = document.getElementById('crispr-analyze');
    const listEl = document.getElementById('crispr-grna-list');
    const canvas = document.getElementById('crispr-canvas');
    const interpretationEl = document.getElementById('crispr-offtarget-results');
    const candidateCountEl = document.getElementById('crispr-candidate-count');
    const preferredCountEl = document.getElementById('crispr-preferred-count');
    const strandCountEl = document.getElementById('crispr-strand-count');
    const ctx = canvas?.getContext('2d');

    let guides = [];

    function modeContext() {
        if (modeSelect.value === 'base') {
            return 'Base-editor activity depends on editor chemistry, editable base, position in the activity window, and cell context. This view ranks spacer quality only.';
        }
        if (modeSelect.value === 'prime') {
            return 'Prime editing also requires an intended edit, primer-binding site, reverse-transcription template, and often a nicking guide. This view ranks PAM-compatible spacers only.';
        }
        return 'Standard nuclease editing still requires genome-wide off-target search and empirical activity measurement.';
    }

    function updateSummary() {
        const forward = guides.filter(guide => guide.strand === '+').length;
        const reverse = guides.length - forward;
        candidateCountEl.textContent = guides.length;
        preferredCountEl.textContent = guides.filter(guide => guide.band === 'preferred').length;
        strandCountEl.textContent = `${forward} / ${reverse}`;
    }

    function renderGuides(data) {
        listEl.innerHTML = '';
        if (!data.length) {
            listEl.innerHTML =
                '<p>No compatible PAM sites were found on either strand. Try a longer sequence or another nuclease model.</p>';
            return;
        }

        data.forEach((guide, index) => {
            const card = document.createElement('article');
            card.className = `guide-card quality-${guide.band}`;
            const flags = guide.flags.length ? guide.flags.join('; ') : 'no basic sequence flags';
            card.innerHTML = `
                <div class="guide-heading">
                    <strong>#${index + 1} · score ${guide.score}/100</strong>
                    <span class="evidence-badge ${guide.band}">${guide.band}</span>
                </div>
                <div class="guide-meta">
                    <span>Strand: ${guide.strand}</span>
                    <span>PAM: ${guide.pam}</span>
                    <span>GC: ${guide.gc}%</span>
                    <span>Coordinates: ${guide.start + 1}-${guide.end}</span>
                </div>
                <div class="dna-sequence">${guide.sequence}</div>
                <p class="guide-flags">${flags}</p>
                <button class="btn-secondary compact" data-copy="${guide.sequence}">Copy spacer</button>
            `;
            listEl.appendChild(card);
        });
    }

    function renderInterpretation() {
        if (!guides.length) {
            interpretationEl.innerHTML =
                '<p>No candidates are available to interpret. This tool does not infer off-targets without a reference genome.</p>';
            return;
        }

        const top = guides[0];
        const topFlags = top.flags.length ? top.flags.join(', ') : 'none detected';
        interpretationEl.innerHTML = `
            <div class="analysis-copy">
                <p><strong>Top sequence-level candidate:</strong> ${top.sequence} (${top.strand} strand, ${top.score}/100).</p>
                <p><strong>Basic flags:</strong> ${topFlags}.</p>
                <p><strong>Editing mode:</strong> ${modeContext()}</p>
                <p><strong>Required next checks:</strong> align against the correct reference assembly; score mismatch and bulge sites; inspect exons, regulatory regions, and population variants; then validate on-target activity and unintended editing experimentally.</p>
                <p>This ranking uses GC balance, homopolymers, poly-T, and sequence complexity. It is not a learned activity score or a specificity percentage.</p>
            </div>
        `;
    }

    function drawSites(data, sequence) {
        if (!ctx || !canvas) return;
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.fillRect(0, 0, width, height);

        const padding = 24;
        const axisWidth = width - padding * 2;
        const forwardY = height * 0.38;
        const reverseY = height * 0.67;
        ctx.strokeStyle = 'rgba(255,255,255,0.32)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding, forwardY);
        ctx.lineTo(width - padding, forwardY);
        ctx.moveTo(padding, reverseY);
        ctx.lineTo(width - padding, reverseY);
        ctx.stroke();

        ctx.font = '12px DM Mono, monospace';
        ctx.fillStyle = 'rgba(230,236,255,0.72)';
        ctx.fillText('+ strand', padding, forwardY - 14);
        ctx.fillText('- strand', padding, reverseY - 14);

        data.forEach((guide, index) => {
            const startX = padding + (guide.start / sequence.length) * axisWidth;
            const guideWidth = Math.max(4, ((guide.end - guide.start) / sequence.length) * axisWidth);
            const y = guide.strand === '+' ? forwardY : reverseY;
            const hue = guide.band === 'preferred' ? 165 : guide.band === 'usable' ? 238 : 18;
            ctx.fillStyle = `hsla(${hue}, 78%, 62%, ${Math.max(0.42, 0.9 - index * 0.025)})`;
            ctx.fillRect(startX, y - 7, guideWidth, 14);
        });
    }

    function designGuides() {
        const sequence = BioUtils.sanitizeDna(targetInput.value);
        const cas = casSystems[casSelect.value] || casSystems.cas9;
        targetInput.value = sequence;

        if (sequence.length < cas.guideLength + cas.pam.length) {
            guides = [];
            renderGuides(guides);
            renderInterpretation();
            updateSummary();
            drawSites([], sequence || 'A');
            return;
        }

        guides = BioUtils.findGuideCandidates(sequence, cas);
        renderGuides(guides);
        renderInterpretation();
        updateSummary();
        drawSites(guides, sequence);
        bioLab.updateSection('crispr', {
            cas: casSelect.value,
            mode: modeSelect.value,
            target: sequence,
            guides
        });
    }

    function hydrate() {
        const state = bioLab.state.crispr || {};
        if (state.cas && casSystems[state.cas]) casSelect.value = state.cas;
        if (state.mode) modeSelect.value = state.mode;
        if (state.target) targetInput.value = state.target;
    }

    document.addEventListener('DOMContentLoaded', () => {
        hydrate();
        designBtn?.addEventListener('click', designGuides);
        analyzeBtn?.addEventListener('click', renderInterpretation);

        [casSelect, modeSelect].forEach(element =>
            element?.addEventListener('change', () => {
                designGuides();
            })
        );

        listEl?.addEventListener('click', async event => {
            const target = event.target;
            if (!(target instanceof HTMLElement) || !target.dataset.copy) return;
            try {
                await navigator.clipboard.writeText(target.dataset.copy);
                target.textContent = 'Copied';
                setTimeout(() => (target.textContent = 'Copy spacer'), 1200);
            } catch {
                target.textContent = 'Copy unavailable';
            }
        });

        if (bioLab.state.crispr?.target) designGuides();
        else updateSummary();
    });

    bioLab.registerExporter('crisprDesigner', () => ({
        target: targetInput?.value || '',
        cas: casSelect?.value,
        mode: modeSelect?.value,
        rankingMethod: 'sequence heuristics only; no genome-wide off-target search',
        guides
    }));
})();
