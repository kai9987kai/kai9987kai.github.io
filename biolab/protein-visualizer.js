(() => {
    const container = document.getElementById('protein-3d-container');
    const styleSelect = document.getElementById('protein-style');
    const coloringSelect = document.getElementById('protein-coloring');
    const sequenceInput = document.getElementById('protein-sequence');
    const foldBtn = document.getElementById('protein-fold');
    const animateBtn = document.getElementById('protein-animate');
    const resetBtn = document.getElementById('protein-reset-view');

    const helixEl = document.getElementById('protein-helices');
    const sheetEl = document.getElementById('protein-sheets');
    const residuesEl = document.getElementById('protein-residues');
    const hydrophobicEl = document.getElementById('protein-hydrophobic');

    let scene, camera, renderer, proteinGroup;
    let animating = false;
    let currentStats = {};

    const hydrophobicResidues = new Set(['A', 'I', 'L', 'M', 'F', 'W', 'V', 'P', 'G']);
    const positiveResidues = new Set(['K', 'R', 'H']);
    const negativeResidues = new Set(['D', 'E']);

    function ensureThree() {
        if (typeof THREE === 'undefined') {
            container.innerHTML = '<p>Three.js failed to load. Please check your connection.</p>';
            return false;
        }
        return true;
    }

    function initScene() {
        if (!ensureThree() || renderer) return;
        const { clientWidth, clientHeight } = container;
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(45, clientWidth / clientHeight, 0.1, 1000);
        camera.position.set(20, 15, 26);

        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        const directional = new THREE.DirectionalLight(0xffffff, 0.9);
        directional.position.set(10, 20, 10);
        scene.add(ambient, directional);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(clientWidth, clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        container.appendChild(renderer.domElement);

        window.addEventListener('resize', handleResize);
        enableRotation();
        renderLoop();
    }

    function handleResize() {
        if (!renderer || !camera) return;
        const { clientWidth, clientHeight } = container;
        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(clientWidth, clientHeight);
    }

    function enableRotation() {
        let isDragging = false;
        let previous = { x: 0, y: 0 };

        renderer.domElement.addEventListener('pointerdown', event => {
            isDragging = true;
            previous = { x: event.clientX, y: event.clientY };
        });
        window.addEventListener('pointerup', () => (isDragging = false));
        window.addEventListener('pointermove', event => {
            if (!isDragging || !proteinGroup) return;
            const deltaX = (event.clientX - previous.x) * 0.01;
            const deltaY = (event.clientY - previous.y) * 0.01;
            proteinGroup.rotation.y += deltaX;
            proteinGroup.rotation.x += deltaY;
            previous = { x: event.clientX, y: event.clientY };
        });
    }

    function renderLoop() {
        if (proteinGroup && animating) {
            proteinGroup.rotation.y += 0.01;
            proteinGroup.rotation.x += 0.003;
        }
        renderer?.render(scene, camera);
        requestAnimationFrame(renderLoop);
    }

    function sequencePoints(seq) {
        const points = [];
        const radius = 8;
        for (let i = 0; i < seq.length; i++) {
            const angle = i * 0.45;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const y = (i - seq.length / 2) * 0.6;
            points.push(new THREE.Vector3(x, y, z));
        }
        return points;
    }

    function colorForResidue(residue, index) {
        const scheme = coloringSelect.value;
        if (scheme === 'hydrophobic') {
            return hydrophobicResidues.has(residue) ? 0x5ad1a3 : 0x6d8bff;
        }
        if (scheme === 'charge') {
            if (positiveResidues.has(residue)) return 0x6dc7ff;
            if (negativeResidues.has(residue)) return 0xff7b7b;
            return 0xe6ecff;
        }
        // pseudo-structure highlighting
        return Math.sin(index * 0.35) > 0 ? 0xffb86c : 0x89f0e4;
    }

    function makeCylinder(p1, p2, material) {
        const direction = new THREE.Vector3().subVectors(p2, p1);
        const orientation = new THREE.Matrix4();
        orientation.lookAt(p1, p2, new THREE.Object3D().up);
        orientation.multiply(
            new THREE.Matrix4().set(
                1, 0, 0, 0,
                0, 0, 1, 0,
                0,-1, 0, 0,
                0, 0, 0, 1
            )
        );
        const geometry = new THREE.CylinderGeometry(0.12, 0.12, direction.length(), 8, 1, true);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.applyMatrix4(new THREE.Matrix4().makeTranslation(0, direction.length() / 2, 0));
        mesh.applyMatrix4(orientation);
        mesh.position.copy(p1);
        return mesh;
    }

    function computeStats(seq) {
        const residues = seq.length;
        const hydroCount = seq.split('').filter(ch => hydrophobicResidues.has(ch)).length;
        const hydrophobicCore = residues ? ((hydroCount / residues) * 100).toFixed(1) : '0.0';
        const helix = Math.max(1, Math.round(residues / 28));
        const sheet = Math.max(1, Math.round(residues / 40));
        currentStats = {
            helices: helix,
            sheets: sheet,
            residues,
            hydrophobic: hydrophobicCore
        };
        helixEl.textContent = helix;
        sheetEl.textContent = sheet;
        residuesEl.textContent = residues;
        hydrophobicEl.textContent = `${hydrophobicCore}%`;
    }

    function buildProtein() {
        if (!ensureThree()) return;
        initScene();

        const sequence = (sequenceInput.value || '').toUpperCase().replace(/[^A-Z]/g, '');
        if (!sequence) {
            container.innerHTML = '<p>Please enter an amino acid sequence to render.</p>';
            return;
        }

        if (proteinGroup) {
            scene.remove(proteinGroup);
        }
        proteinGroup = new THREE.Group();

        const points = sequencePoints(sequence);
        const style = styleSelect.value;

        if (style === 'ribbon') {
            const curve = new THREE.CatmullRomCurve3(points);
            const geometry = new THREE.TubeGeometry(curve, Math.max(30, sequence.length), 0.4, 10, false);
            const material = new THREE.MeshPhongMaterial({
                color: 0x6bf9e2,
                opacity: 0.9,
                transparent: true
            });
            const ribbon = new THREE.Mesh(geometry, material);
            proteinGroup.add(ribbon);
        }

        for (let i = 0; i < points.length; i++) {
            const residue = sequence[i];
            const material = new THREE.MeshPhongMaterial({ color: colorForResidue(residue, i) });
            let size = 0.35;
            if (style === 'space-fill') size = 0.6;
            const sphere = new THREE.Mesh(new THREE.SphereGeometry(size, 16, 16), material);
            sphere.position.copy(points[i]);
            proteinGroup.add(sphere);

            if (style === 'ball-stick' && i > 0) {
                const cylinder = makeCylinder(points[i - 1], points[i], new THREE.MeshPhongMaterial({ color: 0xe6ecff }));
                proteinGroup.add(cylinder);
            }
        }

        scene.add(proteinGroup);
        computeStats(sequence);
        bioLab.updateSection('protein', {
            sequence,
            style,
            coloring: coloringSelect.value,
            stats: currentStats
        });
    }

    function toggleAnimation() {
        animating = !animating;
        animateBtn.textContent = animating ? 'Stop Animation' : 'Animate Folding';
    }

    function resetView() {
        camera.position.set(20, 15, 26);
        camera.lookAt(0, 0, 0);
        proteinGroup && (proteinGroup.rotation.set(0, 0, 0));
    }

    function hydrate() {
        const state = bioLab.state.protein || {};
        if (state.sequence) sequenceInput.value = state.sequence;
        if (state.style) styleSelect.value = state.style;
        if (state.coloring) coloringSelect.value = state.coloring;
    }

    document.addEventListener('DOMContentLoaded', () => {
        hydrate();
        initScene();
        buildProtein();
        foldBtn?.addEventListener('click', buildProtein);
        animateBtn?.addEventListener('click', toggleAnimation);
        resetBtn?.addEventListener('click', resetView);
        [styleSelect, coloringSelect].forEach(select =>
            select?.addEventListener('change', buildProtein)
        );
    });

    bioLab.registerExporter('proteinVisualizer', () => ({
        stats: currentStats,
        style: styleSelect?.value,
        coloring: coloringSelect?.value,
        sequence: sequenceInput?.value || ''
    }));
})();
