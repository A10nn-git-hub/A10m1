/**
         * Строитель знаковых зданий
         */
        class OrganizationBuildingBuilder {
            constructor(scene, world, physicsMaterials) {
                this.scene = scene;
                this.world = world;
                this.physicsMaterials = physicsMaterials;
                this.doors = [];

                this.materials = {
                    skyscraperGlass: new THREE.MeshLambertMaterial({
                        map: ProceduralTextureFactory.createSkyscraperGlassTexture()
                    }),
                    mazeSign: new THREE.MeshLambertMaterial({
                        map: ProceduralTextureFactory.createMazeBankSignTexture(), emissive: 0xff1744, emissiveIntensity: 1.2
                    }),
                    lspdSign: new THREE.MeshLambertMaterial({
                        map: ProceduralTextureFactory.createLSPDSignTexture(), emissive: 0x00e5ff, emissiveIntensity: 1.2
                    }),
                    hospitalSign: new THREE.MeshLambertMaterial({
                        map: ProceduralTextureFactory.createHospitalSignTexture(), emissive: 0x00e676, emissiveIntensity: 1.2
                    }),
                    helipad: new THREE.MeshLambertMaterial({ map: ProceduralTextureFactory.createHelipadTexture() }),
                    darkGranite: new THREE.MeshLambertMaterial({ color: 0x1a1e24 }),
                    policeConcrete: new THREE.MeshLambertMaterial({ color: 0x2b333d }),
                    hospitalWhite: new THREE.MeshLambertMaterial({ color: 0xe8eef5 }),

                    // Интерьерные материалы
                    policeFloor: new THREE.MeshLambertMaterial({ map: ProceduralTextureFactory.createPoliceFloorTexture() }),
                    hospitalFloor: new THREE.MeshLambertMaterial({ map: ProceduralTextureFactory.createHospitalFloorTexture() }),
                    marbleFloor: new THREE.MeshLambertMaterial({ map: ProceduralTextureFactory.createMarbleFloorTexture() }),

                    interiorWallBeige: new THREE.MeshLambertMaterial({ color: 0xdfdad2 }),
                    interiorWallBlue: new THREE.MeshLambertMaterial({ color: 0x24334a }),
                    interiorWallTeal: new THREE.MeshLambertMaterial({ color: 0xd4e8e4 }),

                    woodDesk: new THREE.MeshLambertMaterial({ color: 0x5a3d28 }),
                    woodCounter: new THREE.MeshLambertMaterial({ color: 0x3d2716 }),
                    chairFabricBlue: new THREE.MeshLambertMaterial({ color: 0x2563eb }),
                    chairLeatherBlack: new THREE.MeshLambertMaterial({ color: 0x18181b }),

                    ironBars: new THREE.MeshLambertMaterial({ color: 0x27272a }),
                    chromeMetal: new THREE.MeshLambertMaterial({ color: 0xffffff }),
                    goldBar: new THREE.MeshLambertMaterial({ color: 0xffd700 }),
                    cashGreen: new THREE.MeshLambertMaterial({ color: 0x15803d }),

                    glassDoor: new THREE.MeshLambertMaterial({
                        color: 0xe0f2fe, transparent: true, opacity: 0.6
                    }),

                    computerScreen: new THREE.MeshBasicMaterial({
                        map: ProceduralTextureFactory.createComputerScreenTexture('LSPD DISPATCH // ACTIVE')
                    }),
                    hospitalECG: new THREE.MeshBasicMaterial({
                        map: ProceduralTextureFactory.createECGScreenTexture()
                    }),
                    vaultDoorTex: new THREE.MeshStandardMaterial({
                        map: ProceduralTextureFactory.createVaultDoorTexture(), metalness: 0.85, roughness: 0.25
                    }),
                    safeLockers: new THREE.MeshStandardMaterial({
                        map: ProceduralTextureFactory.createSafeDepositBoxesTexture(), metalness: 0.75, roughness: 0.35
                    }),

                    ceilingLamp: new THREE.MeshStandardMaterial({
                        color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.8, roughness: 0.1
                    })
                };

                this.buildMazeBankTower(0, 60);
                this.buildLSPDPrecinct(-60, 60);
                this.buildPillboxHospital(60, 60);
            }

            createStaticBox(x, y, z, width, height, depth) {
                const body = new CANNON.Body({
                    mass: 0,
                    material: this.physicsMaterials.wall,
                    position: new CANNON.Vec3(x, y, z)
                });
                body.addShape(new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2)));
                this.world.addBody(body);
                return body;
            }

            createHingedDoor(group, x, y, z, width, height, isDoubleLeft, maxAngle = Math.PI / 2, doorMat = null) {
                const pivot = new THREE.Group();
                pivot.position.set(x, y, z);

                const panelGeo = new THREE.BoxGeometry(width, height, 0.08);
                const panelMat = doorMat || this.materials.glassDoor;
                const panelMesh = new THREE.Mesh(panelGeo, panelMat);
                panelMesh.position.set(isDoubleLeft ? -width / 2 : width / 2, height / 2, 0);
                panelMesh.castShadow = true;
                pivot.add(panelMesh);

                // Дверная ручка / Push Bar
                const handleGeo = new THREE.BoxGeometry(width * 0.7, 0.06, 0.12);
                const handleMesh = new THREE.Mesh(handleGeo, this.materials.chromeMetal);
                handleMesh.position.set(isDoubleLeft ? -width / 2 : width / 2, height * 0.48, 0);
                pivot.add(handleMesh);

                group.add(pivot);

                // Регистрация интерактивной двери
                const worldPos = new THREE.Vector3(group.position.x + x, group.position.y + y, group.position.z + z);
                this.doors.push({
                    pivot: pivot,
                    pos: worldPos,
                    targetAngle: 0,
                    currentAngle: 0,
                    maxAngle: isDoubleLeft ? -maxAngle : maxAngle,
                    openDist: 3.8
                });
            }

            buildLSPDPrecinct(x, z) {
                const group = new THREE.Group();
                group.position.set(x, 0, z);

                const width = 28;
                const height = 6.2;
                const depth = 24;
                const wallThick = 0.5;
                const doorWidth = 3.2;

                // 1. Пол интерьера
                const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.2, depth - 0.2), this.materials.policeFloor);
                floorMesh.rotation.x = -Math.PI / 2;
                floorMesh.position.y = 0.03;
                floorMesh.receiveShadow = true;
                group.add(floorMesh);

                // 2. Потолок и крыша со сплошным физическим коллайдером
                const roofMesh = new THREE.Mesh(new THREE.BoxGeometry(width + 0.6, 0.6, depth + 0.6), this.materials.policeConcrete);
                roofMesh.position.y = height + 0.3;
                roofMesh.castShadow = true;
                group.add(roofMesh);
                this.createStaticBox(x, height + 0.3, z, width + 0.6, 0.6, depth + 0.6);

                // 3. Внешние стены с дверным проемом спереди
                // Задняя стена
                const backWall = new THREE.Mesh(new THREE.BoxGeometry(width, height, wallThick), this.materials.policeConcrete);
                backWall.position.set(0, height / 2, depth / 2);
                backWall.castShadow = true; backWall.receiveShadow = true;
                group.add(backWall);
                this.createStaticBox(x, height / 2, z + depth / 2, width, height, wallThick);

                // Левая стена
                const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, height, depth), this.materials.policeConcrete);
                leftWall.position.set(-width / 2, height / 2, 0);
                leftWall.castShadow = true; leftWall.receiveShadow = true;
                group.add(leftWall);
                this.createStaticBox(x - width / 2, height / 2, z, wallThick, height, depth);

                // Правая стена
                const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, height, depth), this.materials.policeConcrete);
                rightWall.position.set(width / 2, height / 2, 0);
                rightWall.castShadow = true; rightWall.receiveShadow = true;
                group.add(rightWall);
                this.createStaticBox(x + width / 2, height / 2, z, wallThick, height, depth);

                // Передняя стена (левое крыло)
                const frontSegW = (width - doorWidth) / 2;
                const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(frontSegW, height, wallThick), this.materials.policeConcrete);
                frontLeft.position.set(-(doorWidth / 2 + frontSegW / 2), height / 2, -depth / 2);
                frontLeft.castShadow = true; frontLeft.receiveShadow = true;
                group.add(frontLeft);
                this.createStaticBox(x - (doorWidth / 2 + frontSegW / 2), height / 2, z - depth / 2, frontSegW, height, wallThick);

                // Передняя стена (правое крыло)
                const frontRight = new THREE.Mesh(new THREE.BoxGeometry(frontSegW, height, wallThick), this.materials.policeConcrete);
                frontRight.position.set(doorWidth / 2 + frontSegW / 2, height / 2, -depth / 2);
                frontRight.castShadow = true; frontRight.receiveShadow = true;
                group.add(frontRight);
                this.createStaticBox(x + (doorWidth / 2 + frontSegW / 2), height / 2, z - depth / 2, frontSegW, height, wallThick);

                // Перемычка над дверью
                const doorLintel = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, height - 3.2, wallThick), this.materials.policeConcrete);
                doorLintel.position.set(0, 3.2 + (height - 3.2) / 2, -depth / 2);
                group.add(doorLintel);

                // 4. Функциональные входные двери на петлях
                const singleDoorW = doorWidth / 2 * 0.95;
                this.createHingedDoor(group, -doorWidth / 2, 0, -depth / 2, singleDoorW, 3.1, false, Math.PI / 2.2);
                this.createHingedDoor(group, doorWidth / 2, 0, -depth / 2, singleDoorW, 3.1, true, Math.PI / 2.2);

                // Вывеска над входом
                const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), this.materials.lspdSign);
                signMesh.position.set(0, 4.8, -depth / 2 - 0.26);
                group.add(signMesh);

                // Внутреннее освещение просторного зала LSPD
                const lightPositions = [
                    { lx: 0, ly: 5.2, lz: -5.0, color: 0xddeaff, intensity: 1.8 },
                    { lx: -7.0, ly: 5.2, lz: 3.5, color: 0xebf2ff, intensity: 1.6 },
                    { lx: 8.5, ly: 5.2, lz: 4.5, color: 0xd0e0ff, intensity: 1.6 }
                ];
                for (const lp of lightPositions) {
                    const lampMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.5), this.materials.ceilingLamp);
                    lampMesh.position.set(lp.lx, lp.ly, lp.lz);
                    group.add(lampMesh);

                    const pLight = new THREE.PointLight(lp.color, lp.intensity, 20, 2);
                    pLight.position.set(lp.lx, lp.ly - 0.2, lp.lz);
                    group.add(pLight);
                }

                this.scene.add(group);
            }

            buildPillboxHospital(x, z) {
                const group = new THREE.Group();
                group.position.set(x, 0, z);

                const width = 26;
                const height = 6.4;
                const depth = 24;
                const wallThick = 0.5;
                const doorWidth = 3.4;

                // 1. Пол интерьера
                const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.2, depth - 0.2), this.materials.hospitalFloor);
                floorMesh.rotation.x = -Math.PI / 2;
                floorMesh.position.y = 0.03;
                floorMesh.receiveShadow = true;
                group.add(floorMesh);

                // 2. Потолок и крыша со сплошным физическим коллайдером и вертолетной площадкой ("H")
                const roofMesh = new THREE.Mesh(new THREE.BoxGeometry(width + 0.6, 0.6, depth + 0.6), this.materials.hospitalWhite);
                roofMesh.position.y = height + 0.3;
                roofMesh.castShadow = true;
                group.add(roofMesh);
                this.createStaticBox(x, height + 0.3, z, width + 0.6, 0.6, depth + 0.6);

                // Вертолетная площадка Госпиталя ("H") с прочным физическим коллайдером
                const helipadMesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), this.materials.helipad);
                helipadMesh.rotation.x = -Math.PI / 2;
                helipadMesh.position.set(0, height + 0.62, 0);
                helipadMesh.receiveShadow = true;
                group.add(helipadMesh);
                this.createStaticBox(x, height + 0.6, z, 16.0, 0.65, 16.0);

                // Сигнальные огни вертолетной площадки
                for (let lx of [-7.5, 7.5]) {
                    for (let lz of [-7.5, 7.5]) {
                        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshBasicMaterial({ color: 0x00e676 }));
                        beacon.position.set(lx, height + 0.85, lz);
                        group.add(beacon);
                    }
                }

                // 3. Внешние стены
                // Задняя стена
                const backWall = new THREE.Mesh(new THREE.BoxGeometry(width, height, wallThick), this.materials.hospitalWhite);
                backWall.position.set(0, height / 2, depth / 2);
                backWall.castShadow = true; backWall.receiveShadow = true;
                group.add(backWall);
                this.createStaticBox(x, height / 2, z + depth / 2, width, height, wallThick);

                // Левая стена
                const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, height, depth), this.materials.hospitalWhite);
                leftWall.position.set(-width / 2, height / 2, 0);
                leftWall.castShadow = true; leftWall.receiveShadow = true;
                group.add(leftWall);
                this.createStaticBox(x - width / 2, height / 2, z, wallThick, height, depth);

                // Правая стена
                const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, height, depth), this.materials.hospitalWhite);
                rightWall.position.set(width / 2, height / 2, 0);
                rightWall.castShadow = true; rightWall.receiveShadow = true;
                group.add(rightWall);
                this.createStaticBox(x + width / 2, height / 2, z, wallThick, height, depth);

                // Передняя стена с проемом
                const frontSegW = (width - doorWidth) / 2;
                const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(frontSegW, height, wallThick), this.materials.hospitalWhite);
                frontLeft.position.set(-(doorWidth / 2 + frontSegW / 2), height / 2, -depth / 2);
                frontLeft.castShadow = true; frontLeft.receiveShadow = true;
                group.add(frontLeft);
                this.createStaticBox(x - (doorWidth / 2 + frontSegW / 2), height / 2, z - depth / 2, frontSegW, height, wallThick);

                const frontRight = new THREE.Mesh(new THREE.BoxGeometry(frontSegW, height, wallThick), this.materials.hospitalWhite);
                frontRight.position.set(doorWidth / 2 + frontSegW / 2, height / 2, -depth / 2);
                frontRight.castShadow = true; frontRight.receiveShadow = true;
                group.add(frontRight);
                this.createStaticBox(x + (doorWidth / 2 + frontSegW / 2), height / 2, z - depth / 2, frontSegW, height, wallThick);

                const doorLintel = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, height - 3.2, wallThick), this.materials.hospitalWhite);
                doorLintel.position.set(0, 3.2 + (height - 3.2) / 2, -depth / 2);
                group.add(doorLintel);

                // 4. Входные двери госпиталя на петлях
                const singleDoorW = doorWidth / 2 * 0.95;
                this.createHingedDoor(group, -doorWidth / 2, 0, -depth / 2, singleDoorW, 3.1, false, Math.PI / 2.2);
                this.createHingedDoor(group, doorWidth / 2, 0, -depth / 2, singleDoorW, 3.1, true, Math.PI / 2.2);

                // Вывеска госпиталя
                const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(18, 4.5), this.materials.hospitalSign);
                signMesh.position.set(0, 4.8, -depth / 2 - 0.26);
                group.add(signMesh);

                // Внутреннее освещение просторного зала госпиталя
                const hospitalLights = [
                    { lx: 0, ly: 5.4, lz: -5.0, color: 0xf5faff, intensity: 1.8 },
                    { lx: -6.5, ly: 5.4, lz: 6.0, color: 0xf0f8ff, intensity: 1.7 },
                    { lx: 6.5, ly: 5.4, lz: 6.0, color: 0xf0f8ff, intensity: 1.7 }
                ];
                for (const hl of hospitalLights) {
                    const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 0.5), this.materials.ceilingLamp);
                    lamp.position.set(hl.lx, hl.ly, hl.lz);
                    group.add(lamp);

                    const pLight = new THREE.PointLight(hl.color, hl.intensity, 20, 2);
                    pLight.position.set(hl.lx, hl.ly - 0.2, hl.lz);
                    group.add(pLight);
                }

                this.scene.add(group);
            }

            buildMazeBankTower(x, z) {
                const group = new THREE.Group();
                group.position.set(x, 0, z);

                const width = 24;
                const height = 7.0;
                const depth = 24;
                const wallThick = 0.5;
                const doorWidth = 3.6;

                // 1. Пол вестибюля (Мраморная плитка)
                const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.2, depth - 0.2), this.materials.marbleFloor);
                floorMesh.rotation.x = -Math.PI / 2;
                floorMesh.position.y = 0.03;
                floorMesh.receiveShadow = true;
                group.add(floorMesh);

                // 2. Цоколь и верхняя башня небоскреба (полые цилиндры openEnded=true без внутренних перекрытий, пересекающих шахту)
                const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(18, 19.5, 12, 32, 1, true), this.materials.darkGranite);
                baseMesh.position.y = 13; baseMesh.castShadow = true; baseMesh.receiveShadow = true;
                group.add(baseMesh);

                const towerMesh = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 65, 32, 1, true), this.materials.skyscraperGlass);
                towerMesh.position.y = 51.5; towerMesh.castShadow = true; towerMesh.receiveShadow = true;
                group.add(towerMesh);

                const crownMesh = new THREE.Mesh(new THREE.CylinderGeometry(12.5, 15, 8, 32, 1, true), this.materials.darkGranite);
                crownMesh.position.y = 88; crownMesh.castShadow = true; crownMesh.receiveShadow = true;
                group.add(crownMesh);

                // Вертолетная площадка с аккуратным вырезом под портал лифта (шахта X = -3.5, Z = 0)
                const heliSouth = new THREE.Mesh(new THREE.PlaneGeometry(28, 10.05), this.materials.helipad);
                heliSouth.rotation.x = -Math.PI / 2; heliSouth.position.set(0, 92.05, -8.975);
                group.add(heliSouth);
                this.createStaticBox(x, 92.0, z - 8.975, 28.0, 0.6, 10.05);

                const heliNorth = new THREE.Mesh(new THREE.PlaneGeometry(28, 10.05), this.materials.helipad);
                heliNorth.rotation.x = -Math.PI / 2; heliNorth.position.set(0, 92.05, 8.975);
                group.add(heliNorth);
                this.createStaticBox(x, 92.0, z + 8.975, 28.0, 0.6, 10.05);

                const heliEast = new THREE.Mesh(new THREE.PlaneGeometry(13.55, 7.9), this.materials.helipad);
                heliEast.rotation.x = -Math.PI / 2; heliEast.position.set(7.225, 92.05, 0);
                group.add(heliEast);
                this.createStaticBox(x + 7.225, 92.0, z, 13.55, 0.6, 7.9);

                const heliWest = new THREE.Mesh(new THREE.PlaneGeometry(6.55, 7.9), this.materials.helipad);
                heliWest.rotation.x = -Math.PI / 2; heliWest.position.set(-10.725, 92.05, 0);
                group.add(heliWest);
                this.createStaticBox(x - 10.725, 92.0, z, 6.55, 0.6, 7.9);

                const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), this.materials.mazeSign);
                signMesh.position.set(0, 81, 15.35);
                group.add(signMesh);

                // Физические перекрытия и потолки на каждом этаже Maze Bank Tower
                const floorElevations = [9.0, 18.0, 27.0, 36.0, 45.0, 54.0, 63.0, 72.0, 81.0];
                for (let i = 0; i < floorElevations.length; i++) {
                    const flY = floorElevations[i];
                    // Южный сегмент перекрытия
                    this.createStaticBox(x, flY, z - 8.5, 26.0, 0.4, 9.0);
                    // Северный сегмент перекрытия
                    this.createStaticBox(x, flY, z + 8.5, 26.0, 0.4, 9.0);
                    // Восточный сегмент перекрытия
                    this.createStaticBox(x + 6.5, flY, z, 12.0, 0.4, 8.0);
                    // Западный сегмент перекрытия
                    this.createStaticBox(x - 9.5, flY, z, 6.0, 0.4, 8.0);
                }

                // 3. Внешние стены вестибюля первого этажа
                // Задняя стена
                const backWall = new THREE.Mesh(new THREE.BoxGeometry(width, height, wallThick), this.materials.darkGranite);
                backWall.position.set(0, height / 2, depth / 2);
                backWall.castShadow = true; backWall.receiveShadow = true;
                group.add(backWall);
                this.createStaticBox(x, height / 2, z + depth / 2, width, height, 1.2);

                // Левая стена
                const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, height, depth), this.materials.darkGranite);
                leftWall.position.set(-width / 2, height / 2, 0);
                leftWall.castShadow = true; leftWall.receiveShadow = true;
                group.add(leftWall);
                this.createStaticBox(x - width / 2, height / 2, z, 1.2, height, depth);

                // Правая стена
                const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, height, depth), this.materials.darkGranite);
                rightWall.position.set(width / 2, height / 2, 0);
                rightWall.castShadow = true; rightWall.receiveShadow = true;
                group.add(rightWall);
                this.createStaticBox(x + width / 2, height / 2, z, 1.2, height, depth);

                // Передняя стена с дверным порталом
                const frontSegW = (width - doorWidth) / 2;
                const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(frontSegW, height, wallThick), this.materials.darkGranite);
                frontLeft.position.set(-(doorWidth / 2 + frontSegW / 2), height / 2, -depth / 2);
                frontLeft.castShadow = true; frontLeft.receiveShadow = true;
                group.add(frontLeft);
                this.createStaticBox(x - (doorWidth / 2 + frontSegW / 2), height / 2, z - depth / 2, frontSegW, height, 1.2);

                const frontRight = new THREE.Mesh(new THREE.BoxGeometry(frontSegW, height, wallThick), this.materials.darkGranite);
                frontRight.position.set(doorWidth / 2 + frontSegW / 2, height / 2, -depth / 2);
                frontRight.castShadow = true; frontRight.receiveShadow = true;
                group.add(frontRight);
                this.createStaticBox(x + (doorWidth / 2 + frontSegW / 2), height / 2, z - depth / 2, frontSegW, height, 1.2);

                const doorLintel = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, height - 3.4, wallThick), this.materials.darkGranite);
                doorLintel.position.set(0, 3.4 + (height - 3.4) / 2, -depth / 2);
                group.add(doorLintel);

                // Внешние стены вестибюля первого этажа уже имеют точные физические коллайдеры на стенах

                // 4. Входные двери банка на петлях
                const singleDoorW = doorWidth / 2 * 0.95;
                this.createHingedDoor(group, -doorWidth / 2, 0, -depth / 2, singleDoorW, 3.3, false, Math.PI / 2.2);
                this.createHingedDoor(group, doorWidth / 2, 0, -depth / 2, singleDoorW, 3.3, true, Math.PI / 2.2);

                // Вывеска над дверями банка
                const bankSignMesh = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), this.materials.mazeSign);
                bankSignMesh.position.set(0, 5.2, -depth / 2 - 0.26);
                group.add(bankSignMesh);

                // Освещение вестибюля Maze Bank
                const bankLights = [
                    { lx: -5.5, ly: 5.8, lz: -4.0, color: 0xffeedb, intensity: 2.2 },
                    { lx: 5.5, ly: 5.8, lz: -4.0, color: 0xffeedb, intensity: 2.2 },
                    { lx: 0.0, ly: 5.8, lz: 5.0, color: 0xfffaea, intensity: 2.4 }
                ];
                for (const bl of bankLights) {
                    const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 0.8), this.materials.ceilingLamp);
                    lamp.position.set(bl.lx, bl.ly, bl.lz);
                    group.add(lamp);

                    const pLight = new THREE.PointLight(bl.color, bl.intensity, 22, 2);
                    pLight.position.set(bl.lx, bl.ly - 0.2, bl.lz);
                    group.add(pLight);
                }

                this.scene.add(group);
            }

            update(deltaTime, playerPosition) {
                if (!playerPosition) return;

                // Плавная анимация открытия/закрытия дверей при приближении игрока
                const dt = Math.min(deltaTime, 0.1);
                for (let i = 0; i < this.doors.length; i++) {
                    const door = this.doors[i];
                    const dx = playerPosition.x - door.pos.x;
                    const dz = playerPosition.z - door.pos.z;
                    const distSq = dx * dx + dz * dz;

                    if (distSq < door.openDist * door.openDist) {
                        door.targetAngle = door.maxAngle;
                    } else {
                        door.targetAngle = 0.0;
                    }

                    door.currentAngle += (door.targetAngle - door.currentAngle) * Math.min(dt * 7.0, 1.0);
                    door.pivot.rotation.y = door.currentAngle;
                }
            }

            updateNightLighting(nightFactor) {
                this.materials.skyscraperGlass.emissiveIntensity = nightFactor * 2.2;
                this.materials.mazeSign.emissiveIntensity = 1.4 + nightFactor * 1.8;
                this.materials.lspdSign.emissiveIntensity = 1.4 + nightFactor * 1.8;
                this.materials.hospitalSign.emissiveIntensity = 1.4 + nightFactor * 1.8;
            }
        }
