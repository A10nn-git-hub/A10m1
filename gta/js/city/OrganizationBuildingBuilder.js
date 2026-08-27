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
                    mazeGlassFacade: new THREE.MeshLambertMaterial({
                        map: ProceduralTextureFactory.createMazeBankGlassFacadeTexture()
                    }),
                    blackMarble: new THREE.MeshLambertMaterial({
                        map: ProceduralTextureFactory.createLuxuryBlackMarbleTexture()
                    }),
                    mazeSign: new THREE.MeshBasicMaterial({
                        map: ProceduralTextureFactory.createMazeBankSignTexture()
                    }),
                    mazeCrest: new THREE.MeshBasicMaterial({
                        map: ProceduralTextureFactory.createMazeBankCrestTexture()
                    }),
                    stockTicker: new THREE.MeshBasicMaterial({
                        map: ProceduralTextureFactory.createStockTickerTexture()
                    }),
                    brushedGold: new THREE.MeshLambertMaterial({
                        color: 0xdeb841,
                        emissive: 0x1f1900
                    }),
                    titaniumFrame: new THREE.MeshLambertMaterial({
                        color: 0x334155
                    }),
                    chromeMetal: new THREE.MeshLambertMaterial({
                        color: 0xcfd8dc
                    }),
                    woodCounter: new THREE.MeshLambertMaterial({
                        color: 0x5c2c16
                    }),
                    sofaLeather: new THREE.MeshLambertMaterial({
                        color: 0x22262c
                    }),
                    glassTable: new THREE.MeshLambertMaterial({
                        color: 0xa5f3fc,
                        transparent: true,
                        opacity: 0.75
                    }),
                    foliageMat: new THREE.MeshLambertMaterial({
                        color: 0x16a34a
                    }),
                    planterMat: new THREE.MeshLambertMaterial({
                        color: 0xd97706
                    }),
                    turnstileMetal: new THREE.MeshLambertMaterial({
                        color: 0x475569
                    }),
                    turnstileGlass: new THREE.MeshLambertMaterial({
                        color: 0x22c55e,
                        transparent: true,
                        opacity: 0.8
                    }),
                    vaultDoor: new THREE.MeshLambertMaterial({
                        map: ProceduralTextureFactory.createVaultDoorTexture()
                    }),
                    safeDeposit: new THREE.MeshLambertMaterial({
                        map: ProceduralTextureFactory.createSafeDepositBoxesTexture()
                    }),
                    lspdSign: new THREE.MeshBasicMaterial({
                        map: ProceduralTextureFactory.createLSPDSignTexture()
                    }),
                    hospitalSign: new THREE.MeshBasicMaterial({
                        map: ProceduralTextureFactory.createHospitalSignTexture()
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
                    chairLeatherBlack: new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5, metalness: 0.2 }),

                    ironBars: new THREE.MeshLambertMaterial({ color: 0x27272a }),
                    chromeMetal: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.95 }),
                    goldBar: new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.2, metalness: 0.95 }),
                    cashGreen: new THREE.MeshLambertMaterial({ color: 0x15803d }),

                    glassDoor: new THREE.MeshStandardMaterial({
                        color: 0x93c5fd, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.6
                    }),
                    glassWall: new THREE.MeshStandardMaterial({
                        color: 0x60a5fa, transparent: true, opacity: 0.45, roughness: 0.08, metalness: 0.8
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

                // Физический барьер проема двери, препятствующий проходу до полного открытия
                const barrierBody = new CANNON.Body({
                    mass: 0,
                    material: this.physicsMaterials.wall,
                    position: new CANNON.Vec3(worldPos.x, worldPos.y + height / 2, worldPos.z)
                });
                barrierBody.addShape(new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, 0.25)));
                this.world.addBody(barrierBody);

                this.doors.push({
                    pivot: pivot,
                    pos: worldPos,
                    height: height,
                    barrier: barrierBody,
                    barrierPos: { x: worldPos.x, y: worldPos.y + height / 2, z: worldPos.z },
                    targetAngle: 0,
                    currentAngle: 0,
                    maxAngle: isDoubleLeft ? -maxAngle : maxAngle,
                    openDist: 4.2
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

                const width = 30.0;
                const lobbyHeight = 8.5;
                const depth = 30.0;
                const wallThick = 0.6;
                const doorWidth = 4.6;

                // 1. ВНЕШНЯЯ ПЛАЗА И СТУПЕНИ ВХОДА (Y = 0)
                const plazaMesh = new THREE.Mesh(new THREE.BoxGeometry(38.0, 0.2, 42.0), this.materials.blackMarble);
                plazaMesh.position.set(0, 0.1, 2.0);
                plazaMesh.receiveShadow = true;
                group.add(plazaMesh);
                this.createStaticBox(x, 0.1, z + 2.0, 38.0, 0.2, 42.0);

                // 2. ПОЛ ВЕСТИБЮЛЯ (Элитный полированный мрамор)
                const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.4, depth - 0.4), this.materials.marbleFloor);
                floorMesh.rotation.x = -Math.PI / 2;
                floorMesh.position.y = 0.22;
                floorMesh.receiveShadow = true;
                group.add(floorMesh);

                // Кессонный потолок первого этажа (Grand Lobby Ceiling)
                const ceilingMesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.6, depth), this.materials.blackMarble);
                ceilingMesh.position.set(0, lobbyHeight + 0.3, 0);
                group.add(ceilingMesh);
                this.createStaticBox(x, lobbyHeight + 0.3, z, width, 0.6, depth);

                // 3. ПАНОРАМНЫЙ СТЕКЛЯННЫЙ ФАСАД И КОЛОННЫ ВЕСТИБЮЛЯ (1 ЭТАЖ)
                // Задняя стена (Север, Z = +15)
                const backWallMesh = new THREE.Mesh(new THREE.BoxGeometry(width, lobbyHeight, wallThick), this.materials.mazeGlassFacade);
                backWallMesh.position.set(0, lobbyHeight / 2 + 0.2, depth / 2);
                backWallMesh.castShadow = true;
                group.add(backWallMesh);
                this.createStaticBox(x, lobbyHeight / 2 + 0.2, z + depth / 2, width, lobbyHeight, wallThick);

                // Левая стеклянная стена (Запад, X = -15)
                const leftWallMesh = new THREE.Mesh(new THREE.BoxGeometry(wallThick, lobbyHeight, depth), this.materials.mazeGlassFacade);
                leftWallMesh.position.set(-width / 2, lobbyHeight / 2 + 0.2, 0);
                leftWallMesh.castShadow = true;
                group.add(leftWallMesh);
                this.createStaticBox(x - width / 2, lobbyHeight / 2 + 0.2, z, wallThick, lobbyHeight, depth);

                // Правая стеклянная стена (Восток, X = +15)
                const rightWallMesh = new THREE.Mesh(new THREE.BoxGeometry(wallThick, lobbyHeight, depth), this.materials.mazeGlassFacade);
                rightWallMesh.position.set(width / 2, lobbyHeight / 2 + 0.2, 0);
                rightWallMesh.castShadow = true;
                group.add(rightWallMesh);
                this.createStaticBox(x + width / 2, lobbyHeight / 2 + 0.2, z, wallThick, lobbyHeight, depth);

                // Передняя стена с парадным входом (Юг, Z = -15)
                const frontSegW = (width - doorWidth) / 2;
                const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(frontSegW, lobbyHeight, wallThick), this.materials.mazeGlassFacade);
                frontLeft.position.set(-(doorWidth / 2 + frontSegW / 2), lobbyHeight / 2 + 0.2, -depth / 2);
                group.add(frontLeft);
                this.createStaticBox(x - (doorWidth / 2 + frontSegW / 2), lobbyHeight / 2 + 0.2, z - depth / 2, frontSegW, lobbyHeight, wallThick);

                const frontRight = new THREE.Mesh(new THREE.BoxGeometry(frontSegW, lobbyHeight, wallThick), this.materials.mazeGlassFacade);
                frontRight.position.set(doorWidth / 2 + frontSegW / 2, lobbyHeight / 2 + 0.2, -depth / 2);
                group.add(frontRight);
                this.createStaticBox(x + (doorWidth / 2 + frontSegW / 2), lobbyHeight / 2 + 0.2, z - depth / 2, frontSegW, lobbyHeight, wallThick);

                // Перемычка над дверным порталом
                const doorLintel = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, lobbyHeight - 3.8, wallThick), this.materials.blackMarble);
                doorLintel.position.set(0, 3.8 + (lobbyHeight - 3.8) / 2 + 0.2, -depth / 2);
                group.add(doorLintel);

                // Входные двухстворчатые двери из ударопрочного стекла
                const singleDoorW = (doorWidth / 2) * 0.95;
                this.createHingedDoor(group, -doorWidth / 2, 0.2, -depth / 2, singleDoorW, 3.6, false, Math.PI / 2.2, this.materials.glassDoor);
                this.createHingedDoor(group, doorWidth / 2, 0.2, -depth / 2, singleDoorW, 3.6, true, Math.PI / 2.2, this.materials.glassDoor);

                // 4. ПАРАДНЫЙ КОЗЫРЕК ВХОДА (Cantilevered Entrance Canopy)
                const canopyMesh = new THREE.Mesh(new THREE.BoxGeometry(10.0, 0.4, 5.5), this.materials.titaniumFrame);
                canopyMesh.position.set(0, 4.2, -depth / 2 - 2.6);
                group.add(canopyMesh);

                const canopyGlass = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.1, 5.0), this.materials.glassWall);
                canopyGlass.position.set(0, 4.45, -depth / 2 - 2.6);
                group.add(canopyGlass);

                // Светящаяся вывеска MAZE BANK на козырьке
                const canopySign = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 2.0), this.materials.mazeSign);
                canopySign.position.set(0, 4.2, -depth / 2 - 5.38);
                group.add(canopySign);

                // Светильники подсветки входа под козырьком
                const canopyLight1 = new THREE.PointLight(0xffeedb, 2.5, 15);
                canopyLight1.position.set(-3.0, 3.8, -depth / 2 - 2.5);
                group.add(canopyLight1);

                const canopyLight2 = new THREE.PointLight(0xffeedb, 2.5, 15);
                canopyLight2.position.set(3.0, 3.8, -depth / 2 - 2.5);
                group.add(canopyLight2);

                // 5. ОЗЕЛЕНЕНИЕ И БОЛЛАРДЫ ПЛАЗЫ ВХОДА
                const planterGeo = new THREE.BoxGeometry(2.2, 0.8, 2.2);
                const planterMat = this.materials.blackMarble;
                const foliageMat = new THREE.MeshLambertMaterial({ color: 0x225522 });
                const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a321f });

                const planterCoords = [
                    { px: -8.5, pz: -depth / 2 - 5.5 },
                    { px: 8.5, pz: -depth / 2 - 5.5 },
                    { px: -14.5, pz: -depth / 2 - 5.5 },
                    { px: 14.5, pz: -depth / 2 - 5.5 }
                ];

                for (const pc of planterCoords) {
                    const pl = new THREE.Mesh(planterGeo, planterMat);
                    pl.position.set(pc.px, 0.4, pc.pz);
                    group.add(pl);
                    this.createStaticBox(x + pc.px, 0.4, z + pc.pz, 2.2, 0.8, 2.2);

                    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 2.2, 8), trunkMat);
                    trunk.position.set(pc.px, 1.5, pc.pz);
                    group.add(trunk);

                    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.0, 8, 8), foliageMat);
                    crown.position.set(pc.px, 2.6, pc.pz);
                    crown.scale.set(1.1, 0.6, 1.1);
                    group.add(crown);
                }

                // Защитные бордюры и болларды по периметру плазы (защита от заезда AI-трафика на ступени)
                this.createStaticBox(x, 0.45, z - depth / 2 - 8.2, 38.0, 0.9, 0.6);
                this.createStaticBox(x - 19.2, 0.45, z + 2.0, 0.6, 0.9, 42.0);
                this.createStaticBox(x + 19.2, 0.45, z + 2.0, 0.6, 0.9, 42.0);

                // 6. ИНТЕРЬЕР ГЛАВНОГО ВЕСТИБЮЛЯ (GRAND LOBBY INTERIOR)
                // 4 Величественные мраморные колонны
                const colCoords = [
                    { cx: -8.0, cz: -6.5 },
                    { cx: 8.0, cz: -6.5 },
                    { cx: -8.0, cz: 6.5 },
                    { cx: 8.0, cz: 6.5 }
                ];
                const colGeo = new THREE.CylinderGeometry(0.7, 0.7, lobbyHeight, 16);
                const colCapGeo = new THREE.BoxGeometry(1.8, 0.35, 1.8);

                for (const cc of colCoords) {
                    const colMesh = new THREE.Mesh(colGeo, this.materials.blackMarble);
                    colMesh.position.set(cc.cx, lobbyHeight / 2 + 0.2, cc.cz);
                    colMesh.castShadow = true;
                    group.add(colMesh);

                    const capBase = new THREE.Mesh(colCapGeo, this.materials.brushedGold);
                    capBase.position.set(cc.cx, 0.35, cc.cz);
                    group.add(capBase);

                    const capTop = new THREE.Mesh(colCapGeo, this.materials.brushedGold);
                    capTop.position.set(cc.cx, lobbyHeight + 0.05, cc.cz);
                    group.add(capTop);

                    this.createStaticBox(x + cc.cx, lobbyHeight / 2 + 0.2, z + cc.cz, 1.5, lobbyHeight, 1.5);
                }

                // Парадная стойка ресепшн (Reception Desk) в центре
                const recDesk = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.15, 1.6), this.materials.woodCounter);
                recDesk.position.set(0, 0.75, -2.5);
                group.add(recDesk);
                this.createStaticBox(x, 0.75, z - 2.5, 5.2, 1.15, 1.6);

                const recGoldTrim = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.12, 1.65), this.materials.brushedGold);
                recGoldTrim.position.set(0, 1.25, -2.5);
                group.add(recGoldTrim);

                // Компьютерные терминалы на стойке
                const pcMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });
                for (let px of [-1.4, 1.4]) {
                    const mon = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.08), pcMat);
                    mon.position.set(px, 1.6, -2.4);
                    group.add(mon);
                }

                // Задняя панель ресепшн с гербом Maze Bank
                const featWall = new THREE.Mesh(new THREE.BoxGeometry(6.4, 4.8, 0.4), this.materials.blackMarble);
                featWall.position.set(0, 2.6, 2.0);
                group.add(featWall);
                this.createStaticBox(x, 2.6, z + 2.0, 6.4, 4.8, 0.4);

                const crestMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), this.materials.mazeCrest);
                crestMesh.position.set(0, 3.0, 1.78);
                crestMesh.rotation.y = Math.PI;
                group.add(crestMesh);

                // Лаунж-зона с кожаными диванами (Западное крыло, X = -8, Z = -1)
                const sofaGeo = new THREE.BoxGeometry(3.6, 0.85, 1.2);
                const sofa = new THREE.Mesh(sofaGeo, this.materials.chairLeatherBlack);
                sofa.position.set(-8.5, 0.65, -1.0);
                group.add(sofa);
                this.createStaticBox(x - 8.5, 0.65, z - 1.0, 3.6, 0.85, 1.2);

                const coffeeTable = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.45, 1.0), this.materials.brushedGold);
                coffeeTable.position.set(-8.5, 0.45, -2.6);
                group.add(coffeeTable);

                const tableGlass = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 1.1), this.materials.glassDoor);
                tableGlass.position.set(-8.5, 0.7, -2.6);
                group.add(tableGlass);

                // Финансовое табло и электронная биржа (Восточное крыло, X = +8, Z = -1)
                const tickerMesh = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.2), this.materials.stockTicker);
                tickerMesh.position.set(14.65, 4.2, -1.0);
                tickerMesh.rotation.y = -Math.PI / 2;
                group.add(tickerMesh);

                // Банковское хранилище (Бронированная дверь и ячейки на северо-востоке)
                const vaultDoor = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), this.materials.vaultDoorTex);
                vaultDoor.position.set(8.5, 2.2, depth / 2 - 0.25);
                vaultDoor.rotation.y = Math.PI;
                group.add(vaultDoor);

                const safeWall = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 3.6), this.materials.safeLockers);
                safeWall.position.set(-8.5, 2.2, depth / 2 - 0.25);
                safeWall.rotation.y = Math.PI;
                group.add(safeWall);

                // Электронные турникеты на входе
                const turnstileMat = this.materials.titaniumFrame;
                for (let tx of [-2.4, -0.8, 0.8, 2.4]) {
                    const ts = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.05, 1.4), turnstileMat);
                    ts.position.set(tx, 0.72, -9.5);
                    group.add(ts);

                    const led = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.12), new THREE.MeshBasicMaterial({ color: 0x00ff88 }));
                    led.position.set(tx, 1.28, -9.5);
                    group.add(led);
                }

                // Портал шахты лифта (Шахта расположена на X = -3.5, Z = 0)
                const elevPortal = new THREE.Mesh(new THREE.BoxGeometry(5.2, 4.4, 0.4), this.materials.brushedGold);
                elevPortal.position.set(-3.5, 2.4, -4.2);
                group.add(elevPortal);

                // Освещение вестибюля (6 люстр с локализованным светом радиусом 11м - без пробивания наружу)
                const lobbyLamps = [
                    { lx: -7.5, ly: 7.6, lz: -7.5, col: 0xfffaed, intensity: 2.2 },
                    { lx: 7.5, ly: 7.6, lz: -7.5, col: 0xfffaed, intensity: 2.2 },
                    { lx: 0.0, ly: 7.6, lz: -2.5, col: 0xffeedb, intensity: 2.8 },
                    { lx: 0.0, ly: 7.6, lz: 7.5, col: 0xffeedb, intensity: 2.4 },
                    { lx: -8.0, ly: 7.6, lz: 7.5, col: 0xfffaed, intensity: 2.0 },
                    { lx: 8.0, ly: 7.6, lz: 7.5, col: 0xfffaed, intensity: 2.0 }
                ];

                for (const ll of lobbyLamps) {
                    const chGeo = new THREE.BoxGeometry(2.4, 0.2, 2.4);
                    const chMesh = new THREE.Mesh(chGeo, this.materials.brushedGold);
                    chMesh.position.set(ll.lx, ll.ly, ll.lz);
                    group.add(chMesh);

                    const chCore = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 2.0), this.materials.ceilingLamp);
                    chCore.position.set(ll.lx, ll.ly - 0.15, ll.lz);
                    group.add(chCore);

                    const pLight = new THREE.PointLight(ll.col, ll.intensity, 11, 2);
                    pLight.position.set(ll.lx, ll.ly - 0.4, ll.lz);
                    group.add(pLight);
                }

                // 7. ОСНОВНОЙ ВЫСОТНЫЙ КОРПУС НЕБОСКРЕБА (TOWER FACADE, Y = 9.0..92.0м)
                // Секция 1: Нижняя башня (Y = 9м .. 45м) - ПОЛЫЕ СТЕНЫ БЕЗ СПЛОШНОГО ЦЕНТРА
                const towerLower = new THREE.Mesh(new THREE.BoxGeometry(24.0, 36.0, 24.0), this.materials.mazeGlassFacade);
                towerLower.position.set(0, 27.0, 0);
                towerLower.castShadow = true;
                group.add(towerLower);

                // 4 внешние стены секции 1 (шахта и интерьеры этажей свободны!)
                this.createStaticBox(x, 27.0, z + 11.7, 24.0, 36.0, 0.6);
                this.createStaticBox(x, 27.0, z - 11.7, 24.0, 36.0, 0.6);
                this.createStaticBox(x - 11.7, 27.0, z, 0.6, 36.0, 24.0);
                this.createStaticBox(x + 11.7, 27.0, z, 0.6, 36.0, 24.0);

                // Декоративные титановые ребра жесткости (Mullions)
                for (let rx of [-12.1, 12.1]) {
                    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.4, 36.0, 24.2), this.materials.titaniumFrame);
                    rib.position.set(rx, 27.0, 0);
                    group.add(rib);
                }

                // Секция 2: Средняя башня со скошенными гранями (Y = 45м .. 80м) - ПОЛЫЕ СТЕНЫ
                const towerMid = new THREE.Mesh(new THREE.CylinderGeometry(13.5, 15.0, 35.0, 16), this.materials.mazeGlassFacade);
                towerMid.position.set(0, 62.5, 0);
                towerMid.castShadow = true;
                group.add(towerMid);

                // Полноценный 16-гранный полый физический барьер секции 2 (радиус 14.3м, 100% покрытие всех углов)
                const segSides = 16;
                const rMid = 14.3;
                const segWMid = 2 * rMid * Math.tan(Math.PI / segSides) * 1.05; // ~5.8м
                for (let i = 0; i < segSides; i++) {
                    const ang = i * (Math.PI * 2 / segSides) + (Math.PI / segSides);
                    const segPx = x + Math.sin(ang) * rMid;
                    const segPz = z + Math.cos(ang) * rMid;
                    const wallBox = this.createStaticBox(segPx, 62.5, segPz, segWMid, 35.0, 1.2);
                    wallBox.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), ang);
                }

                // Секция 3: Корона небоскреба с логотипами Maze Bank (Y = 80м .. 92м) - ПОЛЫЕ СТЕНЫ
                const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(14.2, 13.5, 12.0, 16), this.materials.blackMarble);
                crownBase.position.set(0, 86.0, 0);
                crownBase.castShadow = true;
                group.add(crownBase);

                // Полноценный 16-гранный полый физический барьер секции 3 (радиус 13.9м, 100% защита вывесок и стен)
                const rCrown = 13.9;
                const segWCrown = 2 * rCrown * Math.tan(Math.PI / segSides) * 1.05;
                for (let i = 0; i < segSides; i++) {
                    const ang = i * (Math.PI * 2 / segSides) + (Math.PI / segSides);
                    const segPx = x + Math.sin(ang) * rCrown;
                    const segPz = z + Math.cos(ang) * rCrown;
                    const wallBox = this.createStaticBox(segPx, 86.0, segPz, segWCrown, 12.0, 1.2);
                    wallBox.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), ang);
                }

                // 4 Гигантские светящиеся вывески MAZE BANK на всех 4-х сторонах короны
                const crownSigns = [
                    { sx: 0, sy: 86.5, sz: 14.1, rotY: 0 },
                    { sx: 0, sy: 86.5, sz: -14.1, rotY: Math.PI },
                    { sx: 14.1, sy: 86.5, sz: 0, rotY: Math.PI / 2 },
                    { sx: -14.1, sy: 86.5, sz: 0, rotY: -Math.PI / 2 }
                ];
                for (const cs of crownSigns) {
                    const cSign = new THREE.Mesh(new THREE.PlaneGeometry(15.0, 3.8), this.materials.mazeSign);
                    cSign.position.set(cs.sx, cs.sy, cs.sz);
                    cSign.rotation.y = cs.rotY;
                    group.add(cSign);
                }

                // Красные неоновые кольца на короне башни
                const neonRing1 = new THREE.Mesh(new THREE.RingGeometry(13.6, 14.3, 32), new THREE.MeshBasicMaterial({ color: 0xff1744, side: THREE.DoubleSide }));
                neonRing1.rotation.x = Math.PI / 2;
                neonRing1.position.set(0, 91.8, 0);
                group.add(neonRing1);

                // 8. КРЫША И ВЕРТОЛЕТНАЯ ПЛОЩАДКА (HELIPAD, Y = 92.0м)
                const heliRoof = new THREE.Mesh(new THREE.CylinderGeometry(14.8, 14.8, 0.8, 16), this.materials.helipad);
                heliRoof.position.set(0, 92.0, 0);
                heliRoof.receiveShadow = true;
                group.add(heliRoof);

                // Сплошная монолитная платформа вертодрома с полным покрытием круга радиусом 14.8м (R=14.8м)
                const rHeli = 14.8;
                for (let i = 0; i < 8; i++) {
                    const ang = i * (Math.PI / 8);
                    const roofBox = this.createStaticBox(x, 92.0, z, rHeli * 2, 0.8, rHeli * 2 * 0.42);
                    roofBox.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), ang);
                }

                // Периметральные желтые посадочные огни вертодрома
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
                    const hx = Math.cos(a) * 14.2;
                    const hz = Math.sin(a) * 14.2;
                    const hLightMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.35, 8), this.materials.brushedGold);
                    hLightMesh.position.set(hx, 92.55, hz);
                    group.add(hLightMesh);

                    const hLight = new THREE.PointLight(0xffd700, 1.2, 8);
                    hLight.position.set(hx, 92.8, hz);
                    group.add(hLight);
                }

                // Коммуникационный шпиль и радиомачта смещены на технический край (X = +11.8м) для 100% чистого воздушного пространства над вертодромом
                const spireGeo = new THREE.CylinderGeometry(0.15, 0.45, 22.0, 8);
                const spireMesh = new THREE.Mesh(spireGeo, this.materials.chromeMetal);
                spireMesh.position.set(11.8, 103.0, 0);
                group.add(spireMesh);

                // Мигающий красный авиационный маяк на вершине шпиля
                const spireBeacon = new THREE.PointLight(0xff1744, 3.5, 45);
                spireBeacon.position.set(11.8, 114.2, 0);
                group.add(spireBeacon);

                const beaconBulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff1744 }));
                beaconBulb.position.set(11.8, 114.2, 0);
                group.add(beaconBulb);

                // Физические перекрытия промежуточных этажей внутри башни (полное совпадение с высотами лифта 9м, 18м, 27м...)
                const floorElevations = [9.0, 18.0, 27.0, 36.0, 45.0, 54.0, 63.0, 72.0];
                for (let i = 0; i < floorElevations.length; i++) {
                    const flY = floorElevations[i];
                    this.createStaticBox(x, flY, z - 7.5, 22.0, 0.4, 7.5);
                    this.createStaticBox(x, flY, z + 7.5, 22.0, 0.4, 7.5);
                    this.createStaticBox(x + 5.5, flY, z, 10.0, 0.4, 7.0);
                    this.createStaticBox(x - 8.5, flY, z, 5.0, 0.4, 7.0);
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

                    door.currentAngle = THREE.MathUtils.lerp(door.currentAngle, door.targetAngle, 1.0 - Math.exp(-9.0 * dt));
                    door.pivot.rotation.y = door.currentAngle;

                    // Физический барьер: проход блокируется до момента, пока створка не распахнется более чем на 65%
                    if (door.barrier) {
                        const progress = Math.abs(door.currentAngle / (door.maxAngle || 1.0));
                        if (progress < 0.65) {
                            door.barrier.position.set(door.barrierPos.x, door.barrierPos.y, door.barrierPos.z);
                        } else {
                            door.barrier.position.set(door.barrierPos.x, -100, door.barrierPos.z);
                        }
                    }
                }
            }

            updateNightLighting(nightFactor) {
                // Вывески и стекло надежно светятся в любое время суток
            }
        }

window.OrganizationBuildingBuilder = OrganizationBuildingBuilder;

