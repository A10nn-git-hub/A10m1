/**
         * STEP 34: Менеджер растительности, сельхозполей и деревьев (InstancedMesh + кастомный GPU Vertex Shader ветра)
         * - Сельскохозяйственные поля: тысячи колосьев пшеницы/кукурузы (InstancedMesh).
         * - Кустарники и скальные валуны на холмах и в горах.
         * - Региональные типы деревьев по биомам:
         *   1. Городские калифорнийские пальмы (City Palms) вдоль бульваров и площадей.
         *   2. Сельские раскидистые дубы (Countryside Oaks) в долинах и холмах.
         *   3. Альпийские хвойные сосны (Mountain Pines) на горных хребтах.
         * - Кастомный GPU-шейдер ветра (onBeforeCompile) для покачивания травы, урожая и листвы.
         */
        class VegetationAndCropsManager {
            constructor(scene, world, terrainManager, physicsMaterials) {
                this.scene = scene;
                this.world = world;
                this.terrainManager = terrainManager;
                this.physicsMaterials = physicsMaterials || { wall: new CANNON.Material('wall') };

                this.treePositions = [];
                this.rockPositions = [];

                this.windMaterials = [];
                this.windUniform = { value: 0.0 };

                this.initMaterials();
                this.buildBushesAndShrubs();
                this.buildScatteredRocks();
                this.buildBiomeTrees();
            }

            injectWindShader(material, swayStrength = 0.35, heightFactor = 0.8) {
                material.userData.uWindTime = this.windUniform;
                material.onBeforeCompile = (shader) => {
                    shader.uniforms.uWindTime = material.userData.uWindTime;
                    shader.vertexShader = 'uniform float uWindTime;\n' + shader.vertexShader;
                    shader.vertexShader = shader.vertexShader.replace(
                        '#include <begin_vertex>',
                        `
                        #include <begin_vertex>
                        float swayFactor = max(0.0, transformed.y * ${heightFactor.toFixed(2)});
                        #ifdef USE_INSTANCING
                            vec4 wWorldPos = instanceMatrix * vec4(position, 1.0);
                            float wAngle = uWindTime * 2.1 + wWorldPos.x * 0.05 + wWorldPos.z * 0.05;
                        #else
                            float wAngle = uWindTime * 2.1 + position.x * 0.05 + position.z * 0.05;
                        #endif
                        float wWave = sin(wAngle) * 0.75 + cos(wAngle * 1.5 + 0.3) * 0.25;
                        transformed.x += wWave * swayFactor * ${swayStrength.toFixed(3)};
                        transformed.z += wWave * 0.6 * swayFactor * ${swayStrength.toFixed(3)};
                        `
                    );
                };
                this.windMaterials.push(material);
                return material;
            }

            initMaterials() {
                // 1. Золотистая спелая пшеница/кукуруза (с ветром)
                this.matWheat = this.injectWindShader(new THREE.MeshStandardMaterial({
                    color: 0xdeb841,
                    roughness: 0.9,
                    metalness: 0.0,
                    side: THREE.DoubleSide
                }), 0.45, 0.9);

                // 2. Зеленые кустарники
                this.matBush = this.injectWindShader(new THREE.MeshStandardMaterial({
                    color: 0x365314,
                    roughness: 0.85,
                    metalness: 0.05
                }), 0.25, 0.5);

                // 3. Скальные гранитные валуны (без ветра)
                this.matRock = new THREE.MeshStandardMaterial({
                    color: 0x78716c,
                    roughness: 0.95,
                    metalness: 0.05
                });

                // 4. Городские парковые лесные деревья (статичные, без раскачивания)
                this.matCityTreeTrunk = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
                this.matCityTreeLeaves = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.85 });

                // 5. Сельские дубы (статичные, пышная зеленая крона)
                this.matOakTrunk = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
                this.matOakLeaves = new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.85 });

                // 6. Хвойные сосны (статичные, темно-зеленая хвоя)
                this.matPineTrunk = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
                this.matPineNeedles = new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.85 });
            }

            buildAgriculturalCropFields() {
                // Конусообразные шипы удалены
            }

            buildBushesAndShrubs() {
                const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.innerWidth <= 1024);
                const count = isMobile ? 40 : 100;
                const bushGeo = new THREE.DodecahedronGeometry(1.2, 1);
                bushGeo.translate(0, 0.8, 0);
                const instMesh = new THREE.InstancedMesh(bushGeo, this.matBush, count);
                instMesh.receiveShadow = true;
                instMesh.castShadow = true;

                const dummy = new THREE.Object3D();
                let idx = 0;

                const isBuildingZone = (bx, bz) => {
                    if (Math.hypot(bx - 0, bz - 60) < 32.0) return true; // Maze Bank elevator lobby
                    if (Math.hypot(bx - 0, bz - 0) < 32.0) return true; // Maze Bank central tower
                    if (Math.hypot(bx - 60, bz - 60) < 30.0) return true; // Hospital
                    if (Math.hypot(bx - (-60), bz - 60) < 30.0) return true; // Police
                    if (Math.hypot(bx - (-60), bz - (-60)) < 26.0) return true; // House 1
                    if (Math.hypot(bx - 60, bz - (-60)) < 26.0) return true; // House 2
                    if (Math.hypot(bx - (-120), bz - 60) < 28.0) return true; // Warehouse
                    if (Math.hypot(bx - 120, bz - 60) < 28.0) return true; // Factory
                    return false;
                };

                for (let i = 0; i < count; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const r = 70.0 + Math.random() * 120.0;
                    const x = Math.cos(angle) * r;
                    const z = Math.sin(angle) * r;

                    // Исключаем появление кустов внутри или рядом со зданиями
                    if (isBuildingZone(x, z)) continue;

                    const groundY = this.terrainManager.getTerrainHeight(x, z);
                    const s = 0.7 + Math.random() * 0.8;

                    dummy.position.set(x, groundY, z);
                    dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
                    dummy.scale.set(s, s * (0.8 + Math.random() * 0.4), s);
                    dummy.updateMatrix();

                    instMesh.setMatrixAt(idx++, dummy.matrix);
                }

                instMesh.count = idx;
                instMesh.instanceMatrix.needsUpdate = true;
                this.scene.add(instMesh);
            }

            buildScatteredRocks() {
                const rockGeo = new THREE.DodecahedronGeometry(1.5, 0);
                const count = 140;
                const instMesh = new THREE.InstancedMesh(rockGeo, this.matRock, count);
                instMesh.receiveShadow = true;
                instMesh.castShadow = true;

                const dummy = new THREE.Object3D();
                let idx = 0;

                const qCyl = new CANNON.Quaternion();
                qCyl.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);

                for (let i = 0; i < count; i++) {
                    // Камни и валуны размещаются ИСКЛЮЧИТЕЛЬНО в горных и лесных секторах за городом (|x| > 140 или |z| > 140)
                    const sideX = (Math.random() > 0.5 ? 1 : -1) * (145.0 + Math.random() * 95.0);
                    const sideZ = (Math.random() > 0.5 ? 1 : -1) * (145.0 + Math.random() * 95.0);
                    const x = (Math.random() > 0.5) ? sideX : (Math.random() - 0.5) * 360.0;
                    const z = (Math.random() > 0.5) ? sideZ : (Math.random() - 0.5) * 360.0;

                    // Защитная зона города: в центре (Downtown/Hospital/Police) камни не появляются
                    if (Math.abs(x) < 130.0 && Math.abs(z) < 130.0) continue;

                    const groundY = this.terrainManager.getTerrainHeight(x, z);
                    const s = 1.0 + Math.random() * 1.5;

                    dummy.position.set(x, groundY + s * 0.45, z);
                    dummy.rotation.set(Math.random() * 0.5, Math.random() * Math.PI * 2, Math.random() * 0.5);
                    dummy.scale.set(s, s * 0.85, s);
                    dummy.updateMatrix();

                    instMesh.setMatrixAt(idx++, dummy.matrix);

                    // Сплошная монолитная вертикальная цилиндрическая коллизия (полное покрытие 3D-модели камня)
                    const rockR = 1.45 * s;
                    const rockH = 1.35 * s;
                    const rockBody = new CANNON.Body({
                        mass: 0,
                        material: this.physicsMaterials.wall,
                        position: new CANNON.Vec3(x, groundY + rockH / 2, z)
                    });
                    rockBody.allowSleep = true;
                    rockBody.sleep();
                    rockBody.addShape(new CANNON.Cylinder(rockR * 0.9, rockR * 1.1, rockH, 10), new CANNON.Vec3(0, 0, 0), qCyl);
                    this.world.addBody(rockBody);

                    this.rockPositions.push({ x, z, radius: rockR });
                }

                instMesh.count = idx;
                instMesh.instanceMatrix.needsUpdate = true;
                this.scene.add(instMesh);
            }

            buildBiomeTrees() {
                // 1. Городские парковые деревья (вид пышных лесных дубов, неподвижные)
                this.buildCityForestTrees();

                // 2. Сельские раскидистые дубы (Countryside Oaks)
                this.buildCountryOaks();
                const count = isMobile ? 40 : 100;
                const bushGeo = new THREE.DodecahedronGeometry(1.2, 1);
                bushGeo.translate(0, 0.8, 0);
                const instMesh = new THREE.InstancedMesh(bushGeo, this.matBush, count);
                instMesh.receiveShadow = true;
                instMesh.castShadow = true;

                const dummy = new THREE.Object3D();
                let idx = 0;

                const isBuildingZone = (bx, bz) => {
                    if (Math.hypot(bx - 0, bz - 60) < 32.0) return true; // Maze Bank elevator lobby
                    if (Math.hypot(bx - 0, bz - 0) < 32.0) return true; // Maze Bank central tower
                    if (Math.hypot(bx - 60, bz - 60) < 30.0) return true; // Hospital
                    if (Math.hypot(bx - (-60), bz - 60) < 30.0) return true; // Police
                    if (Math.hypot(bx - (-60), bz - (-60)) < 26.0) return true; // House 1
                    if (Math.hypot(bx - 60, bz - (-60)) < 26.0) return true; // House 2
                    if (Math.hypot(bx - (-120), bz - 60) < 28.0) return true; // Warehouse
                    if (Math.hypot(bx - 120, bz - 60) < 28.0) return true; // Factory
                    return false;
                };

                for (let i = 0; i < count; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const r = 70.0 + Math.random() * 120.0;
                    const x = Math.cos(angle) * r;
                    const z = Math.sin(angle) * r;

                    // Исключаем появление кустов внутри или рядом со зданиями
                    if (isBuildingZone(x, z)) continue;

                    const groundY = this.terrainManager.getTerrainHeight(x, z);
                    const s = 0.7 + Math.random() * 0.8;

                    dummy.position.set(x, groundY, z);
                    dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
                    dummy.scale.set(s, s * (0.8 + Math.random() * 0.4), s);
                    dummy.updateMatrix();

                    instMesh.setMatrixAt(idx++, dummy.matrix);
                }

                instMesh.count = idx;
                instMesh.instanceMatrix.needsUpdate = true;
                this.scene.add(instMesh);
            }

            buildScatteredRocks() {
                const rockGeo = new THREE.DodecahedronGeometry(1.5, 0);
                const count = 140;
                const instMesh = new THREE.InstancedMesh(rockGeo, this.matRock, count);
                instMesh.receiveShadow = true;
                instMesh.castShadow = true;

                const dummy = new THREE.Object3D();
                let idx = 0;

                const qCyl = new CANNON.Quaternion();
                qCyl.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);

                for (let i = 0; i < count; i++) {
                    // Камни и валуны размещаются ИСКЛЮЧИТЕЛЬНО в горных и лесных секторах за городом (|x| > 140 или |z| > 140)
                    const sideX = (Math.random() > 0.5 ? 1 : -1) * (145.0 + Math.random() * 95.0);
                    const sideZ = (Math.random() > 0.5 ? 1 : -1) * (145.0 + Math.random() * 95.0);
                    const x = (Math.random() > 0.5) ? sideX : (Math.random() - 0.5) * 360.0;
                    const z = (Math.random() > 0.5) ? sideZ : (Math.random() - 0.5) * 360.0;

                    // Защитная зона города: в центре (Downtown/Hospital/Police) камни не появляются
                    if (Math.abs(x) < 130.0 && Math.abs(z) < 130.0) continue;

                    const groundY = this.terrainManager.getTerrainHeight(x, z);
                    const s = 1.0 + Math.random() * 1.5;

                    dummy.position.set(x, groundY + s * 0.45, z);
                    dummy.rotation.set(Math.random() * 0.5, Math.random() * Math.PI * 2, Math.random() * 0.5);
                    dummy.scale.set(s, s * 0.85, s);
                    dummy.updateMatrix();

                    instMesh.setMatrixAt(idx++, dummy.matrix);

                    // Сплошная монолитная вертикальная цилиндрическая коллизия (полное покрытие 3D-модели камня)
                    const rockR = 1.45 * s;
                    const rockH = 1.35 * s;
                    const rockBody = new CANNON.Body({
                        mass: 0,
                        material: this.physicsMaterials.wall,
                        position: new CANNON.Vec3(x, groundY + rockH / 2, z)
                    });
                    rockBody.allowSleep = true;
                    rockBody.sleep();
                    rockBody.addShape(new CANNON.Cylinder(rockR * 0.9, rockR * 1.1, rockH, 10), new CANNON.Vec3(0, 0, 0), qCyl);
                    this.world.addBody(rockBody);

                    this.rockPositions.push({ x, z, radius: rockR });
                }

                instMesh.count = idx;
                instMesh.instanceMatrix.needsUpdate = true;
                this.scene.add(instMesh);
            }

            buildBiomeTrees() {
                // 1. Городские парковые деревья (вид пышных лесных дубов, неподвижные)
                this.buildCityForestTrees();

                // 2. Сельские раскидистые дубы (Countryside Oaks)
                this.buildCountryOaks();

                // 3. Альпийские сосны на северных хребтах (Mountain Pines)
                this.buildMountainPines();
            }

            buildCityForestTrees() {
                const count = 28;

                const trunkGeo = new THREE.CylinderGeometry(0.42, 0.65, 6.8, 7);
                trunkGeo.translate(0, 3.4, 0);
                const trunkMesh = new THREE.InstancedMesh(trunkGeo, this.matCityTreeTrunk, count);
                trunkMesh.castShadow = true;

                const forkGeo = new THREE.CylinderGeometry(0.95, 0.45, 2.2, 7);
                forkGeo.translate(0, 7.0, 0);
                const forkMesh = new THREE.InstancedMesh(forkGeo, this.matCityTreeTrunk, count);
                forkMesh.castShadow = true;

                const crownLayers = [];
                const c1 = new THREE.DodecahedronGeometry(4.2, 1);
                c1.translate(0, 7.6, 0);
                crownLayers.push(new THREE.InstancedMesh(c1, this.matCityTreeLeaves, count));

                const c2 = new THREE.SphereGeometry(3.2, 7, 6);
                c2.translate(0.4, 10.0, 0.3);
                crownLayers.push(new THREE.InstancedMesh(c2, this.matCityTreeLeaves, count));

                const c3 = new THREE.DodecahedronGeometry(2.4, 1);
                c3.translate(-0.3, 11.8, -0.2);
                crownLayers.push(new THREE.InstancedMesh(c3, this.matCityTreeLeaves, count));

                const c4 = new THREE.SphereGeometry(2.0, 6, 5);
                c4.translate(2.2, 8.4, 0.9);
                crownLayers.push(new THREE.InstancedMesh(c4, this.matCityTreeLeaves, count));

                for (const m of crownLayers) m.castShadow = true;

                const dummy = new THREE.Object3D();
                let idx = 0;

                const cityTreePositions = [
                    { x: -38, z: -38 }, { x: 38, z: -38 }, { x: -38, z: 38 }, { x: 38, z: 38 },
                    { x: -75, z: 0 }, { x: 75, z: 0 }, { x: 0, z: -75 }, { x: 0, z: 75 },
                    { x: -95, z: -38 }, { x: 95, z: -38 }, { x: -95, z: 38 }, { x: 95, z: 38 },
                    { x: -38, z: -95 }, { x: 38, z: -95 }, { x: -38, z: 95 }, { x: 38, z: 95 }
                ];

                for (let i = 0; i < cityTreePositions.length && idx < count; i++) {
                    const pos = cityTreePositions[i];
                    dummy.position.set(pos.x, 0, pos.z);
                    const s = 0.95 + Math.random() * 0.2;
                    dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
                    dummy.scale.set(s, s, s);
                    dummy.updateMatrix();

                    trunkMesh.setMatrixAt(idx, dummy.matrix);
                    forkMesh.setMatrixAt(idx, dummy.matrix);
                    for (const m of crownLayers) m.setMatrixAt(idx, dummy.matrix);
                    idx++;

                    const treeBody = new CANNON.Body({
                        mass: 0,
                        material: this.physicsMaterials.wall,
                        position: new CANNON.Vec3(pos.x, 3.4, pos.z)
                    });
                    const qCylTree = new CANNON.Quaternion();
                    qCylTree.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
                    treeBody.addShape(new CANNON.Cylinder(0.65, 0.85, 6.8, 10), new CANNON.Vec3(0, 0, 0), qCylTree);
                    this.world.addBody(treeBody);

                    this.treePositions.push({ x: pos.x, y: 0, z: pos.z, perchY: 4.8, type: 'city_tree' });
                }

                while (idx < count) {
                    dummy.position.set(0, -9999, 0); dummy.updateMatrix();
                    trunkMesh.setMatrixAt(idx, dummy.matrix);
                    forkMesh.setMatrixAt(idx, dummy.matrix);
                    for (const m of crownLayers) m.setMatrixAt(idx, dummy.matrix);
                    idx++;
                }

                trunkMesh.instanceMatrix.needsUpdate = true;
                forkMesh.instanceMatrix.needsUpdate = true;
                this.scene.add(trunkMesh);
                this.scene.add(forkMesh);
                for (const m of crownLayers) {
                    m.instanceMatrix.needsUpdate = true;
                    this.scene.add(m);
                }
            }

            buildCountryOaks() {
                const count = 30;

                const trunkGeo = new THREE.CylinderGeometry(0.5, 0.85, 7.5, 7);
                trunkGeo.translate(0, 3.75, 0);
                const trunkMesh = new THREE.InstancedMesh(trunkGeo, this.matOakTrunk, count);
                trunkMesh.castShadow = true;

                const forkGeo = new THREE.CylinderGeometry(1.2, 0.55, 2.5, 7);
                forkGeo.translate(0, 7.8, 0);
                const forkMesh = new THREE.InstancedMesh(forkGeo, this.matOakTrunk, count);
                forkMesh.castShadow = true;

                const crownLayers = [];
                const c1 = new THREE.DodecahedronGeometry(5.2, 1);
                c1.translate(0, 8.5, 0);
                crownLayers.push(new THREE.InstancedMesh(c1, this.matOakLeaves, count));

                const c2 = new THREE.SphereGeometry(4.0, 7, 6);
                c2.translate(0.5, 11.5, 0.4);
                crownLayers.push(new THREE.InstancedMesh(c2, this.matOakLeaves, count));

                const c3 = new THREE.DodecahedronGeometry(3.0, 1);
                c3.translate(-0.4, 13.5, -0.3);
                crownLayers.push(new THREE.InstancedMesh(c3, this.matOakLeaves, count));

                const c4 = new THREE.SphereGeometry(2.6, 6, 5);
                c4.translate(2.8, 9.5, 1.2);
                crownLayers.push(new THREE.InstancedMesh(c4, this.matOakLeaves, count));

                const c5 = new THREE.SphereGeometry(2.4, 6, 5);
                c5.translate(-2.4, 10.2, -1.5);
                crownLayers.push(new THREE.InstancedMesh(c5, this.matOakLeaves, count));

                for (const m of crownLayers) m.castShadow = true;

                const dummy = new THREE.Object3D();
                let idx = 0;

                for (let i = 0; i < count; i++) {
                    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
                    const r = 260.0 + Math.random() * 180.0;
                    const x = Math.cos(angle) * r;
                    const z = Math.sin(angle) * r;

                    const groundY = this.terrainManager.getTerrainHeight(x, z);
                    const s = 0.85 + Math.random() * 0.4;

                    dummy.position.set(x, groundY, z);
                    dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
                    dummy.scale.set(s, s * (0.9 + Math.random() * 0.2), s);
                    dummy.updateMatrix();

                    trunkMesh.setMatrixAt(idx, dummy.matrix);
                    forkMesh.setMatrixAt(idx, dummy.matrix);
                    for (const m of crownLayers) m.setMatrixAt(idx, dummy.matrix);
                    idx++;

                    const treeBody = new CANNON.Body({
                        mass: 0,
                        material: this.physicsMaterials.wall,
                        position: new CANNON.Vec3(x, groundY + 3.75, z)
                    });
                    treeBody.allowSleep = true;
                    treeBody.sleep();
                    treeBody.addShape(new CANNON.Cylinder(0.55 * s, 0.85 * s, 7.5 * s, 8));
                    this.world.addBody(treeBody);

                    this.treePositions.push({ x, y: groundY, z, perchY: groundY + 6.2, type: 'oak' });
                }

                trunkMesh.instanceMatrix.needsUpdate = true;
                forkMesh.instanceMatrix.needsUpdate = true;
                this.scene.add(trunkMesh);
                this.scene.add(forkMesh);
                for (const m of crownLayers) {
                    m.instanceMatrix.needsUpdate = true;
                    this.scene.add(m);
                }
            }

            buildMountainPines() {
                const count = 30;

                const trunkGeo = new THREE.CylinderGeometry(0.35, 0.65, 16.0, 7);
                trunkGeo.translate(0, 8.0, 0);
                const trunkMesh = new THREE.InstancedMesh(trunkGeo, this.matPineTrunk, count);
                trunkMesh.castShadow = true;

                const pineLayers = [];
                const p1 = new THREE.ConeGeometry(6.0, 4.5, 7);
                p1.translate(0, 8.0, 0);
                pineLayers.push(new THREE.InstancedMesh(p1, this.matPineNeedles, count));

                const p2 = new THREE.ConeGeometry(4.5, 4.0, 7);
                p2.translate(0, 11.5, 0);
                pineLayers.push(new THREE.InstancedMesh(p2, this.matPineNeedles, count));

                const p3 = new THREE.ConeGeometry(3.2, 3.5, 7);
                p3.translate(0, 14.5, 0);
                pineLayers.push(new THREE.InstancedMesh(p3, this.matPineNeedles, count));

                const p4 = new THREE.ConeGeometry(1.8, 3.0, 6);
                p4.translate(0, 17.5, 0);
                pineLayers.push(new THREE.InstancedMesh(p4, this.matPineNeedles, count));

                for (const m of pineLayers) m.castShadow = true;

                const dummy = new THREE.Object3D();
                let idx = 0;

                for (let i = 0; i < count; i++) {
                    const x = (Math.random() - 0.5) * 600.0;
                    const z = -320.0 - Math.random() * 200.0;
                    const groundY = this.terrainManager.getTerrainHeight(x, z);

                    const s = 0.85 + Math.random() * 0.5;

                    dummy.position.set(x, groundY, z);
                    dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
                    dummy.scale.set(s, s * (0.9 + Math.random() * 0.2), s);
                    dummy.updateMatrix();

                    trunkMesh.setMatrixAt(idx, dummy.matrix);
                    for (const m of pineLayers) m.setMatrixAt(idx, dummy.matrix);
                    idx++;

                    const treeBody = new CANNON.Body({
                        mass: 0,
                        material: this.physicsMaterials.wall,
                        position: new CANNON.Vec3(x, groundY + 8.0, z)
                    });
                    treeBody.allowSleep = true;
                    treeBody.sleep();
                    treeBody.addShape(new CANNON.Cylinder(0.4 * s, 0.65 * s, 16.0 * s, 8));
                    this.world.addBody(treeBody);

                    this.treePositions.push({ x, y: groundY, z, perchY: groundY + 7.5, type: 'pine' });
                }

                trunkMesh.instanceMatrix.needsUpdate = true;
                this.scene.add(trunkMesh);
                for (const m of pineLayers) {
                    m.instanceMatrix.needsUpdate = true;
                    this.scene.add(m);
                }
            }

            update(deltaTime) {
                this.windUniform.value += deltaTime;
            }
        }
