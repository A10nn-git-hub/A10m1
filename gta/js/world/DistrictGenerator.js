/**
         * STEP 32: Комплексный процедурный генератор районов открытого мира (Downtown, Industrial, Commercial)
         * - Downtown: гигантские стеклянные небоскребы с 4 темами остекления, вертолетными площадками, шпилями и коронами.
         * - Industrial: кирпичные фабрики с пилообразными крышами, высокими дымоходными трубами (38-48м), складами и заборами из сетки-рабицы.
         * - Commercial: малоэтажные магазины с витринами, навесами, кондиционерами на крышах и светящимися процедурными неоновыми вывесками (24/7, LS Customs, Guns & Ammo, Neon Lounge, Diner, Pharmacy, Tech).
         * - Полная поддержка High-LOD геометрии, коллизий Cannon.js и легковесных Low-LOD прокси-силуэтов!
         */
        class DistrictGenerator {
            constructor(scene, world, physicsMaterials, chunkManager) {
                this.scene = scene;
                this.world = world;
                this.physicsMaterials = physicsMaterials;
                this.chunkManager = chunkManager;

                this.initMaterials();
                this.generateDistricts();
            }

            initMaterials() {
                // Атласы остекления небоскребов (Sapphire, Emerald, Bronze, Obsidian)
                this.skyscraperMats = [];
                for (let i = 0; i < 4; i++) {
                    this.skyscraperMats.push(new THREE.MeshLambertMaterial({
                        map: ProceduralTextureFactory.createSkyscraperAtlas(i)
                    }));
                }

                // Индустриальные материалы
                this.matIndustrialBrick = new THREE.MeshLambertMaterial({
                    map: ProceduralTextureFactory.createIndustrialBrickAtlas()
                });
                this.matCorrugatedSteel = new THREE.MeshLambertMaterial({
                    map: ProceduralTextureFactory.createCorrugatedSteelTexture('#525e75')
                });
                this.matCorrugatedWarehouse = new THREE.MeshLambertMaterial({
                    map: ProceduralTextureFactory.createCorrugatedSteelTexture('#64748b')
                });
                this.matChainLinkFence = new THREE.MeshLambertMaterial({
                    map: ProceduralTextureFactory.createChainLinkFenceTexture(),
                    transparent: true,
                    alphaTest: 0.25,
                    side: THREE.DoubleSide
                });

                // Материалы морских контейнеров
                this.containerMats = [
                    new THREE.MeshLambertMaterial({ color: 0xb91c1c }),
                    new THREE.MeshLambertMaterial({ color: 0x1d4ed8 }),
                    new THREE.MeshLambertMaterial({ color: 0x15803d }),
                    new THREE.MeshLambertMaterial({ color: 0xd97706 })
                ];

                // Коммерческие неоновые вывески и фасады (7 типов магазинов)
                this.commercialNeonMats = [];
                this.commercialDisplayMats = [];
                for (let s = 0; s < 7; s++) {
                    this.commercialNeonMats.push(new THREE.MeshLambertMaterial({
                        map: ProceduralTextureFactory.createCommercialNeonAtlas(s),
                        emissive: new THREE.Color(0xffffff),
                        emissiveIntensity: 0.8
                    }));
                    this.commercialDisplayMats.push(new THREE.MeshLambertMaterial({
                        map: ProceduralTextureFactory.createStorefrontDisplayTexture(s)
                    }));
                }

                // Архитектурные детали
                this.matHelipad = new THREE.MeshLambertMaterial({
                    map: ProceduralTextureFactory.createHelipadTexture()
                });
                this.matConcrete = new THREE.MeshLambertMaterial({ color: 0x334155 });
                this.matRoofGravel = new THREE.MeshLambertMaterial({ color: 0x1e293b });
                this.matSteelStructure = new THREE.MeshLambertMaterial({ color: 0xd4d4d8 });
                this.matBeaconRed = new THREE.MeshBasicMaterial({ color: 0xff1744 });
                this.matCanopyOrange = new THREE.MeshLambertMaterial({ color: 0xe65100 });
                this.matCanopyBlue = new THREE.MeshLambertMaterial({ color: 0x0284c7 });
                this.matCanopyGreen = new THREE.MeshLambertMaterial({ color: 0x16a34a });
                this.matCommercialWall = new THREE.MeshLambertMaterial({ color: 0x3f3f46 });

                // Low LOD прокси-материалы для 60 FPS на горизонте
                this.proxyDowntown = new THREE.MeshBasicMaterial({ color: 0x1e293b });
                this.proxyIndustrial = new THREE.MeshBasicMaterial({ color: 0x332924 });
                this.proxyCommercial = new THREE.MeshBasicMaterial({ color: 0x27272a });
            }

            generateDistricts() {
                const gridRadius = 2;
                for (let gx = -gridRadius; gx <= gridRadius; gx++) {
                    for (let gz = -gridRadius; gz <= gridRadius; gz++) {
                        const px = gx * 60.0;
                        const pz = gz * 60.0;

                        // Пропускаем центральные кварталы с Maze Bank Tower, LSPD, Hospital
                        if (Math.abs(gx) <= 1 && Math.abs(gz) <= 1) continue;

                        const absX = Math.abs(gx);
                        const absZ = Math.abs(gz);

                        if (absX >= 2 && absZ <= 1) {
                            // Деловой квартал (Небоскребы с вертолетными площадками и шпилями)
                            this.buildDowntownTower(gx, gz, px, pz);
                        } else if (absX <= 1 && absZ >= 2) {
                            // Коммерческий сектор (Магазины с неоновыми вывесками) и индустриальные склады
                            if (gz > 0) {
                                this.buildCommercialPlaza(gx, gz, px, pz);
                            } else {
                                this.buildIndustrialDepot(gx, gz, px, pz);
                            }
                        }
                    }
                }
            }

            getDeterministicHash(cx, cz) {
                return Math.abs(Math.sin(cx * 12.9898 + cz * 78.233 + 42.1) * 43758.5453);
            }

            buildDowntownTower(cx, cz, px, pz) {
                const hash = this.getDeterministicHash(cx, cz);
                const themeIdx = Math.floor(hash * 5) % 4;

                const bW = 24.0 + (Math.floor(hash * 7) % 10);
                const bD = 24.0 + (Math.floor(hash * 13) % 10);
                const bH = 45.0 + (Math.floor(hash * 23) % 65); // Высота 45м - 110м
                const roofType = Math.floor(hash * 17) % 4;

                const highGroup = new THREE.Group();
                highGroup.position.set(px, 0, pz);

                // 1. Основной стеклянный корпус небоскреба
                const towerGeo = new THREE.BoxGeometry(bW, bH, bD);
                const towerMesh = new THREE.Mesh(towerGeo, this.skyscraperMats[themeIdx]);
                towerMesh.position.set(0, bH / 2, 0);
                towerMesh.castShadow = true; towerMesh.receiveShadow = true;
                highGroup.add(towerMesh);

                // 2. Угловые стальные колонны и верхний парапет
                const cornerGeo = new THREE.BoxGeometry(0.8, bH + 1.2, 0.8);
                const corners = [
                    { x: -bW / 2, z: -bD / 2 }, { x: bW / 2, z: -bD / 2 },
                    { x: -bW / 2, z: bD / 2 }, { x: bW / 2, z: bD / 2 }
                ];
                for (const c of corners) {
                    const cMesh = new THREE.Mesh(cornerGeo, this.matSteelStructure);
                    cMesh.position.set(c.x, (bH + 1.2) / 2, c.z);
                    highGroup.add(cMesh);
                }

                // 3. Уникальные надстройки крыши (Roof Structures)
                let extraHeight = 0;
                if (roofType === 0) {
                    // ТИП 0: Вертолетная площадка (Helipad Platform)
                    const hpW = Math.min(bW - 2.0, 20.0);
                    const hpD = Math.min(bD - 2.0, 20.0);
                    const hpMesh = new THREE.Mesh(new THREE.BoxGeometry(hpW, 1.2, hpD), this.matHelipad);
                    hpMesh.position.set(0, bH + 0.6, 0);
                    hpMesh.receiveShadow = true;
                    highGroup.add(hpMesh);

                    // 4 угловых сигнальных огня
                    for (let lx of [-hpW / 2 + 0.5, hpW / 2 - 0.5]) {
                        for (let lz of [-hpD / 2 + 0.5, hpD / 2 - 0.5]) {
                            const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), this.matBeaconRed);
                            beacon.position.set(lx, bH + 1.6, lz);
                            highGroup.add(beacon);
                        }
                    }
                    extraHeight = 1.2;
                } else if (roofType === 1) {
                    // ТИП 1: Радиокоммуникационный шпиль и вышка (Communications Spire)
                    const spireH = 22.0 + (Math.floor(hash * 9) % 14);
                    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(6.0, 3.0, 6.0), this.matConcrete);
                    baseMesh.position.set(0, bH + 1.5, 0);
                    highGroup.add(baseMesh);

                    const mastGeo = new THREE.CylinderGeometry(0.2, 0.8, spireH, 8);
                    const mastMesh = new THREE.Mesh(mastGeo, this.matSteelStructure);
                    mastMesh.position.set(0, bH + 3.0 + spireH / 2, 0);
                    highGroup.add(mastMesh);

                    const redLight = new THREE.Mesh(new THREE.SphereGeometry(0.65, 10, 10), this.matBeaconRed);
                    redLight.position.set(0, bH + 3.0 + spireH + 0.3, 0);
                    highGroup.add(redLight);
                    extraHeight = 3.0 + spireH;
                } else if (roofType === 2) {
                    // ТИП 2: Ступенчатая корона в стиле Арт-Деко (Stepped Crown)
                    const tier1 = new THREE.Mesh(new THREE.BoxGeometry(bW * 0.75, 4.0, bD * 0.75), this.skyscraperMats[themeIdx]);
                    tier1.position.set(0, bH + 2.0, 0);
                    highGroup.add(tier1);

                    const tier2 = new THREE.Mesh(new THREE.BoxGeometry(bW * 0.5, 3.5, bD * 0.5), this.skyscraperMats[themeIdx]);
                    tier2.position.set(0, bH + 5.75, 0);
                    highGroup.add(tier2);

                    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.5, 8.0, 8), this.matSteelStructure);
                    spire.position.set(0, bH + 11.5, 0);
                    highGroup.add(spire);
                    extraHeight = 15.5;
                } else {
                    // ТИП 3: Технический пентхаус с промышленными чиллерами HVAC
                    const phW = bW * 0.6; const phD = bD * 0.6; const phH = 4.5;
                    const phMesh = new THREE.Mesh(new THREE.BoxGeometry(phW, phH, phD), this.matConcrete);
                    phMesh.position.set(0, bH + phH / 2, 0);
                    highGroup.add(phMesh);

                    // 4 роторных кондиционера
                    for (let cx of [-phW / 3, phW / 3]) {
                        for (let cz of [-phD / 3, phD / 3]) {
                            const ac = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.4, 12), this.matSteelStructure);
                            ac.position.set(cx, bH + phH + 0.7, cz);
                            highGroup.add(ac);
                        }
                    }
                    extraHeight = phH + 1.4;
                }

                if (this.chunkManager) {
                    this.chunkManager.registerHighLOD(cx, cz, highGroup);

                    // Low-LOD прокси-силуэт
                    const proxyMesh = new THREE.Mesh(new THREE.BoxGeometry(bW, bH + extraHeight * 0.5, bD), this.proxyDowntown);
                    proxyMesh.position.set(px, (bH + extraHeight * 0.5) / 2, pz);
                    this.chunkManager.registerLowLOD(cx, cz, proxyMesh);

                    // Физическое тело Cannon.js со сплошным коллайдером
                    const body = new CANNON.Body({
                        mass: 0,
                        material: this.physicsMaterials.wall,
                        position: new CANNON.Vec3(px, bH / 2, pz)
                    });
                    body.addShape(new CANNON.Box(new CANNON.Vec3(bW / 2, bH / 2, bD / 2)));
                    this.chunkManager.registerPhysicsBody(cx, cz, body);
                } else {
                    this.scene.add(highGroup);
                    const body = new CANNON.Body({
                        mass: 0,
                        material: this.physicsMaterials.wall,
                        position: new CANNON.Vec3(px, bH / 2, pz)
                    });
                    body.addShape(new CANNON.Box(new CANNON.Vec3(bW / 2, bH / 2, bD / 2)));
                    this.world.addBody(body);
                }
            }

            buildIndustrialDepot(cx, cz, px, pz) {
                const hash = this.getDeterministicHash(cx, cz);
                const lotType = Math.floor(hash * 3) % 2;

                const highGroup = new THREE.Group();
                highGroup.position.set(px, 0, pz);

                if (lotType === 0) {
                    // ЛОТ 0: Тяжелый кирпичный завод с пилообразной крышей и высокой дымоходной трубой
                    const fW = 34.0; const fD = 24.0; const fH = 11.0;
                    const factoryMesh = new THREE.Mesh(new THREE.BoxGeometry(fW, fH, fD), this.matIndustrialBrick);
                    factoryMesh.position.set(-5, fH / 2, 0);
                    factoryMesh.castShadow = true; factoryMesh.receiveShadow = true;
                    highGroup.add(factoryMesh);

                    // 3 треугольных пилообразных конька крыши
                    for (let s = 0; s < 3; s++) {
                        const sawTooth = new THREE.Mesh(new THREE.ConeGeometry(5.0, 3.5, 4), this.matCorrugatedSteel);
                        sawTooth.rotation.y = Math.PI / 4;
                        sawTooth.position.set(-15 + s * 10, fH + 1.75, 0);
                        highGroup.add(sawTooth);
                    }

                    // Высокая кирпичная дымоходная труба (38-48м)
                    const stackH = 38.0 + (Math.floor(hash * 11) % 10);
                    const stackGeo = new THREE.CylinderGeometry(1.6, 2.8, stackH, 16);
                    const stackMesh = new THREE.Mesh(stackGeo, this.matIndustrialBrick);
                    stackMesh.position.set(18, stackH / 2, -7);
                    stackMesh.castShadow = true;
                    highGroup.add(stackMesh);

                    // Красный авиационный маяк на вершине трубы
                    const stackLight = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), this.matBeaconRed);
                    stackLight.position.set(18, stackH + 0.3, -7);
                    highGroup.add(stackLight);

                    // Периметральный забор из сетки-рабицы
                    this.addChainLinkFence(highGroup, 54.0, 54.0);

                    if (this.chunkManager) {
                        this.chunkManager.registerHighLOD(cx, cz, highGroup);

                        // Low-LOD прокси
                        const proxyGroup = new THREE.Group();
                        proxyGroup.position.set(px, 0, pz);
                        const pFac = new THREE.Mesh(new THREE.BoxGeometry(fW, fH, fD), this.proxyIndustrial);
                        pFac.position.set(-5, fH / 2, 0);
                        proxyGroup.add(pFac);
                        const pStack = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.8, stackH, 8), this.proxyIndustrial);
                        pStack.position.set(18, stackH / 2, -7);
                        proxyGroup.add(pStack);
                        this.chunkManager.registerLowLOD(cx, cz, proxyGroup);

                        // Физические тела Cannon.js (Здание + Труба)
                        const bodyF = new CANNON.Body({ mass: 0, material: this.physicsMaterials.wall, position: new CANNON.Vec3(px - 5, fH / 2, pz) });
                        bodyF.addShape(new CANNON.Box(new CANNON.Vec3(fW / 2, fH / 2, fD / 2)));
                        this.chunkManager.registerPhysicsBody(cx, cz, bodyF);

                        const bodyS = new CANNON.Body({ mass: 0, material: this.physicsMaterials.wall, position: new CANNON.Vec3(px + 18, stackH / 2, pz - 7) });
                        bodyS.addShape(new CANNON.Cylinder(1.6, 2.8, stackH, 12));
                        this.chunkManager.registerPhysicsBody(cx, cz, bodyS);
                    } else {
                        this.scene.add(highGroup);
                        const bodyF = new CANNON.Body({ mass: 0, material: this.physicsMaterials.wall, position: new CANNON.Vec3(px - 5, fH / 2, pz) });
                        bodyF.addShape(new CANNON.Box(new CANNON.Vec3(fW / 2, fH / 2, fD / 2)));
                        this.world.addBody(bodyF);

                        const bodyS = new CANNON.Body({ mass: 0, material: this.physicsMaterials.wall, position: new CANNON.Vec3(px + 18, stackH / 2, pz - 7) });
                        bodyS.addShape(new CANNON.Cylinder(1.6, 2.8, stackH, 12));
                        this.world.addBody(bodyS);
                    }
                } else {
                    // ЛОТ 1: Логистический терминал с профнастиловым складом и разноцветными контейнерами
                    const wW = 36.0; const wD = 26.0; const wH = 9.5;
                    const warehouse = new THREE.Mesh(new THREE.BoxGeometry(wW, wH, wD), this.matCorrugatedWarehouse);
                    warehouse.position.set(-6, wH / 2, 0);
                    warehouse.castShadow = true; warehouse.receiveShadow = true;
                    highGroup.add(warehouse);

                    // Погрузочная рампа и роллетные ворота
                    const dockMesh = new THREE.Mesh(new THREE.BoxGeometry(wW + 2, 1.0, 4.0), this.matConcrete);
                    dockMesh.position.set(-6, 0.5, wD / 2 + 2.0);
                    highGroup.add(dockMesh);

                    // Стеки морских контейнеров
                    for (let i = 0; i < 4; i++) {
                        const matC = this.containerMats[(i + Math.floor(hash * 7)) % this.containerMats.length];
                        const cMesh = new THREE.Mesh(new THREE.BoxGeometry(12.0, 2.6, 2.6), matC);
                        cMesh.position.set(16, 1.3 + (i % 2) * 2.6, -10 + Math.floor(i / 2) * 12);
                        cMesh.castShadow = true;
                        highGroup.add(cMesh);
                    }

                    // Периметральный забор из сетки-рабицы
                    this.addChainLinkFence(highGroup, 54.0, 54.0);

                    if (this.chunkManager) {
                        this.chunkManager.registerHighLOD(cx, cz, highGroup);

                        // Low-LOD прокси
                        const proxyMesh = new THREE.Mesh(new THREE.BoxGeometry(wW + 12, wH, wD), this.proxyIndustrial);
                        proxyMesh.position.set(px, wH / 2, pz);
                        this.chunkManager.registerLowLOD(cx, cz, proxyMesh);

                        // Физическое тело Cannon.js
                        const bodyW = new CANNON.Body({ mass: 0, material: this.physicsMaterials.wall, position: new CANNON.Vec3(px - 6, wH / 2, pz) });
                        bodyW.addShape(new CANNON.Box(new CANNON.Vec3(wW / 2, wH / 2, wD / 2)));
                        this.chunkManager.registerPhysicsBody(cx, cz, bodyW);

                        const bodyC = new CANNON.Body({ mass: 0, material: this.physicsMaterials.wall, position: new CANNON.Vec3(px + 16, 2.6, pz) });
                        bodyC.addShape(new CANNON.Box(new CANNON.Vec3(6.0, 2.6, 12.0)));
                        this.chunkManager.registerPhysicsBody(cx, cz, bodyC);
                    } else {
                        this.scene.add(highGroup);
                        const bodyW = new CANNON.Body({ mass: 0, material: this.physicsMaterials.wall, position: new CANNON.Vec3(px - 6, wH / 2, pz) });
                        bodyW.addShape(new CANNON.Box(new CANNON.Vec3(wW / 2, wH / 2, wD / 2)));
                        this.world.addBody(bodyW);

                        const bodyC = new CANNON.Body({ mass: 0, material: this.physicsMaterials.wall, position: new CANNON.Vec3(px + 16, 2.6, pz) });
                        bodyC.addShape(new CANNON.Box(new CANNON.Vec3(6.0, 2.6, 12.0)));
                        this.world.addBody(bodyC);
                    }
                }
            }

            addChainLinkFence(parentGroup, width, depth) {
                const fenceH = 2.4;
                const fenceGeoX = new THREE.PlaneGeometry(width, fenceH);
                const fenceGeoZ = new THREE.PlaneGeometry(depth, fenceH);

                // Северный забор
                const fN = new THREE.Mesh(fenceGeoX, this.matChainLinkFence);
                fN.position.set(0, fenceH / 2, -depth / 2);
                parentGroup.add(fN);

                // Южный забор
                const fS = new THREE.Mesh(fenceGeoX, this.matChainLinkFence);
                fS.position.set(0, fenceH / 2, depth / 2);
                parentGroup.add(fS);

                // Западный забор
                const fW = new THREE.Mesh(fenceGeoZ, this.matChainLinkFence);
                fW.rotation.y = Math.PI / 2;
                fW.position.set(-width / 2, fenceH / 2, 0);
                parentGroup.add(fW);

                // Восточный забор
                const fE = new THREE.Mesh(fenceGeoZ, this.matChainLinkFence);
                fE.rotation.y = Math.PI / 2;
                fE.position.set(width / 2, fenceH / 2, 0);
                parentGroup.add(fE);
            }

            buildCommercialPlaza(cx, cz, px, pz) {
                const hash = this.getDeterministicHash(cx, cz);
                const shopType = Math.floor(hash * 11) % 7;

                const bW = 26.0 + (Math.floor(hash * 7) % 8);
                const bD = 20.0 + (Math.floor(hash * 13) % 6);
                const bH = 8.0 + (Math.floor(hash * 5) % 4); // 8.0м - 12.0м

                const highGroup = new THREE.Group();
                highGroup.position.set(px, 0, pz);

                // 1. Основное здание магазина
                const buildingMesh = new THREE.Mesh(new THREE.BoxGeometry(bW, bH, bD), this.matCommercialWall);
                buildingMesh.position.set(0, bH / 2, 0);
                buildingMesh.castShadow = true; buildingMesh.receiveShadow = true;
                highGroup.add(buildingMesh);

                // 2. Фасадная светящаяся витрина
                const displayW = bW - 4.0; const displayH = 3.8;
                const displayMesh = new THREE.Mesh(new THREE.PlaneGeometry(displayW, displayH), this.commercialDisplayMats[shopType]);
                displayMesh.position.set(0, displayH / 2 + 0.2, bD / 2 + 0.05);
                highGroup.add(displayMesh);

                // 3. Яркая неоновая вывеска магазина
                const signW = Math.min(bW - 2.0, 18.0);
                const signH = 3.6;
                const signMesh = new THREE.Mesh(new THREE.BoxGeometry(signW, signH, 0.4), this.commercialNeonMats[shopType]);
                signMesh.position.set(0, bH - signH / 2 + 0.6, bD / 2 + 0.3);
                highGroup.add(signMesh);

                // 4. Тканевый козырек/навес над витриной
                const canopies = [this.matCanopyOrange, this.matCanopyBlue, this.matCanopyGreen];
                const canopyMat = canopies[shopType % canopies.length];
                const canopy = new THREE.Mesh(new THREE.BoxGeometry(displayW + 1.0, 0.4, 3.2), canopyMat);
                canopy.position.set(0, displayH + 0.6, bD / 2 + 1.6);
                canopy.rotation.x = 0.12;
                highGroup.add(canopy);

                // 5. Кондиционеры и вентиляция на крыше
                const ac1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 1.8), this.matSteelStructure);
                ac1.position.set(-bW / 4, bH + 0.7, -bD / 4);
                highGroup.add(ac1);

                const ac2 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 1.6), this.matSteelStructure);
                ac2.position.set(bW / 4, bH + 0.6, bD / 4);
                highGroup.add(ac2);

                if (this.chunkManager) {
                    this.chunkManager.registerHighLOD(cx, cz, highGroup);

                    // Low-LOD прокси
                    const proxyMesh = new THREE.Mesh(new THREE.BoxGeometry(bW, bH, bD), this.proxyCommercial);
                    proxyMesh.position.set(px, bH / 2, pz);
                    this.chunkManager.registerLowLOD(cx, cz, proxyMesh);

                    // Физическое тело Cannon.js
                    const body = new CANNON.Body({
                        mass: 0,
                        material: this.physicsMaterials.wall,
                        position: new CANNON.Vec3(px, bH / 2, pz)
                    });
                    body.addShape(new CANNON.Box(new CANNON.Vec3(bW / 2, bH / 2, bD / 2)));
                    this.chunkManager.registerPhysicsBody(cx, cz, body);
                } else {
                    this.scene.add(highGroup);
                    const body = new CANNON.Body({
                        mass: 0,
                        material: this.physicsMaterials.wall,
                        position: new CANNON.Vec3(px, bH / 2, pz)
                    });
                    body.addShape(new CANNON.Box(new CANNON.Vec3(bW / 2, bH / 2, bD / 2)));
                    this.world.addBody(body);
                }
            }
        }
