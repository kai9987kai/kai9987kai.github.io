(() => {
    const queryInput = document.getElementById('research-query');
    const searchBtn = document.getElementById('research-search');
    const resultsEl = document.getElementById('research-results');
    const savedEl = document.getElementById('research-saved');
    const chips = document.querySelectorAll('.chip');

    const articles = [
        {
            title: 'Prime Editing for In Vivo Liver Repair',
            summary:
                'Dual-vector AAV delivery enabling scarless correction with reduced off-target cutting in adult liver tissue.',
            tags: ['crispr', 'therapy', 'prime editing'],
            source: 'Nature Biotechnology',
            year: 2025,
            url: 'https://www.nature.com/'
        },
        {
            title: 'Cas12a Systems with Expanded PAM Recognition',
            summary: 'Engineered LbCas12a variant tolerant to TTTV and CTTV PAMs, boosting plant editing success.',
            tags: ['crispr', 'cas12', 'agriculture'],
            source: 'Science',
            year: 2024,
            url: 'https://www.science.org/'
        },
        {
            title: 'AlphaFold 3 Ligand-Aware Predictions',
            summary: 'Higher-accuracy docking of small molecules and antibody complexes with improved binding site ranking.',
            tags: ['protein', 'alphafold', 'drug discovery'],
            source: 'DeepMind',
            year: 2025,
            url: 'https://deepmind.google/'
        },
        {
            title: 'Neural Cellular Automata for Tissue Morphogenesis',
            summary: 'Learning developmental rules that recapitulate branching morphogenesis in vitro.',
            tags: ['synthetic', 'cellular automata'],
            source: 'ICLR',
            year: 2024,
            url: 'https://iclr.cc/'
        },
        {
            title: 'Base Editing to Silence PCSK9',
            summary: 'In vivo cytosine base editor reduces LDL cholesterol with durable expression.',
            tags: ['crispr', 'base editing', 'therapy'],
            source: 'NEJM',
            year: 2024,
            url: 'https://www.nejm.org/'
        },
        {
            title: 'Programmable Bacterial Consortia',
            summary: 'CRISPRi-controlled division of labor in gut microbiome communities for metabolite tuning.',
            tags: ['bacteria', 'synthetic', 'therapy'],
            source: 'Cell',
            year: 2025,
            url: 'https://www.cell.com/'
        },
        {
            title: 'Cas13d RNA Knockdown in Neurons',
            summary: 'Safer RNA editing with minimized innate immune activation and efficient delivery.',
            tags: ['crispr', 'cas13', 'neurology'],
            source: 'Nature Neuroscience',
            year: 2024,
            url: 'https://www.nature.com/'
        },
        {
            title: 'Diffusion Models for Protein Backbone Design',
            summary: 'Diffusion-based inverse folding yields stable backbones validated by cryo-EM.',
            tags: ['protein', 'design', 'ai'],
            source: 'bioRxiv',
            year: 2025,
            url: 'https://www.biorxiv.org/'
        }
    ];

    let saved = bioLab.state.research?.saved || [];
    let activeTag = '';

    function renderCards(data, container, allowSave = true) {
        container.innerHTML = '';
        if (!data.length) {
            container.innerHTML = '<p>No results found. Try a different query.</p>';
            return;
        }
        data.forEach(item => {
            const card = document.createElement('div');
            card.className = 'research-item';
            const tagLine = item.tags.map(t => `<span class="chip">${t}</span>`).join(' ');
            const isSaved = saved.some(s => s.title === item.title);
            card.innerHTML = `
                <h4>${item.title}</h4>
                <p>${item.summary}</p>
                <p>${tagLine}</p>
                <p><strong>${item.source}</strong> • ${item.year}</p>
                <div class="button-group">
                    <a class="btn-secondary" href="${item.url}" target="_blank" rel="noopener">Open</a>
                    ${
                        allowSave
                            ? `<button class="btn-primary" data-save="${item.title}">${
                                  isSaved ? 'Saved' : 'Save to Library'
                              }</button>`
                            : ''
                    }
                </div>
            `;
            container.appendChild(card);
        });
    }

    function filterResults() {
        const query = (queryInput.value || '').toLowerCase();
        const filtered = articles.filter(article => {
            const matchesTag = activeTag ? article.tags.includes(activeTag) : true;
            const matchesQuery =
                !query ||
                article.title.toLowerCase().includes(query) ||
                article.summary.toLowerCase().includes(query) ||
                article.tags.some(t => t.toLowerCase().includes(query));
            return matchesTag && matchesQuery;
        });
        renderCards(filtered, resultsEl);
    }

    function saveArticle(title) {
        const found = articles.find(a => a.title === title);
        if (!found) return;
        if (!saved.some(a => a.title === title)) {
            saved.push(found);
            bioLab.updateSection('research', { saved });
        }
        renderCards(saved, savedEl, false);
    }

    function hydrate() {
        if (saved?.length) {
            renderCards(saved, savedEl, false);
        } else {
            savedEl.innerHTML = '<p>Save research snippets to keep a personal digest.</p>';
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        hydrate();
        filterResults();
        searchBtn?.addEventListener('click', filterResults);
        queryInput?.addEventListener('keydown', e => e.key === 'Enter' && filterResults());

        chips.forEach(chip =>
            chip.addEventListener('click', () => {
                activeTag = chip.dataset.topic;
                filterResults();
            })
        );

        resultsEl?.addEventListener('click', event => {
            const target = event.target;
            if (target instanceof HTMLElement && target.dataset.save) {
                saveArticle(target.dataset.save);
                filterResults();
            }
        });
    });

    bioLab.registerExporter('researchHub', () => ({
        saved,
        lastQuery: queryInput?.value || '',
        activeTag
    }));
})();
