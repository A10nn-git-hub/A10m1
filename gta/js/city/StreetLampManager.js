/**
         * STEP 37: Менеджер интерактивных разрушаемых физических пропсов на тротуарах и в мире
         * (Фонари, гидранты с водяными гейзерами, деревянные заборы, урны, скамейки)
         */
        class StreetLampManager {
            constructor(scene, world, physicsMaterials) {
                this.scene = scene;
                this.world = world;
                this.physicsMaterials = physicsMaterials;

                this.props = [];
                this.brokenProps = [];
                this.lamps = [];

                this.propGroup = new THREE.Group();
                this.scene.add(this.propGroup);

                this.geyserSystem = new HydrantWaterGeyserSystem(this.scene);

                // Оптимизированный пул 4 динамических источников света для 60 FPS
                this.activeDynamicLights = [];
                for (let i = 0; i < 4; i++) {
                    const pl = new THREE.PointLight(0xffe8a3, 0.0, 32, 2.0);
                    this.scene.add(pl);
                    this.activeDynamicLights.push(pl);
                }

                // Материалы для пропсов
                this.matPole = new THREE.MeshStandardMaterial({ color: 0x1f242d, roughness: 0.7, metalness: 0.6 });
                this.matBulb = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe099, emissiveIntensity: 0.0, roughness: 0.2 });
                this.matHydrantRed = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.45 });
                this.matHydrantSilver = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.85 });
                this.matWoodFence = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.85, metalness: 0.05 });
                this.matTrashCan = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6, metalness: 0.3 });
                this.matTrashMetal = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.7 });
                this.matBenchWood = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.75 });
                this.matBenchIron = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4, metalness: 0.85 });

                this.generateWorldProps();
            }

            generateWorldProps() {
                const gridRadius = 4;
                const blockSize = 60.0;
                const roadWidth = 16.0;
                const sidewalkWidth = 3.5;
                const offset = roadWidth / 2 + sidewalkWidth / 2;

                for (let gx = -gridRadius; gx <= gridRadius; gx++) {
                    for (let gz = -gridRadius; gz <= gridRadius; gz++) {
                        const px = gx * blockSize;
                        const pz = gz * blockSize;

                        // 1. Уличные фонарные столбы (Streetlights)
                        if (gx < gridRadius) {
                            const segMidX = px + blockSize / 2;
                            this.createStreetLamp(segMidX, pz - offset, 0);
                            this.createStreetLamp(segMidX, pz + offset, Math.PI);
                        }
                        if (gz < gridRadius) {
                            const segMidZ = pz + blockSize / 2;
                            this.createStreetLamp(px - offset, segMidZ, Math.PI / 2);
                            this.createStreetLamp(px + offset, segMidZ, -Math.PI / 2);
                        }

                        // 2. Пожарные гидранты на перекрестках (Fire Hydrants)
                        if (Math.abs(gx) <= 3 && Math.abs(gz) <= 3) {
                            if ((gx + gz) % 2 === 0) {
                                this.createFireHydrant(px + roadWidth / 2 + 1.2, pz + roadWidth / 2 + 1.2);
                            }
                        }

                        // 3. Мусорные урны на тротуарах (Trash Cans)
                        if (gx < gridRadius && (gx + gz) % 2 !== 0) {
                            this.createTrashCan(px + blockSize / 2 + 8.0, pz - offset + 0.5);
                        }

                        // 4. Парковые скамейки (Park Benches)
                        if (gz < gridRadius && Math.abs(gx) >= 1 && Math.abs(gz) >= 1) {
                            this.createParkBench(px + offset - 0.4, pz + blockSize / 2 - 6.0, Math.PI / 2);
                        }

                        // 5. Деревянные заборы в пригородных жилых зонах (Wooden Fences)
                        if ((Math.abs(gx) === 2 || Math.abs(gx) === 3) && (Math.abs(gz) === 2 || Math.abs(gz) === 3)) {
                            this.createWoodenFence(px - 14.0, pz + 16.0, 0);
                            this.createWoodenFence(px + 14.0, pz + 16.0, 0);
                        }
                    }
                }
            }

            createStreetLamp(x, z, rotY) {
                const group = new THREE.Group();
                group.position.set(x, 0, z); group.rotation.y = rotY;

                const poleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7.2, 10), this.matPole);
                poleMesh.position.y = 3.6; poleMesh.castShadow = true;
                group.add(poleMesh);

                const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.8), this.matPole);
                armMesh.position.set(0, 7.2, 0.85); armMesh.rotation.x = -0.15;
                group.add(armMesh);

                const bulbMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.65), this.matBulb);
                bulbMesh.position.set(0, 7.3, 1.7);
                group.add(bulbMesh);

                this.propGroup.add(group);

                const body = new CANNON.Body({
                    mass: 0,
                    material: this.physicsMaterials.wall,
                    position: new CANNON.Vec3(x, 3.6, z)
                });
                const qCylLamp = new CANNON.Quaternion();
                qCylLamp.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
                body.addShape(new CANNON.Cylinder(0.38, 0.45, 7.2, 10), new CANNON.Vec3(0, 0, 0), qCylLamp);
                this.world.addBody(body);

                const propObj = {
                    type: 'STREETLIGHT',
                    mesh: group,
                    body: body,
                    isBroken: false,
                    dynamicMass: 140,
                    soundType: 'metal',
                    bulbMesh: bulbMesh,
                    lightPos: new THREE.Vector3(x, 7.1, z),
                    radius: 1.2
                };

                this.props.push(propObj);
                this.lamps.push({ bulbMesh, prop: propObj });
            }

            createFireHydrant(x, z) {
                const group = new THREE.Group();
                group.position.set(x, 0, z);

                // Корпус гидранта
                const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.25, 10), this.matHydrantRed);
                baseMesh.position.y = 0.125; baseMesh.castShadow = true;
                group.add(baseMesh);

                const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.65, 10), this.matHydrantRed);
                bodyMesh.position.y = 0.55; bodyMesh.castShadow = true;
                group.add(bodyMesh);

                const capMesh = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 6), this.matHydrantRed);
                capMesh.position.y = 0.88; group.add(capMesh);

                const nutMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 6), this.matHydrantSilver);
                nutMesh.position.y = 1.02; group.add(nutMesh);

                const nozzleL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 6), this.matHydrantSilver);
                nozzleL.rotation.z = Math.PI / 2; nozzleL.position.set(-0.2, 0.62, 0); group.add(nozzleL);
                const nozzleR = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 6), this.matHydrantSilver);
                nozzleR.rotation.z = Math.PI / 2; nozzleR.position.set(0.2, 0.62, 0); group.add(nozzleR);

                this.propGroup.add(group);

                const body = new CANNON.Body({
                    mass: 0,
                    material: this.physicsMaterials.wall,
                    position: new CANNON.Vec3(x, 0.5, z)
                });
                const qCylHydrant = new CANNON.Quaternion();
                qCylHydrant.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
                body.addShape(new CANNON.Cylinder(0.32, 0.36, 1.0, 10), new CANNON.Vec3(0, 0, 0), qCylHydrant);
                this.world.addBody(body);

                this.props.push({
                    type: 'FIRE_HYDRANT',
                    mesh: group,
                    body: body,
                    isBroken: false,
                    dynamicMass: 65,
                    soundType: 'metal',
                    radius: 0.8
                });
            }

            createWoodenFence(x, z, rotY = 0) {
                const group = new THREE.Group();
                group.position.set(x, 0, z); group.rotation.y = rotY;

                const fenceLen = 3.6;
                const fenceH = 1.3;

                const rail1 = new THREE.Mesh(new THREE.BoxGeometry(fenceLen, 0.08, 0.06), this.matWoodFence);
                rail1.position.set(0, 0.4, 0); group.add(rail1);
                const rail2 = new THREE.Mesh(new THREE.BoxGeometry(fenceLen, 0.08, 0.06), this.matWoodFence);
                rail2.position.set(0, 0.95, 0); group.add(rail2);

                const numPickets = 6;
                const picketGeo = new THREE.BoxGeometry(0.12, fenceH, 0.04);
                for (let i = 0; i < numPickets; i++) {
                    const px = (i / (numPickets - 1) - 0.5) * (fenceLen - 0.2);
                    const picket = new THREE.Mesh(picketGeo, this.matWoodFence);
                    picket.position.set(px, fenceH / 2, 0);
                    group.add(picket);
                }

                this.propGroup.add(group);

                const body = new CANNON.Body({
                    mass: 0,
                    material: this.physicsMaterials.wall,
                    position: new CANNON.Vec3(x, fenceH / 2, z),
                    linearDamping: 0.35,
                    angularDamping: 0.4
                });
                body.allowSleep = true;
                body.sleep();
                body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotY);
                body.addShape(new CANNON.Box(new CANNON.Vec3(fenceLen / 2, fenceH / 2, 0.15)));
                this.world.addBody(body);

                this.props.push({
                    type: 'WOODEN_FENCE',
                    mesh: group,
                    body: body,
                    isBroken: false,
                    dynamicMass: 35,
                    soundType: 'wood',
                    radius: 1.8
                });
            }

            createTrashCan(x, z) {
                const group = new THREE.Group();
                group.position.set(x, 0, z);

                const canMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.92, 10), this.matTrashCan);
                canMesh.position.y = 0.46; group.add(canMesh);

                const rimMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 10), this.matTrashMetal);
                rimMesh.position.y = 0.92; group.add(rimMesh);

                this.propGroup.add(group);

                const body = new CANNON.Body({
                    mass: 0,
                    material: this.physicsMaterials.wall,
                    position: new CANNON.Vec3(x, 0.46, z)
                });
                const qCylTrash = new CANNON.Quaternion();
                qCylTrash.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
                body.addShape(new CANNON.Cylinder(0.40, 0.40, 0.95, 10), new CANNON.Vec3(0, 0, 0), qCylTrash);
                this.world.addBody(body);

                this.props.push({
                    type: 'TRASH_CAN',
                    mesh: group,
                    body: body,
                    isBroken: false,
                    dynamicMass: 25,
                    soundType: 'metal',
                    radius: 0.75
                });
            }

            createParkBench(x, z, rotY = 0) {
                const group = new THREE.Group();
                group.position.set(x, 0, z); group.rotation.y = rotY;

                const slatGeo = new THREE.BoxGeometry(2.0, 0.05, 0.12);
                for (let i = 0; i < 4; i++) {
                    const slat = new THREE.Mesh(slatGeo, this.matBenchWood);
                    slat.position.set(0, 0.48, -0.18 + i * 0.14);
                    group.add(slat);
                }

                for (let i = 0; i < 3; i++) {
                    const slatBack = new THREE.Mesh(slatGeo, this.matBenchWood);
                    slatBack.position.set(0, 0.65 + i * 0.14, -0.22);
                    slatBack.rotation.x = 0.15;
                    group.add(slatBack);
                }

                const legGeo = new THREE.BoxGeometry(0.08, 0.48, 0.65);
                const legL = new THREE.Mesh(legGeo, this.matBenchIron);
                legL.position.set(-0.85, 0.24, 0); group.add(legL);
                const legR = new THREE.Mesh(legGeo, this.matBenchIron);
                legR.position.set(0.85, 0.24, 0); group.add(legR);

                this.propGroup.add(group);

                const body = new CANNON.Body({
                    mass: 0,
                    material: this.physicsMaterials.wall,
                    position: new CANNON.Vec3(x, 0.45, z),
                    linearDamping: 0.3,
                    angularDamping: 0.35
                });
                body.allowSleep = true;
                body.sleep();
                body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotY);
                body.addShape(new CANNON.Box(new CANNON.Vec3(1.0, 0.45, 0.4)));
                this.world.addBody(body);

                this.props.push({
                    type: 'PARK_BENCH',
                    mesh: group,
                    body: body,
                    isBroken: false,
                    dynamicMass: 45,
                    soundType: 'wood',
                    radius: 1.2
                });
            }

            breakProp(prop, impactVelocity) {
                if (prop.isBroken) return;
                prop.isBroken = true;

                prop.body.wakeUp();
                prop.body.type = CANNON.Body.DYNAMIC;
                prop.body.mass = prop.dynamicMass;
                prop.body.updateMassProperties();

                const imp = impactVelocity.clone().scale(1.25);
                imp.y += 3.8 + Math.random() * 2.0;
                prop.body.velocity.copy(imp);

                prop.body.angularVelocity.set(
                    (Math.random() - 0.5) * 12.0,
                    (Math.random() - 0.5) * 14.0,
                    (Math.random() - 0.5) * 12.0
                );

                this.brokenProps.push(prop);

                const pos = prop.mesh.position;
                if (window.soundEngine) {
                    window.soundEngine.playPropCrash(prop.soundType, pos.x, pos.y, pos.z);
                }

                if (prop.type === 'FIRE_HYDRANT') {
                    this.geyserSystem.addGeyser(pos.x, 0.1, pos.z);
                }
            }

            update(deltaTime, focusPos, activeCar, allCars) {
                // 1. Обновление физических трансформаций сбитых пропсов
                for (let i = 0; i < this.brokenProps.length; i++) {
                    const bp = this.brokenProps[i];
                    bp.mesh.position.copy(bp.body.position);
                    bp.mesh.quaternion.copy(bp.body.quaternion);
                }

                // 2. Обновление водяных гейзеров
                this.geyserSystem.update(deltaTime);

                // 3. Быстрая проверка столкновений движущихся авто с целыми пропсами
                const carsToCheck = [];
                if (activeCar && activeCar.chassisBody) carsToCheck.push(activeCar);
                if (allCars && allCars.length) {
                    for (let i = 0; i < allCars.length; i++) {
                        const c = allCars[i];
                        if (c && c.chassisBody && c !== activeCar) carsToCheck.push(c);
                    }
                }

                for (let c = 0; c < carsToCheck.length; c++) {
                    const car = carsToCheck[c];
                    const carPos = car.chassisBody.position;
                    const carVel = car.chassisBody.velocity;
                    const speedSq = carVel.x * carVel.x + carVel.y * carVel.y + carVel.z * carVel.z;

                    if (speedSq < 14.5) continue;

                    for (let p = 0; p < this.props.length; p++) {
                        const prop = this.props[p];
                        if (prop.isBroken) continue;

                        const propPos = prop.body.position;
                        const dx = carPos.x - propPos.x;
                        const dz = carPos.z - propPos.z;
                        if (Math.abs(dx) > 3.0 || Math.abs(dz) > 3.0) continue;

                        // Пропсы остаются прочными монолитными препятствиями, не проваливаются сквозь землю
                        const distSq = dx * dx + dz * dz;
                        const hitThreshold = prop.radius + 1.2;
                        if (distSq < hitThreshold * hitThreshold && speedSq > 80.0 && prop.type === 'FIRE_HYDRANT') {
                            this.breakProp(prop, carVel);
                        }
                    }
                }
            }

            updateNightLighting(nightFactor, playerPosition) {
                this.matBulb.emissiveIntensity = nightFactor * 3.5;

                if (nightFactor < 0.05 || !playerPosition) {
                    for (let i = 0; i < this.activeDynamicLights.length; i++) {
                        this.activeDynamicLights[i].intensity = 0.0;
                    }
                    return;
                }

                // Обновляем позиции 4 ближайших источников света с частотой 5 Гц (вместо каждого кадра)
                if (!this._lastLightCheckTime || Date.now() - this._lastLightCheckTime > 200) {
                    this._lastLightCheckTime = Date.now();

                    const candidates = [];
                    const px = playerPosition.x, pz = playerPosition.z;
                    for (let i = 0; i < this.lamps.length; i++) {
                        const l = this.lamps[i];
                        if (l.prop.isBroken) continue;
                        const lp = l.prop.lightPos;
                        const dSq = (lp.x - px) * (lp.x - px) + (lp.z - pz) * (lp.z - pz);
                        if (dSq < 2500) {
                            candidates.push({ pos: lp, distSq: dSq });
                        }
                    }

                    candidates.sort((a, b) => a.distSq - b.distSq);
                    this._cachedLightCandidates = candidates;
                }

                const candidates = this._cachedLightCandidates || [];
                const lightIntensity = nightFactor * 2.2;
                for (let i = 0; i < this.activeDynamicLights.length; i++) {
                    const pl = this.activeDynamicLights[i];
                    if (i < candidates.length) {
                        pl.position.set(candidates[i].pos.x, 6.8, candidates[i].pos.z);
                        pl.intensity = lightIntensity;
                    } else {
                        pl.intensity = 0.0;
                    }
                }
            }
        }
