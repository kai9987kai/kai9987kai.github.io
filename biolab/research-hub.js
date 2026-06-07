(() => {
    const queryInput = document.getElementById('research-query');
    const searchBtn = document.getElementById('research-search');
    const clearBtn = document.getElementById('research-clear-filter');
    const resultsEl = document.getElementById('research-results');
    const savedEl = document.getElementById('research-saved');
    const countEl = document.getElementById('research-count');
    const chips = document.querySelectorAll('.research-filters .chip');

    const articles = [
        {
            id: 'verve-102-2026',
            title: 'In Vivo Base Editing of PCSK9 for Familial Hypercholesterolemia',
            summary:
                'Phase 1 data for VERVE-102 reported dose-dependent, durable reductions in PCSK9 and LDL cholesterol after a single infusion.',
            limitation:
                'Early, uncontrolled safety and dose-escalation evidence; it is not an approval or proof of long-term clinical benefit.',
            tags: ['crispr', 'therapy', 'base editing'],
            evidence: 'Human phase 1',
            source: 'New England Journal of Medicine',
            date: '2026-05-25',
            url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa2603743'
        },
        {
            id: 'delivery-review-2026',
            title: 'Targeted Delivery of Genome Editors In Vivo',
            summary:
                'A current review of viral and non-viral delivery, tissue targeting, immunogenicity, cargo limits, and translational barriers.',
            limitation:
                'Review article: synthesizes the field but does not itself establish efficacy for a particular delivery platform.',
            tags: ['crispr', 'therapy', 'delivery'],
            evidence: 'Review',
            source: 'Nature Biotechnology',
            date: '2026-01-12',
            url: 'https://www.nature.com/articles/s41587-025-02921-0'
        },
        {
            id: 'protdat-2025',
            title: 'ProtDAT: Protein Sequence Design from Function and Structure',
            summary:
                'A multimodal diffusion model generates protein sequences conditioned on textual function descriptions and structural context.',
            limitation:
                'Computational generation and benchmark results do not replace expression, folding, binding, and safety validation.',
            tags: ['protein', 'design', 'ai'],
            evidence: 'Computational method',
            source: 'Nature Communications',
            date: '2025-11-26',
            url: 'https://www.nature.com/articles/s41467-025-65363-1'
        },
        {
            id: 'deepbe-2025',
            title: 'Deep Learning Prediction of Base-Editing Outcomes',
            summary:
                'A predictive framework models base-editor efficiency and product purity across sequence contexts to support editor and guide selection.',
            limitation:
                'Performance depends on editor, cell type, assay, and training distribution; external validation is required.',
            tags: ['crispr', 'base editing', 'ai'],
            evidence: 'Computational validation',
            source: 'Nature Communications',
            date: '2025-11-07',
            url: 'https://www.nature.com/articles/s41467-025-64884-z'
        },
        {
            id: 'prime-editors-2025',
            title: 'Engineered Prime Editors with Minimal Genomic Errors',
            summary:
                'Engineered prime-editor variants improved intended editing while reducing unwanted indels and substitutions across tested settings.',
            limitation:
                'Preclinical performance varies by locus, edit, delivery method, and cell type; pegRNA design remains context dependent.',
            tags: ['crispr', 'prime editing'],
            evidence: 'Preclinical method',
            source: 'Nature',
            date: '2025-09-17',
            url: 'https://www.nature.com/articles/s41586-025-09462-9'
        },
        {
            id: 'morphogenesis-2025',
            title: 'Engineering Synthetic Morphogenesis with Cellular Computation',
            summary:
                'A perspective connects multicellular computation, programmable signaling, tissue patterning, and engineered morphogenesis.',
            limitation:
                'Conceptual and forward-looking; simple cellular automata are not calibrated models of these biological systems.',
            tags: ['synthetic', 'cellular automata', 'morphogenesis'],
            evidence: 'Perspective',
            source: 'Nature Computational Science',
            date: '2025-08-13',
            url: 'https://www.nature.com/articles/s43588-025-00843-4'
        },
        {
            id: 'personalized-editing-2025',
            title: 'Patient-Specific In Vivo Gene Editing for CPS1 Deficiency',
            summary:
                'A bespoke lipid-nanoparticle base-editing therapy was designed and administered to an infant with severe CPS1 deficiency.',
            limitation:
                'Single-patient report with short follow-up; the approach is promising but not yet generalizable or approved.',
            tags: ['crispr', 'therapy', 'personalized'],
            evidence: 'Single-patient clinical report',
            source: 'New England Journal of Medicine',
            date: '2025-05-15',
            url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa2504747'
        },
        {
            id: 'alphafold3-benchmark-2024',
            title: 'AlphaFold3 versus Experimental GPCR Structures',
            summary:
                'An experimental comparison found useful predictive capability alongside important errors in ligands, ions, waters, and receptor conformations.',
            limitation:
                'Focused on GPCR complexes; it demonstrates why confidence metrics and experimental structures still matter.',
            tags: ['protein', 'alphafold', 'benchmark'],
            evidence: 'Experimental benchmark',
            source: 'Nature Methods',
            date: '2024-12-06',
            url: 'https://www.nature.com/articles/s41592-024-02525-9'
        },
        {
            id: 'alphafold3-2024',
            title: 'Accurate Structure Prediction of Biomolecular Interactions with AlphaFold 3',
            summary:
                'AlphaFold 3 extends prediction to complexes containing proteins, nucleic acids, small molecules, ions, and modified residues.',
            limitation:
                'Predictions are hypotheses with failure modes; affinity, dynamics, mechanism, and safety require other evidence.',
            tags: ['protein', 'alphafold', 'ai'],
            evidence: 'Computational method',
            source: 'Nature',
            date: '2024-05-08',
            url: 'https://www.nature.com/articles/s41586-024-07487-w'
        },
        {
            id: 'casgevy-fda-2023',
            title: 'CASGEVY: First FDA-Approved CRISPR/Cas9 Therapy',
            summary:
                'The FDA approval established exagamglogene autotemcel as the first US therapy using CRISPR/Cas9 genome editing.',
            limitation:
                'It is an ex vivo autologous stem-cell therapy requiring myeloablative conditioning, specialized care, and long-term follow-up.',
            tags: ['crispr', 'therapy', 'approved'],
            evidence: 'Regulatory approval',
            source: 'US Food and Drug Administration',
            date: '2023-12-08',
            url: 'https://www.fda.gov/news-events/press-announcements/fda-approves-first-gene-therapies-treat-patients-sickle-cell-disease'
        }
    ].sort((a, b) => b.date.localeCompare(a.date));

    const storedSaved = bioLab.state.research?.saved || [];
    let savedIds = new Set(
        storedSaved
            .map(item => (typeof item === 'string' ? item : item.id))
            .filter(id => articles.some(article => article.id === id))
    );
    let activeTag = '';

    function formatDate(date) {
        return new Intl.DateTimeFormat('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }).format(new Date(`${date}T00:00:00Z`));
    }

    function renderCards(data, container, allowSave = true) {
        container.innerHTML = '';
        if (!data.length) {
            container.innerHTML = '<p>No matching sources. Clear filters or try another query.</p>';
            return;
        }

        data.forEach(item => {
            const card = document.createElement('article');
            card.className = 'research-item';
            const tagLine = item.tags.map(tag => `<span class="chip static">${tag}</span>`).join(' ');
            const isSaved = savedIds.has(item.id);
            card.innerHTML = `
                <div class="research-card-heading">
                    <span class="evidence-badge">${item.evidence}</span>
                    <time datetime="${item.date}">${formatDate(item.date)}</time>
                </div>
                <h4>${item.title}</h4>
                <p>${item.summary}</p>
                <p class="limitation"><strong>Interpretation:</strong> ${item.limitation}</p>
                <p>${tagLine}</p>
                <p><strong>${item.source}</strong></p>
                <div class="button-group">
                    <a class="btn-secondary" href="${item.url}" target="_blank" rel="noopener noreferrer">Open source</a>
                    ${
                        allowSave
                            ? `<button class="btn-primary" data-save="${item.id}" ${
                                  isSaved ? 'disabled' : ''
                              }>${isSaved ? 'Saved' : 'Save to library'}</button>`
                            : `<button class="btn-secondary" data-remove="${item.id}">Remove</button>`
                    }
                </div>
            `;
            container.appendChild(card);
        });
    }

    function filteredArticles() {
        const query = (queryInput.value || '').trim().toLowerCase();
        return articles.filter(article => {
            const matchesTag = activeTag ? article.tags.includes(activeTag) : true;
            const searchable = [
                article.title,
                article.summary,
                article.limitation,
                article.source,
                article.evidence,
                ...article.tags
            ]
                .join(' ')
                .toLowerCase();
            return matchesTag && (!query || searchable.includes(query));
        });
    }

    function renderResults() {
        const filtered = filteredArticles();
        renderCards(filtered, resultsEl);
        countEl.textContent = `${filtered.length} source${filtered.length === 1 ? '' : 's'}`;
        chips.forEach(chip => chip.classList.toggle('active', chip.dataset.topic === activeTag));
    }

    function renderSaved() {
        const savedArticles = articles.filter(article => savedIds.has(article.id));
        if (!savedArticles.length) {
            savedEl.innerHTML = '<p>Save sources to build a focused reading list.</p>';
            return;
        }
        renderCards(savedArticles, savedEl, false);
    }

    function persistSaved() {
        bioLab.updateSection('research', { saved: [...savedIds] });
    }

    function clearFilters() {
        activeTag = '';
        queryInput.value = '';
        renderResults();
    }

    document.addEventListener('DOMContentLoaded', () => {
        renderResults();
        renderSaved();
        searchBtn?.addEventListener('click', renderResults);
        clearBtn?.addEventListener('click', clearFilters);
        queryInput?.addEventListener('input', renderResults);

        chips.forEach(chip =>
            chip.addEventListener('click', () => {
                activeTag = activeTag === chip.dataset.topic ? '' : chip.dataset.topic;
                renderResults();
            })
        );

        resultsEl?.addEventListener('click', event => {
            const target = event.target;
            if (!(target instanceof HTMLElement) || !target.dataset.save) return;
            savedIds.add(target.dataset.save);
            persistSaved();
            renderResults();
            renderSaved();
        });

        savedEl?.addEventListener('click', event => {
            const target = event.target;
            if (!(target instanceof HTMLElement) || !target.dataset.remove) return;
            savedIds.delete(target.dataset.remove);
            persistSaved();
            renderResults();
            renderSaved();
        });
    });

    bioLab.registerExporter('researchHub', () => ({
        verifiedAt: '2026-06-07',
        savedSourceIds: [...savedIds],
        lastQuery: queryInput?.value || '',
        activeTag
    }));
})();
