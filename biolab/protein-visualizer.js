(() => {
    const container = document.getElementById('protein-3d-container');
    const styleSelect = document.getElementById('protein-style');
    const coloringSelect = document.getElementById('protein-coloring');
    const sequenceInput = document.getElementById('protein-sequence');
    const phInput = document.getElementById('protein-ph');
    const analyzeBtn = document.getElementById('protein-fold');
    const animateBtn = document.getElementById('protein-animate');
    const resetBtn = document.getElementById('protein-reset-view');

    const residuesEl = document.getElementById('protein-residues');
    const massEl = document.getElementById('protein-mass');
    const piEl = document.getElementById('protein-pi');
    const gravyEl = document.getElementById('protein-gravy');
    const chargeEl = document.getElementById('protein-charge');
    const hydrophobicEl = document.getElementById('protein-hydrophobic');
    const insightsEl = document.getElementById('protein-insights');

    let scene;
    let camera;
    let renderer;
    let proteinGroup;
    let animating = false;
    let currentStats = {};

    const hydrophobicResidues = new Set(['A', 'I', 'L', 'M', 'F', 'W', 'V', 'P', 'G']);
    const positiveResidues = new Set(['K', 'R', 'H']);
    const negativeResidues = new Set(['D', 'E']);

    function ensureThree() {
        if (typeof THREE === 'undefined') {
            container.innerHTML =
                '<p>The optional Three.js trace could not load. Sequence analysis still works.</p>';
            return false;
        }
        return true;
    }

    function dimensions() {
        return {
            width: Math.max(320, container.clientWidth || 760),
            height: Math.max(320, container.clientHeight || 460)
        };
    }

    function initScene() {
        if (!ensureThree() || renderer) return;
        const { width, height } = dimensions();
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.set(20, 15, 26);
        camera.lookAt(0, 0, 0);

        const ambient = new THREE.AmbientLight(0xffffff, 0.62);
        const directional = new THREE.DirectionalLight(0xffffff, 0.9);
        directional.position.set(10, 20, 10);
        scene.add(ambient, directional);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        container.appendChild(renderer.domElement);

        window.addEventListener('resize', handleResize);
        enableRotation();
        renderLoop();
    }

    function handleResize() {
        if (!renderer || !camera) return;
        const { width, height } = dimensions();
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
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
            proteinGroup.rotation.y += (event.clientX - previous.x) * 0.01;
            proteinGroup.rotation.x += (event.clientY - previous.y) * 0.01;
            previous = { x: event.clientX, y: event.clientY };
        });
    }

    function renderLoop() {
        if (proteinGroup && animating) proteinGroup.rotation.y += 0.008;
        renderer?.render(scene, camera);
        requestAnimationFrame(renderLoop);
    }

    function sequencePoints(length) {
        const points = [];
        const renderedLength = Math.min(length, 400);
        for (let i = 0; i < renderedLength; i++) {
            const progress = i / Math.max(1, renderedLength - 1);
            const angle = progress * Math.PI * 8;
            const radius = 5.5 + Math.sin(progress * Math.PI * 5) * 1.7;
            points.push(
                new THREE.Vector3(
                    Math.cos(angle) * radius,
                    (progress - 0.5) * 18,
                    Math.sin(angle) * radius
                )
            );
        }
        return points;
    }

    function colorForResidue(residue, index, length) {
        const scheme = coloringSelect.value;
        if (scheme === 'hydrophobic') {
            return hydrophobicResidues.has(residue) ? 0x5ad1a3 : 0x6d8bff;
        }
        if (scheme === 'charge') {
            if (positiveResidues.has(residue)) return 0x6dc7ff;
            if (negativeResidues.has(residue)) return 0xff7b7b;
            return 0xe6ecff;
        }
        return new THREE.Color().setHSL(index / Math.max(1, length), 0.68, 0.62);
    }

    function makeCylinder(pointA, pointB, material) {
        const direction = new THREE.Vector3().subVectors(pointB, pointA);
        const geometry = new THREE.CylinderGeometry(
            0.11,
            0.11,
            direction.length(),
            8,
            1,
            true
        );
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(pointA).add(pointB).multiplyScalar(0.5);
        mesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direction.clone().normalize()
        );
        return mesh;
    }

    function disposeGroup() {
        if (!proteinGroup) return;
        proteinGroup.traverse(object => {
            object.geometry?.dispose();
            if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
            else object.material?.dispose();
        });
        scene.remove(proteinGroup);
    }

    function updateAnalysis(stats, pH) {
        currentStats = {
            residues: stats.residues,
            molecularWeightKDa: Number(stats.molecularWeight.toFixed(2)),
            estimatedPI: Number(stats.pI.toFixed(2)),
            gravy: Number(stats.gravy.toFixed(3)),
            netCharge: Number(stats.netCharge.toFixed(2)),
            hydrophobicPercent: Number(stats.hydrophobicPercent.toFixed(1)),
            aromaticityPercent: Number(stats.aromaticity.toFixed(1)),
            transmembraneWindows: stats.transmembraneWindows
        };

        residuesEl.textContent = stats.residues;
        massEl.textContent = `${stats.molecularWeight.toFixed(2)} kDa`;
        piEl.textContent = stats.pI.toFixed(2);
        gravyEl.textContent = stats.gravy.toFixed(3);
        chargeEl.textContent = `${stats.netCharge >= 0 ? '+' : ''}${stats.netCharge.toFixed(2)}`;
        hydrophobicEl.textContent = `${stats.hydrophobicPercent.toFixed(1)}%`;

        const membraneText = stats.transmembraneWindows.length
            ? `${stats.transmembraneWindows.length} hydrophobic 19-residue window(s) cross the simple membrane-screen threshold.`
            : 'No 19-residue window crosses the simple membrane-screen threshold.';
        insightsEl.innerHTML = `
            <p><strong>At pH ${Number(pH).toFixed(1)}:</strong> estimated net charge is ${stats.netCharge.toFixed(2)}.</p>
            <p><strong>Aromatic residues:</strong> ${stats.aromaticity.toFixed(1)}%. ${membraneText}</p>
            <p class="muted">Mass, pI, charge, GRAVY, and the membrane screen are sequence-derived estimates. Post-translational modifications and solution conditions are not modeled.</p>
        `;
    }

    function buildTrace(sequence) {
        if (!ensureThree()) return;
        initScene();
        disposeGroup();
        proteinGroup = new THREE.Group();

        const points = sequencePoints(sequence.length);
        const renderedSequence = sequence.slice(0, points.length);
        const style = styleSelect.value;

        if (style === 'ribbon' && points.length > 1) {
            const curve = new THREE.CatmullRomCurve3(points);
            const geometry = new THREE.TubeGeometry(
                curve,
                Math.max(30, points.length * 2),
                0.35,
                10,
                false
            );
            const material = new THREE.MeshPhongMaterial({
                color: 0x6bf9e2,
                opacity: 0.82,
                transparent: true
            });
            proteinGroup.add(new THREE.Mesh(geometry, material));
        }

        points.forEach((point, index) => {
            const residue = renderedSequence[index];
            const material = new THREE.MeshPhongMaterial({
                color: colorForResidue(residue, index, points.length)
            });
            const size = style === 'space-fill' ? 0.55 : 0.3;
            const sphere = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 12), material);
            sphere.position.copy(point);
            proteinGroup.add(sphere);

            if (style === 'ball-stick' && index > 0) {
                proteinGroup.add(
                    makeCylinder(
                        points[index - 1],
                        point,
                        new THREE.MeshPhongMaterial({ color: 0xe6ecff })
                    )
                );
            }
        });

        scene.add(proteinGroup);
        handleResize();
    }

    function analyzeSequence() {
        const sequence = BioUtils.sanitizeProtein(sequenceInput.value);
        const pH = Math.max(0, Math.min(14, Number(phInput.value) || 7));
        sequenceInput.value = sequence;
        phInput.value = pH;

        if (!sequence) {
            insightsEl.innerHTML = '<p>Enter a sequence using the 20 standard amino-acid codes.</p>';
            return;
        }

        const stats = BioUtils.analyzeProtein(sequence, pH);
        updateAnalysis(stats, pH);
        buildTrace(sequence);
        bioLab.updateSection('protein', {
            sequence,
            style: styleSelect.value,
            coloring: coloringSelect.value,
            pH,
            stats: currentStats
        });
    }

    function toggleAnimation() {
        animating = !animating;
        animateBtn.textContent = animating ? 'Stop Rotation' : 'Rotate Trace';
    }

    function resetView() {
        if (!camera) return;
        camera.position.set(20, 15, 26);
        camera.lookAt(0, 0, 0);
        proteinGroup?.rotation.set(0, 0, 0);
    }

    function hydrate() {
        const state = bioLab.state.protein || {};
        if (state.sequence) sequenceInput.value = state.sequence;
        if (state.style) styleSelect.value = state.style;
        if (state.coloring) coloringSelect.value = state.coloring;
        if (typeof state.pH === 'number') phInput.value = state.pH;
    }

    document.addEventListener('DOMContentLoaded', () => {
        hydrate();
        analyzeSequence();
        analyzeBtn?.addEventListener('click', analyzeSequence);
        animateBtn?.addEventListener('click', toggleAnimation);
        resetBtn?.addEventListener('click', resetView);
        [styleSelect, coloringSelect, phInput].forEach(control =>
            control?.addEventListener('change', analyzeSequence)
        );
    });

    document.addEventListener('biolab:modulechange', event => {
        if (event.detail?.moduleId === 'protein-visualizer') {
            requestAnimationFrame(handleResize);
        }
    });

    bioLab.registerExporter('proteinSequenceExplorer', () => ({
        stats: currentStats,
        style: styleSelect?.value,
        coloring: coloringSelect?.value,
        pH: Number(phInput?.value || 7),
        sequence: sequenceInput?.value || '',
        visualization: 'conceptual sequence trace; not a predicted structure'
    }));
})();
