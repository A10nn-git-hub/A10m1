/**
 * VegetationAndCropsManager - Менеджер растительности, сельхозполей и деревьев
 */
class VegetationAndCropsManager {
    constructor(scene, world, terrainManager, physicsMaterials) {
        this.scene = scene;
        this.world = world;
        this.terrainManager = terrainManager;
        this.physicsMaterials = physicsMaterials || { wall: new CANNON.Material('wall') };

        this.treePositions = [];
        this.fallingTrees = [];
        this.bushPositions = [];
        this.rockPositions = [];

        this.bushInstMesh = null;
        this.rockInstMesh = null;

        this.windMaterials = [];
        this.windUniform = { value: 0.0 };

        this.initMaterials();
        this.buildBushesAndShrubs();
        this.buildScatteredRocks();
        this.buildBiomeTrees();
    }

    checkFoliageAt(pos, isClimbingTree = false) {
        if (!pos) return null;
        if (isClimbingTree) {
            return { inFoliage: true, type: 'tree_climb', position: pos };
        }
        if (this.bushPositions) {
            for (let i = 0; i < this.bushPositions.length; i++) {
                const b = this.bushPositions[i];
                const d = Math.hypot(pos.x - b.x, pos.z - b.z);
                if (d <= (b.radius || 2.2)) {
                    return { inFoliage: true, type: 'bush', position: b, dist: d };
                }
            }
        }
        if (this.treePositions) {
            for (let i = 0; i < this.treePositions.length; i++) {
                const t = this.treePositions[i];
                if (t.isFallen) continue;
                const d = Math.hypot(pos.x - t.x, pos.z - t.z);
                if (d <= (t.radius || 3.8)) {
                    return { inFoliage: true, type: 'tree', position: t, dist: d };
                }
            }
        }
        return null;
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

        // 4. Городские парковые деревья
        this.matCityTreeTrunk = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
        this.matCityTreeLeaves = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.85 });

        // 5. Сельские дубы
        this.matOakTrunk = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
        this.matOakLeaves = new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.85 });

        // 6. Хвойные сосны
        this.matPineTrunk = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
        this.matPineNeedles = new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.85 });
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
            if (Math.hypot(bx - 0, bz - 60) < 42.0) return true;
            if (Math.hypot(bx - 0, bz - 0) < 32.0) return true;
            if (Math.hypot(bx - 60, bz - 60) < 30.0) return true;
            if (Math.hypot(bx - (-60), bz - 60) < 30.0) return true;
            if (Math.hypot(bx - (-60), bz - (-60)) < 26.0) return true;
            if (Math.hypot(bx - 60, bz - (-60)) < 26.0) return true;
            if (Math.hypot(bx - (-120), bz - 60) < 28.0) return true;
            if (Math.hypot(bx - 120, bz - 60) < 28.0) return true;
            return false;
        };

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = 70.0 + Math.random() * 120.0;
            const x = Math.cos(angle) * r;
            const z = Math.sin(angle) * r;

            if (isBuildingZone(x, z)) continue;

            const groundY = this.terrainManager.getTerrainHeight(x, z);
            const s = 0.7 + Math.random() * 0.8;

            dummy.position.set(x, groundY, z);
            dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
            dummy.scale.set(s, s * (0.8 + Math.random() * 0.4), s);
            dummy.updateMatrix();

            instMesh.setMatrixAt(idx++, dummy.matrix);
            this.bushPositions.push({ x, y: groundY, z, radius: 2.2 * s });
        }

        instMesh.count = idx;
        instMesh.instanceMatrix.needsUpdate = true;
        this.bushInstMesh = instMesh;
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
            const sideX = (Math.random() > 0.5 ? 1 : -1) * (145.0 + Math.random() * 95.0);
            const sideZ = (Math.random() > 0.5 ? 1 : -1) * (145.0 + Math.random() * 95.0);
            const x = (Math.random() > 0.5) ? sideX : (Math.random() - 0.5) * 360.0;
            const z = (Math.random() > 0.5) ? sideZ : (Math.random() - 0.5) * 360.0;

            if (Math.abs(x) < 130.0 && Math.abs(z) < 130.0) continue;

            const groundY = this.terrainManager.getTerrainHeight(x, z);
            const s = 1.0 + Math.random() * 1.5;

            dummy.position.set(x, groundY + s * 0.45, z);
            dummy.rotation.set(Math.random() * 0.5, Math.random() * Math.PI * 2, Math.random() * 0.5);
            dummy.scale.set(s, s * 0.85, s);
            dummy.updateMatrix();

            instMesh.setMatrixAt(idx++, dummy.matrix);

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
        this.rockInstMesh = instMesh;
        this.scene.add(instMesh);
    }

    setEcoMode(isEco) {
        if (this.bushInstMesh) this.bushInstMesh.visible = !isEco;
        if (this.rockInstMesh) this.rockInstMesh.visible = !isEco;
    }

    buildBiomeTrees() {
        this.fallingTrees = [];
        this.buildCityForestTrees();
        this.buildCountryOaks();
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

        const allInst = [trunkMesh, forkMesh, ...crownLayers];
        const dummy = new THREE.Object3D();
        let idx = 0;

        const cityTreePositions = [
            { x: -38, z: -38 }, { x: 38, z: -38 }, { x: -38, z: 38 }, { x: 38, z: 38 },
            { x: -75, z: 0 }, { x: 75, z: 0 }, { x: 0, z: -75 }, { x: 0, z: 115 },
            { x: -95, z: -38 }, { x: 95, z: -38 }, { x: -95, z: 38 }, { x: 95, z: 38 },
            { x: -38, z: -95 }, { x: 38, z: -95 }, { x: -38, z: 95 }, { x: 38, z: 95 }
        ];

        for (let i = 0; i < cityTreePositions.length && idx < count; i++) {
            const pos = cityTreePositions[i];
            const s = 0.95 + Math.random() * 0.2;
            const rotY = Math.random() * Math.PI * 2;
            dummy.position.set(pos.x, 0, pos.z);
            dummy.rotation.set(0, rotY, 0);
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();

            trunkMesh.setMatrixAt(idx, dummy.matrix);
            forkMesh.setMatrixAt(idx, dummy.matrix);
            for (const m of crownLayers) m.setMatrixAt(idx, dummy.matrix);

            const treeBody = new CANNON.Body({
                mass: 0,
                material: this.physicsMaterials.wall,
                position: new CANNON.Vec3(pos.x, 3.4, pos.z)
            });
            const qCylTree = new CANNON.Quaternion();
            qCylTree.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
            treeBody.addShape(new CANNON.Cylinder(0.65, 0.85, 6.8, 10), new CANNON.Vec3(0, 0, 0), qCylTree);
            this.world.addBody(treeBody);

            this.treePositions.push({
                id: this.treePositions.length,
                x: pos.x,
                y: 0,
                z: pos.z,
                perchY: 7.4 * s,
                type: 'city_tree',
                s: s,
                rotY: rotY,
                body: treeBody,
                instancedMeshes: allInst,
                instIdx: idx,
                isFallen: false,
                fallProgress: 0.0
            });

            idx++;
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

        const allInst = [trunkMesh, forkMesh, ...crownLayers];
        const dummy = new THREE.Object3D();
        let idx = 0;

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
            const r = 260.0 + Math.random() * 180.0;
            const x = Math.cos(angle) * r;
            const z = Math.sin(angle) * r;

            const groundY = this.terrainManager.getTerrainHeight(x, z);
            const s = 0.85 + Math.random() * 0.4;
            const rotY = Math.random() * Math.PI * 2;

            dummy.position.set(x, groundY, z);
            dummy.rotation.set(0, rotY, 0);
            dummy.scale.set(s, s * (0.9 + Math.random() * 0.2), s);
            dummy.updateMatrix();

            trunkMesh.setMatrixAt(idx, dummy.matrix);
            forkMesh.setMatrixAt(idx, dummy.matrix);
            for (const m of crownLayers) m.setMatrixAt(idx, dummy.matrix);

            const treeBody = new CANNON.Body({
                mass: 0,
                material: this.physicsMaterials.wall,
                position: new CANNON.Vec3(x, groundY + 3.75, z)
            });
            treeBody.allowSleep = true;
            treeBody.sleep();
            treeBody.addShape(new CANNON.Cylinder(0.55 * s, 0.85 * s, 7.5 * s, 8));
            this.world.addBody(treeBody);

            this.treePositions.push({
                id: this.treePositions.length,
                x,
                y: groundY,
                z,
                perchY: groundY + 8.5 * s,
                type: 'oak',
                s: s,
                rotY: rotY,
                body: treeBody,
                instancedMeshes: allInst,
                instIdx: idx,
                isFallen: false,
                fallProgress: 0.0
            });

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

        const allInst = [trunkMesh, ...pineLayers];
        const dummy = new THREE.Object3D();
        let idx = 0;

        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * 600.0;
            const z = -320.0 - Math.random() * 200.0;
            const groundY = this.terrainManager.getTerrainHeight(x, z);

            const s = 0.85 + Math.random() * 0.5;
            const rotY = Math.random() * Math.PI * 2;

            dummy.position.set(x, groundY, z);
            dummy.rotation.set(0, rotY, 0);
            dummy.scale.set(s, s * (0.9 + Math.random() * 0.2), s);
            dummy.updateMatrix();

            trunkMesh.setMatrixAt(idx, dummy.matrix);
            for (const m of pineLayers) m.setMatrixAt(idx, dummy.matrix);

            const treeBody = new CANNON.Body({
                mass: 0,
                material: this.physicsMaterials.wall,
                position: new CANNON.Vec3(x, groundY + 8.0, z)
            });
            treeBody.allowSleep = true;
            treeBody.sleep();
            treeBody.addShape(new CANNON.Cylinder(0.4 * s, 0.65 * s, 16.0 * s, 8));
            this.world.addBody(treeBody);

            this.treePositions.push({
                id: this.treePositions.length,
                x,
                y: groundY,
                z,
                perchY: groundY + 11.2 * s,
                type: 'pine',
                s: s,
                rotY: rotY,
                body: treeBody,
                instancedMeshes: allInst,
                instIdx: idx,
                isFallen: false,
                fallProgress: 0.0
            });

            idx++;
        }

        trunkMesh.instanceMatrix.needsUpdate = true;
        this.scene.add(trunkMesh);
        for (const m of pineLayers) {
            m.instanceMatrix.needsUpdate = true;
            this.scene.add(m);
        }
    }

    toppleTree(tree, impactVelocity, isRemote = false) {
        if (!tree || tree.isFallen) return;
        tree.isFallen = true;
        tree.fallProgress = 0.0;

        // 1. Удаляем статическое физическое тело
        if (tree.body) {
            this.world.removeBody(tree.body);
            tree.body = null;
        }

        // 2. Скрываем инстанс дерева
        if (tree.instancedMeshes && tree.instIdx !== undefined) {
            const hideDummy = new THREE.Object3D();
            hideDummy.position.set(0, -9999, 0);
            hideDummy.updateMatrix();
            for (let i = 0; i < tree.instancedMeshes.length; i++) {
                const inst = tree.instancedMeshes[i];
                inst.setMatrixAt(tree.instIdx, hideDummy.matrix);
                inst.instanceMatrix.needsUpdate = true;
            }
        }

        // 3. Вычисляем вектор опрокидывания
        let vx = impactVelocity ? impactVelocity.x : 0;
        let vz = impactVelocity ? impactVelocity.z : 1;
        let spd = Math.hypot(vx, vz);
        if (spd < 0.1) { vx = 0; vz = 1; spd = 1; }
        tree.fallDirX = vx / spd;
        tree.fallDirZ = vz / spd;

        // 4. Создаем 3D-группу падающего дерева
        const group = new THREE.Group();
        group.position.set(tree.x, tree.y, tree.z);
        const s = tree.s || 1.0;

        if (tree.type === 'city_tree' || tree.type === 'oak') {
            const trunkMat = (tree.type === 'city_tree') ? this.matCityTreeTrunk : this.matOakTrunk;
            const leavesMat = (tree.type === 'city_tree') ? this.matCityTreeLeaves : this.matOakLeaves;
            const trunkH = (tree.type === 'city_tree') ? 6.8 : 7.5;

            const trunkMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.45 * s, 0.7 * s, trunkH * s, 8), trunkMat);
            trunkMesh.position.y = (trunkH / 2) * s;
            group.add(trunkMesh);

            const crownMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(4.5 * s, 1), leavesMat);
            crownMesh.position.y = (trunkH + 2.0) * s;
            group.add(crownMesh);
        } else {
            // Хвойная сосна
            const trunkMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * s, 0.65 * s, 16.0 * s, 8), this.matPineTrunk);
            trunkMesh.position.y = 8.0 * s;
            group.add(trunkMesh);

            const cone1 = new THREE.Mesh(new THREE.ConeGeometry(5.5 * s, 5.0 * s, 7), this.matPineNeedles);
            cone1.position.y = 8.5 * s;
            group.add(cone1);

            const cone2 = new THREE.Mesh(new THREE.ConeGeometry(3.8 * s, 4.5 * s, 7), this.matPineNeedles);
            cone2.position.y = 12.5 * s;
            group.add(cone2);
        }

        this.scene.add(group);
        tree.group = group;
        this.fallingTrees.push(tree);

        // 5. Звук падения/треска древесины
        if (window.soundEngine) {
            window.soundEngine.playPropCrash('wood', tree.x, tree.y + 2.0, tree.z);
        }

        // 6. Высадка спрятавшегося локального игрока на ноги
        if (window.gameEngine && window.gameEngine.playerController && window.gameEngine.playerController.isClimbingTree) {
            const curr = window.gameEngine.playerController.currentTree;
            if (curr && (curr === tree || Math.hypot(curr.x - tree.x, curr.z - tree.z) < 2.5)) {
                window.gameEngine.playerController.ejectFromFallenTree(tree.x, tree.y, tree.z, tree.fallDirX, tree.fallDirZ);
            }
        }

        // 7. Сетевая синхронизация сбитого дерева
        if (!isRemote && window.gameEngine && window.gameEngine.multiplayerManager) {
            window.gameEngine.multiplayerManager.broadcastTreeTopple(tree.id, tree.fallDirX, tree.fallDirZ);
        }
    }

    update(deltaTime, activeCar = null, allCars = null, helicopter = null) {
        this.windUniform.value += deltaTime;

        // 1. Плавная анимация опрокидывания сбитых деревьев на землю
        if (this.fallingTrees && this.fallingTrees.length > 0) {
            for (let i = this.fallingTrees.length - 1; i >= 0; i--) {
                const t = this.fallingTrees[i];
                if (t.fallProgress < 1.0) {
                    t.fallProgress = Math.min(1.0, t.fallProgress + deltaTime * 1.6);
                    const fallAngle = t.fallProgress * (Math.PI / 2);

                    // Поворот ствола вокруг точки основания на земле
                    t.group.rotation.set(-t.fallDirZ * fallAngle, t.rotY, t.fallDirX * fallAngle);

                    if (t.fallProgress >= 1.0) {
                        // Дерево легло на землю — добавляем плоский коллайдер
                        const trunkLen = (t.type === 'pine') ? 15.0 * t.s : 7.5 * t.s;
                        const groundCol = new CANNON.Body({
                            mass: 0,
                            material: this.physicsMaterials.wall,
                            position: new CANNON.Vec3(t.x + t.fallDirX * trunkLen * 0.45, t.y + 0.35, t.z + t.fallDirZ * trunkLen * 0.45)
                        });
                        groundCol.addShape(new CANNON.Box(new CANNON.Vec3(0.6, 0.35, trunkLen * 0.45)));
                        this.world.addBody(groundCol);
                        t.groundCol = groundCol;
                    }
                }
            }
        }

        // 2. Проверка столкновений авто и вертолетов со стволами деревьев на скорости >= 100 км/ч (27.5 м/с)
        const MIN_TOPPLE_SPEED_MS = 27.5; // 99+ км/ч
        const bodiesToCheck = [];

        if (activeCar && activeCar.chassisBody) {
            bodiesToCheck.push(activeCar.chassisBody);
        }
        if (allCars && allCars.length) {
            for (let i = 0; i < allCars.length; i++) {
                const c = allCars[i];
                if (c && c.chassisBody && c !== activeCar) {
                    bodiesToCheck.push(c.chassisBody);
                }
            }
        }
        if (helicopter && helicopter.body && (helicopter.isPiloted || helicopter.isPassenger)) {
            bodiesToCheck.push(helicopter.body);
        }

        for (let v = 0; v < bodiesToCheck.length; v++) {
            const b = bodiesToCheck[v];
            const spd = Math.hypot(b.velocity.x, b.velocity.y, b.velocity.z);
            if (spd < MIN_TOPPLE_SPEED_MS) continue;

            const bx = b.position.x;
            const by = b.position.y;
            const bz = b.position.z;

            for (let i = 0; i < this.treePositions.length; i++) {
                const tree = this.treePositions[i];
                if (tree.isFallen) continue;
                if (Math.abs(bx - tree.x) > 3.5 || Math.abs(bz - tree.z) > 3.5) continue;
                if (by < tree.y - 1.0 || by > tree.y + 14.0) continue;

                const dSq = (bx - tree.x) * (bx - tree.x) + (bz - tree.z) * (bz - tree.z);
                const hitRadius = (tree.type === 'pine') ? 2.2 : 2.6;
                if (dSq <= hitRadius * hitRadius) {
                    this.toppleTree(tree, b.velocity);
                }
            }
        }
    }
}

window.VegetationAndCropsManager = VegetationAndCropsManager;
