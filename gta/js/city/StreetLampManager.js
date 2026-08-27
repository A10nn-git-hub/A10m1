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
        const centerY = 3.6;
        const group = new THREE.Group();
        group.position.set(x, centerY, z);
        group.rotation.y = rotY;

        // Меши центрированы относительно центра массы (Y = 3.6)
        const poleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7.2, 10), this.matPole);
        poleMesh.position.y = 0; poleMesh.castShadow = true;
        group.add(poleMesh);

        const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.8), this.matPole);
        armMesh.position.set(0, 3.6, 0.85); armMesh.rotation.x = -0.15;
        group.add(armMesh);

        const bulbMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.65), this.matBulb);
        bulbMesh.position.set(0, 3.7, 1.7);
        group.add(bulbMesh);

        this.propGroup.add(group);

        const body = new CANNON.Body({
            mass: 0,
            material: this.physicsMaterials.wall,
            position: new CANNON.Vec3(x, centerY, z),
            linearDamping: 0.45,
            angularDamping: 0.55
        });
        body.allowSleep = true;
        body.sleep();
        body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotY);
        const qCylLamp = new CANNON.Quaternion();
        qCylLamp.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
        body.addShape(new CANNON.Cylinder(0.38, 0.45, 7.2, 10), new CANNON.Vec3(0, 0, 0), qCylLamp);
        this.world.addBody(body);

        const propObj = {
            id: this.props.length,
            type: 'STREETLIGHT',
            mesh: group,
            body: body,
            isBroken: false,
            dynamicMass: 95,
            soundType: 'metal',
            bulbMesh: bulbMesh,
            lightPos: new THREE.Vector3(x, 7.1, z),
            radius: 1.2
        };

        this.props.push(propObj);
        this.lamps.push({ bulbMesh, prop: propObj });
    }

    createFireHydrant(x, z) {
        const centerY = 0.5;
        const group = new THREE.Group();
        group.position.set(x, centerY, z);

        // Корпус гидранта, центрированный относительно Y = 0.5
        const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.25, 10), this.matHydrantRed);
        baseMesh.position.y = -0.375; baseMesh.castShadow = true;
        group.add(baseMesh);

        const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.65, 10), this.matHydrantRed);
        bodyMesh.position.y = 0.05; bodyMesh.castShadow = true;
        group.add(bodyMesh);

        const capMesh = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 6), this.matHydrantRed);
        capMesh.position.y = 0.38; group.add(capMesh);

        const nutMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 6), this.matHydrantSilver);
        nutMesh.position.y = 0.52; group.add(nutMesh);

        const nozzleL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 6), this.matHydrantSilver);
        nozzleL.rotation.z = Math.PI / 2; nozzleL.position.set(-0.2, 0.12, 0); group.add(nozzleL);
        const nozzleR = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 6), this.matHydrantSilver);
        nozzleR.rotation.z = Math.PI / 2; nozzleR.position.set(0.2, 0.12, 0); group.add(nozzleR);

        this.propGroup.add(group);

        const body = new CANNON.Body({
            mass: 0,
            material: this.physicsMaterials.wall,
            position: new CANNON.Vec3(x, centerY, z),
            linearDamping: 0.5,
            angularDamping: 0.6
        });
        body.allowSleep = true;
        body.sleep();
        const qCylHydrant = new CANNON.Quaternion();
        qCylHydrant.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
        body.addShape(new CANNON.Cylinder(0.32, 0.36, 1.0, 10), new CANNON.Vec3(0, 0, 0), qCylHydrant);
        this.world.addBody(body);

        this.props.push({
            id: this.props.length,
            type: 'FIRE_HYDRANT',
            mesh: group,
            body: body,
            isBroken: false,
            dynamicMass: 45,
            soundType: 'metal',
            radius: 0.8
        });
    }

    createWoodenFence(x, z, rotY = 0) {
        const fenceLen = 3.6;
        const fenceH = 1.3;
        const centerY = fenceH / 2;

        const group = new THREE.Group();
        group.position.set(x, centerY, z);
        group.rotation.y = rotY;

        const rail1 = new THREE.Mesh(new THREE.BoxGeometry(fenceLen, 0.08, 0.06), this.matWoodFence);
        rail1.position.set(0, -0.25, 0); group.add(rail1);
        const rail2 = new THREE.Mesh(new THREE.BoxGeometry(fenceLen, 0.08, 0.06), this.matWoodFence);
        rail2.position.set(0, 0.30, 0); group.add(rail2);

        const numPickets = 6;
        const picketGeo = new THREE.BoxGeometry(0.12, fenceH, 0.04);
        for (let i = 0; i < numPickets; i++) {
            const px = (i / (numPickets - 1) - 0.5) * (fenceLen - 0.2);
            const picket = new THREE.Mesh(picketGeo, this.matWoodFence);
            picket.position.set(px, 0, 0);
            group.add(picket);
        }

        this.propGroup.add(group);

        const body = new CANNON.Body({
            mass: 0,
            material: this.physicsMaterials.wall,
            position: new CANNON.Vec3(x, centerY, z),
            linearDamping: 0.45,
            angularDamping: 0.55
        });
        body.allowSleep = true;
        body.sleep();
        body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotY);
        body.addShape(new CANNON.Box(new CANNON.Vec3(fenceLen / 2, fenceH / 2, 0.15)));
        this.world.addBody(body);

        this.props.push({
            id: this.props.length,
            type: 'WOODEN_FENCE',
            mesh: group,
            body: body,
            isBroken: false,
            dynamicMass: 25,
            soundType: 'wood',
            radius: 1.8
        });
    }

    createTrashCan(x, z) {
        const centerY = 0.46;
        const group = new THREE.Group();
        group.position.set(x, centerY, z);

        const canMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.92, 10), this.matTrashCan);
        canMesh.position.y = 0; group.add(canMesh);

        const rimMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 10), this.matTrashMetal);
        rimMesh.position.y = 0.46; group.add(rimMesh);

        this.propGroup.add(group);

        const body = new CANNON.Body({
            mass: 0,
            material: this.physicsMaterials.wall,
            position: new CANNON.Vec3(x, centerY, z),
            linearDamping: 0.45,
            angularDamping: 0.55
        });
        body.allowSleep = true;
        body.sleep();
        const qCylTrash = new CANNON.Quaternion();
        qCylTrash.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
        body.addShape(new CANNON.Cylinder(0.40, 0.40, 0.95, 10), new CANNON.Vec3(0, 0, 0), qCylTrash);
        this.world.addBody(body);

        this.props.push({
            id: this.props.length,
            type: 'TRASH_CAN',
            mesh: group,
            body: body,
            isBroken: false,
            dynamicMass: 18,
            soundType: 'metal',
            radius: 0.75
        });
    }

    createParkBench(x, z, rotY = 0) {
        const centerY = 0.45;
        const group = new THREE.Group();
        group.position.set(x, centerY, z);
        group.rotation.y = rotY;

        const slatGeo = new THREE.BoxGeometry(2.0, 0.05, 0.12);
        for (let i = 0; i < 4; i++) {
            const slat = new THREE.Mesh(slatGeo, this.matBenchWood);
            slat.position.set(0, 0.03 + i * 0.14, -0.18);
            group.add(slat);
        }

        for (let i = 0; i < 3; i++) {
            const slatBack = new THREE.Mesh(slatGeo, this.matBenchWood);
            slatBack.position.set(0, 0.20 + i * 0.14, -0.22);
            slatBack.rotation.x = 0.15;
            group.add(slatBack);
        }

        const legGeo = new THREE.BoxGeometry(0.08, 0.48, 0.65);
        const legL = new THREE.Mesh(legGeo, this.matBenchIron);
        legL.position.set(-0.85, -0.21, 0); group.add(legL);
        const legR = new THREE.Mesh(legGeo, this.matBenchIron);
        legR.position.set(0.85, -0.21, 0); group.add(legR);

        this.propGroup.add(group);

        const body = new CANNON.Body({
            mass: 0,
            material: this.physicsMaterials.wall,
            position: new CANNON.Vec3(x, centerY, z),
            linearDamping: 0.45,
            angularDamping: 0.55
        });
        body.allowSleep = true;
        body.sleep();
        body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotY);
        body.addShape(new CANNON.Box(new CANNON.Vec3(1.0, 0.45, 0.4)));
        this.world.addBody(body);

        this.props.push({
            id: this.props.length,
            type: 'PARK_BENCH',
            mesh: group,
            body: body,
            isBroken: false,
            dynamicMass: 35,
            soundType: 'wood',
            radius: 1.2
        });
    }

    breakProp(prop, impactVelocity, broadcast = true, playSound = true) {
        if (!prop || prop.isBroken) return;
        prop.isBroken = true;

        prop.body.wakeUp();
        prop.body.type = CANNON.Body.DYNAMIC;
        prop.body.mass = prop.dynamicMass;
        prop.body.updateMassProperties();

        // Плавная и реалистичная передача импульса от удара автомобилем
        let impX = 0, impZ = 0, impY = 1.2;
        if (impactVelocity) {
            const spd = Math.hypot(impactVelocity.x, impactVelocity.z);
            if (spd > 0.1) {
                const dirX = impactVelocity.x / spd;
                const dirZ = impactVelocity.z / spd;
                const pushForce = Math.min(spd * 0.75, 18.0);
                impX = dirX * pushForce;
                impZ = dirZ * pushForce;
                impY = Math.min(2.5, 0.8 + pushForce * 0.08);

                // Угловое вращение в направлении падения
                prop.body.angularVelocity.set(
                    dirZ * (pushForce * 0.45),
                    (Math.random() - 0.5) * 1.5,
                    -dirX * (pushForce * 0.45)
                );
            }
        } else {
            impY = 2.0;
        }

        prop.body.velocity.set(impX, impY, impZ);

        this.brokenProps.push(prop);

        const pos = prop.mesh.position;
        if (playSound && window.soundEngine) {
            window.soundEngine.playPropCrash(prop.soundType, pos.x, pos.y, pos.z);
        }

        if (prop.type === 'FIRE_HYDRANT') {
            this.geyserSystem.addGeyser(pos.x, 0.1, pos.z);
        }

        if (broadcast && window.gameEngine && window.gameEngine.multiplayerManager) {
            window.gameEngine.multiplayerManager.broadcastPropBreak(
                prop.id,
                prop.body.velocity.x,
                prop.body.velocity.y,
                prop.body.velocity.z
            );
        }
    }

    receiveNetworkBreakProp(propId, vx, vy, vz, playSound = false) {
        if (propId !== undefined && this.props[propId] && !this.props[propId].isBroken) {
            const vel = new CANNON.Vec3(vx || 0, vy || 2, vz || 0);
            this.breakProp(this.props[propId], vel, false, playSound);
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

            if (speedSq < 14.0) continue; // Скорость более 13.5 км/ч

            const carQuat = car.carGroup ? car.carGroup.quaternion : car.chassisBody.quaternion;
            if (!this._fwd) {
                this._fwd = new THREE.Vector3();
                this._rgt = new THREE.Vector3();
                this._hitPoints = [
                    new THREE.Vector3(),
                    new THREE.Vector3(),
                    new THREE.Vector3(),
                    new THREE.Vector3(),
                    new THREE.Vector3()
                ];
            }
            const fwd = this._fwd.set(0, 0, 1).applyQuaternion(carQuat);
            const rgt = this._rgt.set(1, 0, 0).applyQuaternion(carQuat);

            // 5 точек контура (центр переднего бампера, левый и правый углы, капот и центр авто)
            this._hitPoints[0].set(carPos.x, carPos.y, carPos.z);
            this._hitPoints[1].set(carPos.x + fwd.x * 2.3, carPos.y, carPos.z + fwd.z * 2.3);
            this._hitPoints[2].set(carPos.x + fwd.x * 2.3 - rgt.x * 0.95, carPos.y, carPos.z + fwd.z * 2.3 - rgt.z * 0.95);
            this._hitPoints[3].set(carPos.x + fwd.x * 2.3 + rgt.x * 0.95, carPos.y, carPos.z + fwd.z * 2.3 + rgt.z * 0.95);
            this._hitPoints[4].set(carPos.x + fwd.x * 1.2, carPos.y, carPos.z + fwd.z * 1.2);
            const hitPoints = this._hitPoints;

            for (let p = 0; p < this.props.length; p++) {
                const prop = this.props[p];
                if (prop.isBroken) continue;

                const propPos = prop.body.position;
                if (Math.abs(carPos.x - propPos.x) > 4.5 || Math.abs(carPos.z - propPos.z) > 4.5) continue;

                const hitThreshold = prop.radius + 0.9;
                const hitThresholdSq = hitThreshold * hitThreshold;

                let isHit = false;
                for (let hp = 0; hp < hitPoints.length; hp++) {
                    const pt = hitPoints[hp];
                    const dSq = (pt.x - propPos.x) * (pt.x - propPos.x) + (pt.z - propPos.z) * (pt.z - propPos.z);
                    if (dSq < hitThresholdSq) {
                        isHit = true;
                        break;
                    }
                }

                if (isHit) {
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
                if (l.prop && l.prop.isBroken) continue;
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

window.StreetLampManager = StreetLampManager;
