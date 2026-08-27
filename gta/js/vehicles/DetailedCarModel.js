/**
         * Модель автомобиля с реалистичными передаточными числами, дверью, дымом выхлопа и системой освещения
         */
        class DetailedCarModel {
            constructor(scene, world, physicsMaterials, posX, posZ, rotY = 0, colorHex = 0xd32f2f, carName = 'Comet S2', topSpeedKmh = 248) {
                this.scene = scene;
                this.world = world;
                this.physicsMaterials = physicsMaterials;
                this.carName = carName;
                this.topSpeedKmh = topSpeedKmh;

                this.carGroup = new THREE.Group();
                this.scene.add(this.carGroup);

                this.wheelMeshes = [];
                this.wheelHubs = [];

                this.steeringValue = 0;
                this.rolloverTimer = 0;
                this.doorAngle = 0;
                this.isAccelerating = false;

                this.maxEngineForce = 9000;
                this.maxBrakeForce = 135;
                this.maxReverseForce = 4800;
                this.maxSteerAngle = 0.52;

                this.headlightsOn = false;
                this.isBrakingState = false;
                this.isReversingState = false;

                // Сетевая интерполяция и экстраполяция (Standoff-2 style entity smoothing)
                this.isRemotelyDriven = false;
                this.netTargetPos = new THREE.Vector3();
                this.netTargetRotY = 0;
                this.netVelocity = new THREE.Vector3();
                this.netLastPacketTime = 0;

                this.soundController = new VehicleSoundController(window.soundEngine);
                this.smokeSystem = new CarExhaustSmokeSystem(this.scene);

                this.buildVisualModel(colorHex);
                this.initRaycastPhysics(posX, posZ, rotY);
            }

            applyNetworkTransform(x, y, z, rotY, vx = 0, vy = 0, vz = 0, isDriven = true) {
                this.isRemotelyDriven = !!isDriven;
                this.netTargetPos.set(x, y, z);
                this.netTargetRotY = rotY;
                this.netVelocity.set(vx, vy, vz);
                this.netLastPacketTime = performance.now();

                // При первом появлении или резком перемещении телепортируем сразу
                if (this.carGroup.position.distanceTo(this.netTargetPos) > 22.0) {
                    this.carGroup.position.copy(this.netTargetPos);
                    this.carGroup.rotation.y = this.netTargetRotY;
                    if (this.chassisBody) {
                        this.chassisBody.position.copy(this.netTargetPos);
                        this.chassisBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), this.netTargetRotY);
                        this.chassisBody.velocity.set(vx, vy, vz);
                    }
                }
            }

            buildVisualModel(colorHex) {
                const matPaint = new THREE.MeshLambertMaterial({ color: colorHex });
                const matCarbon = new THREE.MeshLambertMaterial({ color: 0x18181b });
                const matChrome = new THREE.MeshLambertMaterial({ color: 0xcccccc });
                const matGlass = new THREE.MeshLambertMaterial({ color: 0x1e293b, transparent: true, opacity: 0.75 });
                const matInterior = new THREE.MeshLambertMaterial({ color: 0x1e293b });
                const matPlate = new THREE.MeshLambertMaterial({
                    map: ProceduralTextureFactory.createLicensePlateTexture()
                });
                this.matHeadlightLens = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xfff5cc, emissiveIntensity: 0.0 });
                this.matTaillight = new THREE.MeshLambertMaterial({ color: 0xcc0000 });

                const chassisGroup = new THREE.Group();
                this.carGroup.add(chassisGroup);
                this.chassisGroup = chassisGroup;

                const baseGeo = new THREE.BoxGeometry(1.92, 0.46, 4.3);
                const baseMesh = new THREE.Mesh(baseGeo, matPaint);
                baseMesh.position.set(0, 0.14, 0); baseMesh.castShadow = true; baseMesh.receiveShadow = true;
                chassisGroup.add(baseMesh);

                const cabinGeo = new THREE.BoxGeometry(1.48, 0.52, 1.95);
                const cabinMesh = new THREE.Mesh(cabinGeo, matGlass);
                cabinMesh.position.set(0, 0.56, -0.22); cabinMesh.castShadow = true;
                chassisGroup.add(cabinMesh);

                const roofGeo = new THREE.BoxGeometry(1.42, 0.06, 1.45);
                const roofMesh = new THREE.Mesh(roofGeo, matPaint);
                roofMesh.position.set(0, 0.83, -0.28); roofMesh.castShadow = true;
                chassisGroup.add(roofMesh);

                const hoodGeo = new THREE.BoxGeometry(1.82, 0.18, 1.45);
                const hoodMesh = new THREE.Mesh(hoodGeo, matPaint);
                hoodMesh.position.set(0, 0.28, 1.35); hoodMesh.rotation.x = -0.06; hoodMesh.castShadow = true;
                chassisGroup.add(hoodMesh);

                const trunkGeo = new THREE.BoxGeometry(1.82, 0.22, 1.05);
                const trunkMesh = new THREE.Mesh(trunkGeo, matPaint);
                trunkMesh.position.set(0, 0.32, -1.55); trunkMesh.rotation.x = 0.04; trunkMesh.castShadow = true;
                chassisGroup.add(trunkMesh);

                const spoilerWing = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.04, 0.35), matCarbon);
                spoilerWing.position.set(0, 0.58, -2.0); spoilerWing.castShadow = true;
                chassisGroup.add(spoilerWing);

                const splitterMesh = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.06, 0.4), matCarbon);
                splitterMesh.position.set(0, -0.16, 2.15); chassisGroup.add(splitterMesh);

                const diffuserMesh = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.14, 0.35), matCarbon);
                diffuserMesh.position.set(0, -0.12, -2.15); chassisGroup.add(diffuserMesh);

                const exL = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.25, 12), matChrome);
                exL.rotation.x = Math.PI / 2; exL.position.set(-0.6, -0.1, -2.25); chassisGroup.add(exL);
                const exR = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.25, 12), matChrome);
                exR.rotation.x = Math.PI / 2; exR.position.set(0.6, -0.1, -2.25); chassisGroup.add(exR);

                const plateF = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.18), matPlate);
                plateF.position.set(0, -0.1, 2.22); chassisGroup.add(plateF);
                const plateR = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.18), matPlate);
                plateR.position.set(0, 0.02, -2.22); plateR.rotation.y = Math.PI; chassisGroup.add(plateR);

                const headL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.12), this.matHeadlightLens);
                headL.position.set(-0.68, 0.16, 2.16); chassisGroup.add(headL);
                const headR = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.12), this.matHeadlightLens);
                headR.position.set(0.68, 0.16, 2.16); chassisGroup.add(headR);

                const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.08), this.matTaillight);
                tailL.position.set(-0.65, 0.22, -2.21); chassisGroup.add(tailL);
                const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.08), this.matTaillight);
                tailR.position.set(0.65, 0.22, -2.21); chassisGroup.add(tailR);

                this.spotLightL = new THREE.SpotLight(0xfffaea, 0.0, 75, Math.PI / 5.2, 0.45, 1.4);
                this.spotLightL.position.set(-0.68, 0.22, 2.2);
                this.spotLightL.castShadow = false;
                this.spotLightL.shadow.mapSize.width = 1024;
                this.spotLightL.shadow.mapSize.height = 1024;
                this.spotLightL.shadow.camera.near = 0.5;
                this.spotLightL.shadow.camera.far = 75;
                this.spotLightL.shadow.bias = -0.00015;
                chassisGroup.add(this.spotLightL);

                this.spotTargetL = new THREE.Object3D();
                this.spotTargetL.position.set(-0.68, -0.2, 40.0);
                chassisGroup.add(this.spotTargetL);
                this.spotLightL.target = this.spotTargetL;

                this.spotLightR = new THREE.SpotLight(0xfffaea, 0.0, 75, Math.PI / 5.2, 0.45, 1.4);
                this.spotLightR.position.set(0.68, 0.22, 2.2);
                this.spotLightR.castShadow = false;
                this.spotLightR.shadow.mapSize.width = 1024;
                this.spotLightR.shadow.mapSize.height = 1024;
                this.spotLightR.shadow.camera.near = 0.5;
                this.spotLightR.shadow.camera.far = 75;
                this.spotLightR.shadow.bias = -0.00015;
                chassisGroup.add(this.spotLightR);

                this.spotTargetR = new THREE.Object3D();
                this.spotTargetR.position.set(0.68, -0.2, 40.0);
                chassisGroup.add(this.spotTargetR);
                this.spotLightR.target = this.spotTargetR;

                this.taillightPoint = new THREE.PointLight(0xff1111, 0.0, 6.5, 2);
                this.taillightPoint.position.set(0, 0.22, -2.4);
                chassisGroup.add(this.taillightPoint);

                // 4 полноценных кресла в салоне (Водитель + 3 Пассажира)
                const seatFL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.52), matInterior);
                seatFL.position.set(-0.42, 0.28, -0.15); chassisGroup.add(seatFL);

                const seatFR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.52), matInterior);
                seatFR.position.set(0.42, 0.28, -0.15); chassisGroup.add(seatFR);

                const seatRL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.52), matInterior);
                seatRL.position.set(-0.42, 0.28, -0.85); chassisGroup.add(seatRL);

                const seatRR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.52), matInterior);
                seatRR.position.set(0.42, 0.28, -0.85); chassisGroup.add(seatRR);

                this.occupants = [null, null, null, null]; // 0: Водитель, 1: Передний правый, 2: Задний левый, 3: Задний правый

                const steerMesh = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.024, 8, 20), matInterior);
                steerMesh.position.set(-0.42, 0.46, 0.3); steerMesh.rotation.x = Math.PI / 3.8;
                chassisGroup.add(steerMesh);

                this.driverDoorPivot = new THREE.Group();
                this.driverDoorPivot.position.set(-0.96, 0.14, 0.75);

                const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 1.15), matPaint);
                doorPanel.position.set(0, 0, -0.575); doorPanel.castShadow = true;
                this.driverDoorPivot.add(doorPanel);

                const doorHandle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.12), matChrome);
                doorHandle.position.set(-0.05, 0.1, -0.95);
                this.driverDoorPivot.add(doorHandle);

                chassisGroup.add(this.driverDoorPivot);

                const matTire = new THREE.MeshLambertMaterial({ color: 0x1a1a1e });
                const matRim = new THREE.MeshLambertMaterial({ color: 0xc0c0c8 });
                const matBrakeDisc = new THREE.MeshLambertMaterial({ color: 0x71717a });
                const matCaliper = new THREE.MeshLambertMaterial({ color: 0xd32f2f });

                const createWheelMesh = (isLeft) => {
                    const wheelGroup = new THREE.Group();
                    const tireGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 24);
                    const tireMesh = new THREE.Mesh(tireGeo, matTire);
                    tireMesh.rotation.z = Math.PI / 2; tireMesh.castShadow = true;
                    wheelGroup.add(tireMesh);

                    const hubGroup = new THREE.Group();
                    const rimMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.265, 20), matRim);
                    rimMesh.rotation.z = Math.PI / 2; hubGroup.add(rimMesh);

                    const spokeGeo = new THREE.BoxGeometry(0.045, 0.4, 0.035);
                    for (let i = 0; i < 5; i++) {
                        const spoke = new THREE.Mesh(spokeGeo, matRim);
                        spoke.position.x = isLeft ? 0.08 : -0.08;
                        spoke.rotation.x = (i * Math.PI * 2) / 5;
                        hubGroup.add(spoke);
                    }

                    const capMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 12), matChrome);
                    capMesh.position.x = isLeft ? 0.12 : -0.12; capMesh.rotation.z = Math.PI / 2;
                    hubGroup.add(capMesh);

                    wheelGroup.add(hubGroup);

                    const brakeDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 20), matBrakeDisc);
                    brakeDisc.position.x = isLeft ? -0.02 : 0.02; brakeDisc.rotation.z = Math.PI / 2;
                    wheelGroup.add(brakeDisc);

                    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.08), matCaliper);
                    caliper.position.set(isLeft ? 0.02 : -0.02, 0.1, 0);
                    wheelGroup.add(caliper);

                    this.scene.add(wheelGroup);
                    this.wheelMeshes.push(wheelGroup);
                    this.wheelHubs.push(hubGroup);
                    return wheelGroup;
                };

                createWheelMesh(true);
                createWheelMesh(false);
                createWheelMesh(true);
                createWheelMesh(false);
            }

            initRaycastPhysics(posX, posZ, rotY) {
                this.chassisBody = new CANNON.Body({
                    mass: 1350,
                    material: this.physicsMaterials.wall,
                    position: new CANNON.Vec3(posX, 1.0, posZ),
                    linearDamping: 0.08,
                    angularDamping: 0.5
                });

                const lowerBodyShape = new CANNON.Box(new CANNON.Vec3(0.98, 0.22, 2.15));
                this.chassisBody.addShape(lowerBodyShape, new CANNON.Vec3(0, 0.05, 0));
                const cabinRoofShape = new CANNON.Box(new CANNON.Vec3(0.74, 0.28, 0.95));
                this.chassisBody.addShape(cabinRoofShape, new CANNON.Vec3(0, 0.55, -0.2));

                this.chassisBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotY);
                this.world.addBody(this.chassisBody);

                this.vehicle = new CANNON.RaycastVehicle({
                    chassisBody: this.chassisBody,
                    indexRightAxis: 0,
                    indexUpAxis: 1,
                    indexForwardAxis: 2
                });

                const wheelOptions = {
                    radius: 0.36,
                    directionLocal: new CANNON.Vec3(0, -1, 0),
                    suspensionStiffness: 35,
                    suspensionRestLength: 0.38,
                    maxSuspensionForce: 120000,
                    maxSuspensionTravel: 0.25,
                    dampingCompression: 3.2,
                    dampingRelaxation: 4.0,
                    frictionSlip: 9.5,
                    rollInfluence: 0.06,
                    axleLocal: new CANNON.Vec3(-1, 0, 0),
                    chassisConnectionPointLocal: new CANNON.Vec3(),
                    customSlidingRotationalSpeed: -30,
                    useCustomSlidingRotationalSpeed: true
                };

                const trackW = 0.94;
                const wheelBaseF = 1.35;
                const wheelBaseR = -1.35;

                wheelOptions.chassisConnectionPointLocal.set(-trackW, 0.0, wheelBaseF);
                wheelOptions.isFrontWheel = true;
                this.vehicle.addWheel(wheelOptions);

                wheelOptions.chassisConnectionPointLocal.set(trackW, 0.0, wheelBaseF);
                wheelOptions.isFrontWheel = true;
                this.vehicle.addWheel(wheelOptions);

                wheelOptions.chassisConnectionPointLocal.set(-trackW, 0.0, wheelBaseR);
                wheelOptions.isFrontWheel = false;
                this.vehicle.addWheel(wheelOptions);

                wheelOptions.chassisConnectionPointLocal.set(trackW, 0.0, wheelBaseR);
                wheelOptions.isFrontWheel = false;
                this.vehicle.addWheel(wheelOptions);

                this.vehicle.addToWorld(this.world);

                this.vehicle.setBrake(50, 2);
                this.vehicle.setBrake(50, 3);

                let lastCrashTime = 0;
                this.chassisBody.addEventListener('collide', (e) => {
                    const now = performance.now();
                    if (now - lastCrashTime < 280) return;
                    const contact = e.contact;
                    let impactVelocity = 0;
                    if (contact && typeof contact.getImpactVelocityAlongNormal === 'function') {
                        impactVelocity = Math.abs(contact.getImpactVelocityAlongNormal());
                    } else {
                        impactVelocity = Math.hypot(this.chassisBody.velocity.x, this.chassisBody.velocity.z);
                    }
                    if (impactVelocity > 2.5 && window.soundEngine) {
                        lastCrashTime = now;
                        const pos = this.chassisBody.position;
                        window.soundEngine.playCarCrash(pos.x, pos.y, pos.z, impactVelocity);
                    }
                });
            }

            setDriverDoorAngle(angleRad) {
                this.doorAngle = angleRad;
                if (this.driverDoorPivot) {
                    this.driverDoorPivot.rotation.y = -angleRad;
                }
            }

            isOverturned() {
                const upVec = new CANNON.Vec3(0, 1, 0);
                this.chassisBody.quaternion.vmult(upVec, upVec);
                return upVec.y < 0.25;
            }

            resetToWheels() {
                const currentYaw = this.carGroup.rotation.y;
                this.chassisBody.position.y += 1.4;
                this.chassisBody.velocity.set(0, 0, 0);
                this.chassisBody.angularVelocity.set(0, 0, 0);
                this.chassisBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), currentYaw);
            }

            toggleHeadlights() {
                this.headlightsOn = !this.headlightsOn;
                return this.headlightsOn;
            }

            applyDriverInput(keys, deltaTime) {
                const currentSpeedKmh = this.getSpeedKmh();
                const forwardVelocity = this.getForwardVelocity();

                let forwardForce = 0;
                let brakeForce = 0;

                const isTurbo = keys.sprint;
                const enginePower = isTurbo ? this.maxEngineForce * 1.5 : this.maxEngineForce;

                this.vehicle.setBrake(0, 0);
                this.vehicle.setBrake(0, 1);
                this.vehicle.setBrake(0, 2);
                this.vehicle.setBrake(0, 3);

                const effectiveTopSpeed = isTurbo ? this.topSpeedKmh * 1.08 : this.topSpeedKmh;
                const speedFactor = Math.max(0, 1.0 - (currentSpeedKmh / effectiveTopSpeed));

                if (keys.forward) {
                    this.isAccelerating = true;
                    if (forwardVelocity < -0.8) {
                        brakeForce = this.maxBrakeForce;
                        this.isBrakingState = true;
                    } else {
                        forwardForce = -enginePower * Math.pow(speedFactor, 1.5);
                        this.isBrakingState = false;
                    }
                } else if (keys.backward) {
                    this.isAccelerating = false;
                    if (forwardVelocity > 0.8) {
                        brakeForce = this.maxBrakeForce;
                        this.isBrakingState = true;
                    } else {
                        forwardForce = this.maxReverseForce;
                        this.isBrakingState = false;
                    }
                } else {
                    this.isAccelerating = false;
                    brakeForce = 3.5;
                    this.isBrakingState = false;
                }

                // Определение режима дрифта (только при явном зажатии ручного тормоза / Space)
                const isDrifting = !!(keys.handbrake || keys.jump);

                // Определение типа поверхности под колесами (асфальт vs сельский грунт)
                const cPos = this.chassisBody.position;
                const isOnDirt = (window.gameEngine && window.gameEngine.roadNetwork)
                    ? window.gameEngine.roadNetwork.isPositionOnDirt(cPos.x, cPos.z)
                    : (Math.hypot(cPos.x, cPos.z) > 480.0);

                const baseFrontGrip = isOnDirt ? 7.5 : 11.5;
                const baseRearGrip = isOnDirt ? 7.0 : 10.5;
                const driftFrontGrip = isOnDirt ? 6.5 : 9.0;
                const driftRearGrip = isOnDirt ? 0.95 : 1.45;

                if (isDrifting) {
                    // РЕЖИМ УПРАВЛЯЕМОГО ДРИФТА (Ручной тормоз на Space)
                    this.isBrakingState = true;
                    this.vehicle.wheelInfos[0].frictionSlip = driftFrontGrip;
                    this.vehicle.wheelInfos[1].frictionSlip = driftFrontGrip;
                    this.vehicle.wheelInfos[2].frictionSlip = driftRearGrip;
                    this.vehicle.wheelInfos[3].frictionSlip = driftRearGrip;

                    this.vehicle.setBrake(0, 0);
                    this.vehicle.setBrake(0, 1);
                    this.vehicle.setBrake(120, 2);
                    this.vehicle.setBrake(120, 3);

                    if (Math.abs(this.steeringValue) > 0.04 && currentSpeedKmh > 12.0) {
                        this.chassisBody.angularVelocity.y += this.steeringValue * 2.6 * deltaTime;
                    }
                } else {
                    // СТАНДАРТНЫЙ РЕЖИМ (Плотное стабильное сцепление с асфальтом без заноса)
                    this.vehicle.wheelInfos[0].frictionSlip = baseFrontGrip;
                    this.vehicle.wheelInfos[1].frictionSlip = baseFrontGrip;
                    this.vehicle.wheelInfos[2].frictionSlip = baseRearGrip;
                    this.vehicle.wheelInfos[3].frictionSlip = baseRearGrip;

                    if (brakeForce > 0) {
                        this.vehicle.setBrake(brakeForce * 0.7, 0);
                        this.vehicle.setBrake(brakeForce * 0.7, 1);
                        this.vehicle.setBrake(brakeForce * 1.0, 2);
                        this.vehicle.setBrake(brakeForce * 1.0, 3);
                    } else {
                        this.vehicle.setBrake(0, 0);
                        this.vehicle.setBrake(0, 1);
                        this.vehicle.setBrake(0, 2);
                        this.vehicle.setBrake(0, 3);
                    }

                    // Система курсовой устойчивости (Anti-Spinout ESP): гашение бокового сноса при обычном повороте
                    const localVel = new CANNON.Vec3();
                    this.chassisBody.vectorToLocalFrame(this.chassisBody.velocity, localVel);
                    if (Math.abs(localVel.x) > 0.05) {
                        localVel.x *= Math.exp(-9.5 * deltaTime);
                        this.chassisBody.vectorToWorldFrame(localVel, this.chassisBody.velocity);
                    }
                    this.chassisBody.angularVelocity.y *= Math.exp(-6.5 * deltaTime);
                    this.chassisBody.angularVelocity.x *= Math.exp(-8.0 * deltaTime);
                    this.chassisBody.angularVelocity.z *= Math.exp(-8.0 * deltaTime);
                }

                if (currentSpeedKmh > effectiveTopSpeed) {
                    const dragScale = Math.min(1.0, (currentSpeedKmh - effectiveTopSpeed) * 0.08);
                    this.chassisBody.velocity.x *= (1.0 - dragScale * deltaTime * 8.0);
                    this.chassisBody.velocity.z *= (1.0 - dragScale * deltaTime * 8.0);
                }

                this.vehicle.applyEngineForce(forwardForce * 0.4, 0);
                this.vehicle.applyEngineForce(forwardForce * 0.4, 1);
                this.vehicle.applyEngineForce(forwardForce * 0.6, 2);
                this.vehicle.applyEngineForce(forwardForce * 0.6, 3);

                // Динамическое ограничение угла поворота колес на высокой скорости для плавности
                const steerLimit = THREE.MathUtils.lerp(0.46, 0.08, Math.min(currentSpeedKmh / 140.0, 1.0));
                let targetSteer = 0;

                if (keys.left) targetSteer += steerLimit;
                if (keys.right) targetSteer -= steerLimit;

                this.steeringValue += (targetSteer - this.steeringValue) * Math.min(deltaTime * 8.5, 1.0);
                this.vehicle.setSteeringValue(this.steeringValue, 0);
                this.vehicle.setSteeringValue(this.steeringValue, 1);
            }

            getSpeedKmh() {
                const vel = this.chassisBody.velocity;
                return Math.hypot(vel.x, vel.z) * 3.6;
            }

            getForwardVelocity() {
                const forward = new CANNON.Vec3(0, 0, 1);
                this.chassisBody.quaternion.vmult(forward, forward);
                return this.chassisBody.velocity.dot(forward);
            }

            getGearName() {
                const v = this.getForwardVelocity();
                const speed = this.getSpeedKmh();
                if (v < -0.5) return 'R';
                if (speed < 1.0) return 'N';
                if (speed < 45) return '1';
                if (speed < 75) return '2';
                if (speed < 105) return '3';
                if (speed < 140) return '4';
                if (speed < 180) return '5';
                return '6';
            }

            update(deltaTime) {
                const dt = Math.min(deltaTime, 0.1);

                // Если автомобиль управляется союзником по сети — плавная интерполяция 60 FPS
                if (this.isRemotelyDriven) {
                    const elapsedSec = Math.min(0.2, (performance.now() - (this.netLastPacketTime || performance.now())) / 1000);
                    const predictedPos = this.netTargetPos.clone().addScaledVector(this.netVelocity, elapsedSec);

                    const lerpFactor = 1.0 - Math.exp(-22.0 * dt);
                    this.chassisBody.position.x += (predictedPos.x - this.chassisBody.position.x) * lerpFactor;
                    this.chassisBody.position.y += (predictedPos.y - this.chassisBody.position.y) * lerpFactor;
                    this.chassisBody.position.z += (predictedPos.z - this.chassisBody.position.z) * lerpFactor;
                    this.carGroup.position.copy(this.chassisBody.position);

                    let diffRot = this.netTargetRotY - this.carGroup.rotation.y;
                    while (diffRot > Math.PI) diffRot -= Math.PI * 2;
                    while (diffRot < -Math.PI) diffRot += Math.PI * 2;
                    this.carGroup.rotation.y += diffRot * lerpFactor;
                    this.chassisBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), this.carGroup.rotation.y);

                    const netSpeed = Math.hypot(this.netVelocity.x, this.netVelocity.z);
                    for (let i = 0; i < this.wheelHubs.length; i++) {
                        if (this.wheelHubs[i]) {
                            this.wheelHubs[i].rotation.x += netSpeed * dt * 4.0;
                        }
                    }
                } else {
                    // Защита от проваливания под мир без рывков подвески
                    const groundY = (window.gameEngine && window.gameEngine.terrainManager)
                        ? window.gameEngine.terrainManager.getTerrainHeight(this.chassisBody.position.x, this.chassisBody.position.z)
                        : 0.0;
                    if (this.chassisBody.position.y < groundY - 0.5) {
                        this.chassisBody.position.y = groundY + 0.65;
                        if (this.chassisBody.velocity.y < 0) this.chassisBody.velocity.y = 0;
                    }

                    this.carGroup.position.copy(this.chassisBody.position);
                    this.carGroup.quaternion.copy(this.chassisBody.quaternion);
                }

                const speedKmh = this.isRemotelyDriven ? Math.hypot(this.netVelocity.x, this.netVelocity.z) * 3.6 : this.getSpeedKmh();

                if (this.headlightsOn) {
                    this.spotLightL.intensity = 5.6;
                    this.spotLightR.intensity = 5.6;
                    this.matHeadlightLens.emissiveIntensity = 3.5;
                } else {
                    this.spotLightL.intensity = 0.0;
                    this.spotLightR.intensity = 0.0;
                    this.matHeadlightLens.emissiveIntensity = 0.0;
                }

                if (this.isBrakingState) {
                    this.matTaillight.emissiveIntensity = 5.5;
                    this.matTaillight.color.setHex(0xff3333);
                    this.taillightPoint.intensity = 4.2;
                    this.taillightPoint.color.setHex(0xff1111);
                } else if (this.headlightsOn) {
                    this.matTaillight.emissiveIntensity = 1.4;
                    this.matTaillight.color.setHex(0xcc0000);
                    this.taillightPoint.intensity = 0.8;
                    this.taillightPoint.color.setHex(0xcc0000);
                } else {
                    this.matTaillight.emissiveIntensity = 0.1;
                    this.matTaillight.color.setHex(0x550000);
                    this.taillightPoint.intensity = 0.0;
                }

                for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
                    this.vehicle.updateWheelTransform(i);
                    const transform = this.vehicle.wheelInfos[i].worldTransform;
                    const mesh = this.wheelMeshes[i];
                    const hub = this.wheelHubs[i];

                    if (mesh && transform) {
                        mesh.position.copy(transform.position);
                        mesh.quaternion.copy(transform.quaternion);

                        const rotationSpeed = this.vehicle.wheelInfos[i].deltaRotation || 0;
                        if (hub) {
                            hub.rotation.x += rotationSpeed;
                        }
                    }
                }

                // Обновление клубов дыма из выхлопных труб (на холостом ходу и при движении)
                if (this.smokeSystem) {
                    this.smokeSystem.update(deltaTime, this.carGroup.position, this.carGroup.quaternion, speedKmh, this.isAccelerating);
                }

                // STEP 29: Динамический звук мотора и визга шин
                if (this.soundController) {
                    if (!this.soundController.audioEngine && window.soundEngine) {
                        this.soundController.audioEngine = window.soundEngine;
                    }
                    this.soundController.update(speedKmh, this.isBrakingState, this.steeringValue);
                }
            }

            getSeatOffset(seatIndex = 0) {
                // Локальные смещения для 4 мест
                switch (seatIndex) {
                    case 0: return new THREE.Vector3(-0.42, 0.22, -0.15); // Водитель
                    case 1: return new THREE.Vector3(0.42, 0.22, -0.15);  // Передний пассажир
                    case 2: return new THREE.Vector3(-0.42, 0.22, -0.85); // Задний левый
                    case 3: return new THREE.Vector3(0.42, 0.22, -0.85);  // Задний правый
                    default: return new THREE.Vector3(-0.42, 0.22, -0.15);
                }
            }

            getFirstAvailableSeat() {
                if (!this.occupants) this.occupants = [null, null, null, null];
                for (let i = 0; i < 4; i++) {
                    if (!this.occupants[i]) return i;
                }
                return -1; // Машина полностью заполнена (4/4)
            }

            setOccupant(seatIndex, playerId) {
                if (!this.occupants) this.occupants = [null, null, null, null];
                if (seatIndex >= 0 && seatIndex < 4) {
                    this.occupants[seatIndex] = playerId;
                }
            }

            removeOccupant(playerId) {
                if (!this.occupants) return;
                for (let i = 0; i < 4; i++) {
                    if (this.occupants[i] === playerId) {
                        this.occupants[i] = null;
                    }
                }
            }

            getOccupantCount() {
                if (!this.occupants) return 0;
                let count = 0;
                for (let i = 0; i < 4; i++) {
                    if (this.occupants[i]) count++;
                }
                return count;
            }

            setEcoMode(isEco) {
                if (this.spotLightL) {
                    this.spotLightL.castShadow = false;
                    if (isEco) this.spotLightL.intensity = 0.0;
                }
                if (this.spotLightR) {
                    this.spotLightR.castShadow = false;
                    if (isEco) this.spotLightR.intensity = 0.0;
                }
                if (this.taillightPoint) {
                    if (isEco) this.taillightPoint.intensity = 0.0;
                }
            }
        }

window.DetailedCarModel = DetailedCarModel;
