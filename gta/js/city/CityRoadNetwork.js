/**
         * STEP 33: Дорожная сеть открытого мира (Скоростная автомагистраль, эстакады/мосты, сельские грунтовые дороги)
         * - Городская сетка улиц (17х17 чанков, 1020м х 1020м).
         * - 4-полосная скоростная автомагистраль (Highway Ring) по периметру города с бетонными разделителями и эстакадами.
         * - Бетонные мосты и путепроводы на опорах в местах перепадов рельефа.
         * - Извилистые сельские грунтовые дороги (Dirt Roads) по холмам и равнинам с песчано-глиняной текстурой.
         * - Динамическое определение типа покрытия (асфальт vs грунт) для реалистичного дрифта и пробуксовки авто.
         */
        class CityRoadNetwork {
            constructor(scene, world, physicsMaterials, chunkManager = null) {
                this.scene = scene;
                this.world = world;
                this.physicsMaterials = physicsMaterials;
                this.chunkManager = chunkManager;

                this.ROAD_WIDTH = 16.0;
                this.HIGHWAY_WIDTH = 24.0;
                this.DIRT_ROAD_WIDTH = 9.0;
                this.SIDEWALK_WIDTH = 3.5;
                this.SIDEWALK_HEIGHT = 0.22;
                this.BLOCK_SIZE = 60.0;

                this.dirtRoadSegments = [];

                this.materials = {
                    roadH: new THREE.MeshLambertMaterial({ map: ProceduralTextureFactory.createHorizontalRoadTexture() }),
                    roadV: new THREE.MeshLambertMaterial({ map: ProceduralTextureFactory.createVerticalRoadTexture() }),
                    intersection: new THREE.MeshLambertMaterial({ map: ProceduralTextureFactory.createIntersectionTexture() }),
                    highwayRoad: new THREE.MeshLambertMaterial({ map: ProceduralTextureFactory.createHighwayRoadTexture() }),
                    highwayBridge: new THREE.MeshLambertMaterial({ map: ProceduralTextureFactory.createHighwayBridgeTexture() }),
                    dirtRoad: new THREE.MeshLambertMaterial({ map: ProceduralTextureFactory.createDirtRoadTexture() }),
                    concretePillar: new THREE.MeshLambertMaterial({ color: 0x475569 }),
                    jerseyBarrier: new THREE.MeshLambertMaterial({ color: 0x64748b }),
                    guardRail: new THREE.MeshLambertMaterial({ color: 0x94a3b8 }),
                    highwaySign: new THREE.MeshBasicMaterial({ map: ProceduralTextureFactory.createHighwaySignTexture() }),
                    sidewalk: new THREE.MeshLambertMaterial({ map: ProceduralTextureFactory.createSidewalkTexture() }),
                    curb: new THREE.MeshLambertMaterial({ map: ProceduralTextureFactory.createCurbTexture() }),
                    proxyRoad: new THREE.MeshBasicMaterial({ color: 0x1e293b }),
                    proxyDirt: new THREE.MeshBasicMaterial({ color: 0x5c4731 })
                };

                this.generateCityGrid();
            }

            updateWetness(wetness) {}

            generateCityGrid() {
                // Компактная классическая городская сетка: 25 кварталов (-120м .. +120м)
                const gridRadius = 2;
                for (let gx = -gridRadius; gx <= gridRadius; gx++) {
                    for (let gz = -gridRadius; gz <= gridRadius; gz++) {
                        const px = gx * this.BLOCK_SIZE;
                        const pz = gz * this.BLOCK_SIZE;

                        // 1. High-LOD элементы перекрестка
                        const interMesh = new THREE.Mesh(new THREE.PlaneGeometry(this.ROAD_WIDTH, this.ROAD_WIDTH), this.materials.intersection);
                        interMesh.rotation.x = -Math.PI / 2;
                        interMesh.position.set(px, 0.04, pz);
                        interMesh.receiveShadow = true;

                        if (this.chunkManager) {
                            this.chunkManager.registerHighLOD(gx, gz, interMesh);
                        } else {
                            this.scene.add(interMesh);
                        }

                        // 2. Дорожные сегменты и тротуары
                        if (gx < gridRadius) {
                            const segLen = this.BLOCK_SIZE - this.ROAD_WIDTH;
                            const midX = px + this.ROAD_WIDTH / 2 + segLen / 2;
                            const roadMeshH = new THREE.Mesh(new THREE.PlaneGeometry(segLen, this.ROAD_WIDTH), this.materials.roadH);
                            roadMeshH.rotation.x = -Math.PI / 2;
                            roadMeshH.position.set(midX, 0.04, pz);
                            roadMeshH.receiveShadow = true;

                            if (this.chunkManager) {
                                this.chunkManager.registerHighLOD(gx, gz, roadMeshH);
                            } else {
                                this.scene.add(roadMeshH);
                            }

                            this.createSidewalk(midX, pz - (this.ROAD_WIDTH / 2 + this.SIDEWALK_WIDTH / 2), segLen, this.SIDEWALK_WIDTH, gx, gz);
                            this.createSidewalk(midX, pz + (this.ROAD_WIDTH / 2 + this.SIDEWALK_WIDTH / 2), segLen, this.SIDEWALK_WIDTH, gx, gz);
                        }

                        if (gz < gridRadius) {
                            const segLen = this.BLOCK_SIZE - this.ROAD_WIDTH;
                            const midZ = pz + this.ROAD_WIDTH / 2 + segLen / 2;
                            const roadMeshV = new THREE.Mesh(new THREE.PlaneGeometry(this.ROAD_WIDTH, segLen), this.materials.roadV);
                            roadMeshV.rotation.x = -Math.PI / 2;
                            roadMeshV.position.set(px, 0.04, midZ);
                            roadMeshV.receiveShadow = true;

                            if (this.chunkManager) {
                                this.chunkManager.registerHighLOD(gx, gz, roadMeshV);
                            } else {
                                this.scene.add(roadMeshV);
                            }

                            this.createSidewalk(px - (this.ROAD_WIDTH / 2 + this.SIDEWALK_WIDTH / 2), midZ, this.SIDEWALK_WIDTH, segLen, gx, gz);
                            this.createSidewalk(px + (this.ROAD_WIDTH / 2 + this.SIDEWALK_WIDTH / 2), midZ, this.SIDEWALK_WIDTH, segLen, gx, gz);
                        }

                        // 3. Low-LOD прокси-дорога для дальнего горизонта
                        if (this.chunkManager) {
                            const proxyRoad = new THREE.Mesh(new THREE.PlaneGeometry(this.BLOCK_SIZE, this.BLOCK_SIZE), this.materials.proxyRoad);
                            proxyRoad.rotation.x = -Math.PI / 2;
                            proxyRoad.position.set(px, 0.015, pz);
                            this.chunkManager.registerLowLOD(gx, gz, proxyRoad);
                        }
                    }
                }
            }

            generateHighwaySystem() {
                // 4-полосная скоростная автомагистраль (Highway Ring) по внешнему периметру города (R ~ 420-480м)
                const loopRadius = 450.0;
                const hwW = this.HIGHWAY_WIDTH;

                // 4 стороны кольцевой скоростной автострады
                const sides = [
                    { start: { x: -loopRadius, z: -loopRadius }, end: { x: loopRadius, z: -loopRadius }, isH: true },
                    { start: { x: loopRadius, z: -loopRadius }, end: { x: loopRadius, z: loopRadius }, isH: false },
                    { start: { x: loopRadius, z: loopRadius }, end: { x: -loopRadius, z: loopRadius }, isH: true },
                    { start: { x: -loopRadius, z: loopRadius }, end: { x: -loopRadius, z: -loopRadius }, isH: false }
                ];

                const segStep = 60.0;

                for (const side of sides) {
                    const totalLen = Math.hypot(side.end.x - side.start.x, side.end.z - side.start.z);
                    const steps = Math.floor(totalLen / segStep);

                    for (let s = 0; s < steps; s++) {
                        const t = (s + 0.5) / steps;
                        const mx = side.start.x + (side.end.x - side.start.x) * t;
                        const mz = side.start.z + (side.end.z - side.start.z) * t;

                        const cx = Math.round(mx / 60.0);
                        const cz = Math.round(mz / 60.0);

                        const hwGeo = side.isH
                            ? new THREE.PlaneGeometry(segStep, hwW)
                            : new THREE.PlaneGeometry(hwW, segStep);
                        const hwMesh = new THREE.Mesh(hwGeo, this.materials.highwayRoad);
                        hwMesh.rotation.x = -Math.PI / 2;
                        if (!side.isH) hwMesh.rotation.z = Math.PI / 2;
                        hwMesh.position.set(mx, 0.035, mz);
                        hwMesh.receiveShadow = true;

                        if (this.chunkManager) {
                            this.chunkManager.registerHighLOD(cx, cz, hwMesh);
                        } else {
                            this.scene.add(hwMesh);
                        }

                        // Центральный бетонный барьер Нью-Джерси (Jersey Barrier)
                        const barrierGeo = side.isH
                            ? new THREE.BoxGeometry(segStep, 0.85, 0.6)
                            : new THREE.BoxGeometry(0.6, 0.85, segStep);
                        const barrierMesh = new THREE.Mesh(barrierGeo, this.materials.jerseyBarrier);
                        barrierMesh.position.set(mx, 0.425, mz);
                        barrierMesh.castShadow = true;

                        if (this.chunkManager) {
                            this.chunkManager.registerHighLOD(cx, cz, barrierMesh);
                        } else {
                            this.scene.add(barrierMesh);
                        }

                        // Внешние металлические отбойники (Guardrails)
                        const railGeo = side.isH
                            ? new THREE.BoxGeometry(segStep, 0.7, 0.25)
                            : new THREE.BoxGeometry(0.25, 0.7, segStep);
                        
                        const r1X = side.isH ? mx : mx - (hwW / 2 - 0.3);
                        const r1Z = side.isH ? mz - (hwW / 2 - 0.3) : mz;
                        const rail1 = new THREE.Mesh(railGeo, this.materials.guardRail);
                        rail1.position.set(r1X, 0.35, r1Z);

                        const r2X = side.isH ? mx : mx + (hwW / 2 - 0.3);
                        const r2Z = side.isH ? mz + (hwW / 2 - 0.3) : mz;
                        const rail2 = new THREE.Mesh(railGeo, this.materials.guardRail);
                        rail2.position.set(r2X, 0.35, r2Z);

                        if (this.chunkManager) {
                            this.chunkManager.registerHighLOD(cx, cz, rail1);
                            this.chunkManager.registerHighLOD(cx, cz, rail2);
                        } else {
                            this.scene.add(rail1);
                            this.scene.add(rail2);
                        }

                        // Раз в несколько сегментов ставим портальную надземную ферму с указателями
                        if (s % 5 === 2) {
                            this.createHighwaySignGantry(mx, mz, side.isH, cx, cz);
                        }
                    }
                }

                // Скоростные ответвления к сельским холмам (Северо-восточное и Северо-западное шоссе)
                this.generateHighwaySpurs();
            }

            createHighwaySignGantry(x, z, isH, cx, cz) {
                const gantryGroup = new THREE.Group();
                gantryGroup.position.set(x, 0, z);

                const spanW = this.HIGHWAY_WIDTH + 4.0;
                const postH = 7.5;

                // Две вертикальные стойки
                const postGeo = new THREE.CylinderGeometry(0.25, 0.25, postH, 12);
                const p1 = new THREE.Mesh(postGeo, this.materials.guardRail);
                const p2 = new THREE.Mesh(postGeo, this.materials.guardRail);
                if (isH) {
                    p1.position.set(0, postH / 2, -spanW / 2);
                    p2.position.set(0, postH / 2, spanW / 2);
                } else {
                    p1.position.set(-spanW / 2, postH / 2, 0);
                    p2.position.set(spanW / 2, postH / 2, 0);
                }
                gantryGroup.add(p1); gantryGroup.add(p2);

                // Горизонтальная ферма
                const beamGeo = isH
                    ? new THREE.BoxGeometry(0.8, 0.8, spanW)
                    : new THREE.BoxGeometry(spanW, 0.8, 0.8);
                const beam = new THREE.Mesh(beamGeo, this.materials.guardRail);
                beam.position.set(0, postH, 0);
                gantryGroup.add(beam);

                // Зеленый знак-указатель
                const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(9.0, 2.8), this.materials.highwaySign);
                signMesh.position.set(0, postH - 0.2, isH ? 2.5 : 0);
                if (!isH) signMesh.rotation.y = Math.PI / 2;
                gantryGroup.add(signMesh);

                if (this.chunkManager) {
                    this.chunkManager.registerHighLOD(cx, cz, gantryGroup);
                } else {
                    this.scene.add(gantryGroup);
                }
            }

            generateHighwaySpurs() {
                // Шоссе Сенора (Северо-Восток) и Прибрежное шоссе (Северо-Запад)
                const spurs = [
                    { start: { x: 450, z: -450 }, end: { x: 920, z: -920 } },
                    { start: { x: -450, z: -450 }, end: { x: -920, z: -920 } }
                ];

                for (const spur of spurs) {
                    const totalLen = Math.hypot(spur.end.x - spur.start.x, spur.end.z - spur.start.z);
                    const steps = 14;
                    const angle = Math.atan2(spur.end.x - spur.start.x, spur.end.z - spur.start.z);

                    for (let s = 0; s < steps; s++) {
                        const t = (s + 0.5) / steps;
                        const mx = spur.start.x + (spur.end.x - spur.start.x) * t;
                        const mz = spur.start.z + (spur.end.z - spur.start.z) * t;

                        const cx = Math.round(mx / 60.0);
                        const cz = Math.round(mz / 60.0);

                        const spurMesh = new THREE.Mesh(new THREE.PlaneGeometry(this.HIGHWAY_WIDTH, totalLen / steps + 2.0), this.materials.highwayRoad);
                        spurMesh.rotation.x = -Math.PI / 2;
                        spurMesh.rotation.z = angle;
                        spurMesh.position.set(mx, 0.035, mz);
                        spurMesh.receiveShadow = true;

                        if (this.chunkManager) {
                            this.chunkManager.registerHighLOD(cx, cz, spurMesh);
                        } else {
                            this.scene.add(spurMesh);
                        }
                    }
                }
            }

            generateHighwayOverpasses() {
                // Бетонные эстакады и мосты на опорах в местах, где автострада пересекает рельеф
                const overpassLocations = [
                    { x: 450, z: 0, w: 24.0, len: 140.0, isH: false, h: 5.5 },
                    { x: -450, z: 0, w: 24.0, len: 140.0, isH: false, h: 5.5 },
                    { x: 0, z: -450, w: 140.0, len: 24.0, isH: true, h: 5.5 },
                    { x: 0, z: 450, w: 140.0, len: 24.0, isH: true, h: 5.5 }
                ];

                for (const op of overpassLocations) {
                    const cx = Math.round(op.x / 60.0);
                    const cz = Math.round(op.z / 60.0);

                    const bridgeGroup = new THREE.Group();
                    bridgeGroup.position.set(op.x, 0, op.z);

                    // 1. Бетонное полотно моста
                    const deckGeo = new THREE.BoxGeometry(op.w, 1.4, op.len);
                    const deckMesh = new THREE.Mesh(deckGeo, this.materials.highwayBridge);
                    deckMesh.position.set(0, op.h, 0);
                    deckMesh.castShadow = true; deckMesh.receiveShadow = true;
                    bridgeGroup.add(deckMesh);

                    // 2. Массивные бетонные круглые опоры-колонны
                    const pillarGeo = new THREE.CylinderGeometry(1.6, 1.8, op.h + 0.5, 16);
                    const numPillars = 4;
                    for (let i = 0; i < numPillars; i++) {
                        const pT = (i / (numPillars - 1) - 0.5);
                        const px = op.isH ? pT * (op.w - 20) : 0;
                        const pz = op.isH ? 0 : pT * (op.len - 20);

                        const pillarL = new THREE.Mesh(pillarGeo, this.materials.concretePillar);
                        pillarL.position.set(op.isH ? px : px - (op.w / 3), op.h / 2, op.isH ? pz - (op.len / 3) : pz);
                        pillarL.castShadow = true;
                        bridgeGroup.add(pillarL);

                        const pillarR = new THREE.Mesh(pillarGeo, this.materials.concretePillar);
                        pillarR.position.set(op.isH ? px : px + (op.w / 3), op.h / 2, op.isH ? pz + (op.len / 3) : pz);
                        pillarR.castShadow = true;
                        bridgeGroup.add(pillarR);
                    }

                    // 3. Бетонные парапеты безопасности по краям моста
                    const parGeo = op.isH
                        ? new THREE.BoxGeometry(op.w, 1.2, 0.4)
                        : new THREE.BoxGeometry(0.4, 1.2, op.len);

                    const par1 = new THREE.Mesh(parGeo, this.materials.jerseyBarrier);
                    par1.position.set(op.isH ? 0 : -op.w / 2 + 0.2, op.h + 1.2, op.isH ? -op.len / 2 + 0.2 : 0);
                    bridgeGroup.add(par1);

                    const par2 = new THREE.Mesh(parGeo, this.materials.jerseyBarrier);
                    par2.position.set(op.isH ? 0 : op.w / 2 - 0.2, op.h + 1.2, op.isH ? op.len / 2 - 0.2 : 0);
                    bridgeGroup.add(par2);

                    if (this.chunkManager) {
                        this.chunkManager.registerHighLOD(cx, cz, bridgeGroup);
                    } else {
                        this.scene.add(bridgeGroup);
                    }

                    // Физический коллайдер полотна моста в Cannon.js
                    const bodyDeck = new CANNON.Body({
                        mass: 0,
                        material: this.physicsMaterials.ground,
                        position: new CANNON.Vec3(op.x, op.h + 0.7, op.z)
                    });
                    bodyDeck.addShape(new CANNON.Box(new CANNON.Vec3(op.w / 2, 0.7, op.len / 2)));
                    if (this.chunkManager) {
                        this.chunkManager.registerPhysicsBody(cx, cz, bodyDeck);
                    } else {
                        this.world.addBody(bodyDeck);
                    }
                }
            }

            generateRuralDirtRoads() {
                // Извилистые грунтовые трассы через холмы и сельскую местность
                const dirtPaths = [
                    // Трасса 1: Северный горный перевал (Mountain Trail)
                    [
                        { x: 0, z: -450 }, { x: 60, z: -550 }, { x: 140, z: -680 },
                        { x: 90, z: -820 }, { x: -40, z: -960 }, { x: -160, z: -1100 },
                        { x: -80, z: -1280 }, { x: 120, z: -1450 }
                    ],
                    // Трасса 2: Восточные холмистые пустоши (Foothills Track)
                    [
                        { x: 450, z: -150 }, { x: 580, z: -180 }, { x: 740, z: -120 },
                        { x: 920, z: 20 }, { x: 1100, z: 180 }, { x: 1280, z: 360 },
                        { x: 1420, z: 580 }
                    ],
                    // Трасса 3: Сельскохозяйственные равнины (Farmlands Loop)
                    [
                        { x: -450, z: 200 }, { x: -620, z: 350 }, { x: -820, z: 520 },
                        { x: -1050, z: 720 }, { x: -1250, z: 980 }, { x: -1400, z: 1240 },
                        { x: -1180, z: 1450 }
                    ]
                ];

                for (const path of dirtPaths) {
                    for (let i = 0; i < path.length - 1; i++) {
                        const p1 = path[i];
                        const p2 = path[i + 1];

                        this.dirtRoadSegments.push({ p1, p2 });

                        const segLen = Math.hypot(p2.x - p1.x, p2.z - p1.z);
                        const midX = (p1.x + p2.x) / 2;
                        const midZ = (p1.z + p2.z) / 2;

                        // Определение высоты над 3D-рельефом
                        const groundY = (window.gameEngine && window.gameEngine.terrainManager)
                            ? window.gameEngine.terrainManager.getTerrainHeight(midX, midZ)
                            : 0.0;

                        const cx = Math.round(midX / 60.0);
                        const cz = Math.round(midZ / 60.0);

                        const angle = Math.atan2(p2.x - p1.x, p2.z - p1.z);

                        const dirtGeo = new THREE.PlaneGeometry(this.DIRT_ROAD_WIDTH, segLen + 2.5);
                        const dirtMesh = new THREE.Mesh(dirtGeo, this.materials.dirtRoad);
                        dirtMesh.rotation.x = -Math.PI / 2;
                        dirtMesh.rotation.z = angle;
                        dirtMesh.position.set(midX, groundY + 0.08, midZ);
                        dirtMesh.receiveShadow = true;

                        if (this.chunkManager) {
                            this.chunkManager.registerHighLOD(cx, cz, dirtMesh);

                            // Low-LOD прокси для грунтовой дороги
                            const proxyDirt = new THREE.Mesh(new THREE.PlaneGeometry(this.DIRT_ROAD_WIDTH, segLen), this.materials.proxyDirt);
                            proxyDirt.rotation.x = -Math.PI / 2;
                            proxyDirt.rotation.z = angle;
                            proxyDirt.position.set(midX, groundY + 0.05, midZ);
                            this.chunkManager.registerLowLOD(cx, cz, proxyDirt);
                        } else {
                            this.scene.add(dirtMesh);
                        }
                    }
                }
            }

            isPositionOnDirt(x, z) {
                const distFromCenter = Math.hypot(x, z);

                // Если игрок/автомобиль внутри города (r <= 430м), он гарантированно на асфальте
                if (distFromCenter <= 430.0) {
                    return false;
                }

                // Проверка нахождения на скоростной автомагистрали (Highway Loop на r ~ 450м)
                if (Math.abs(distFromCenter - 450.0) < 18.0) {
                    return false;
                }

                // На шоссе-ответвлениях
                if (Math.abs(Math.abs(x) - Math.abs(z)) < 24.0 && z < -420.0) {
                    return false;
                }

                // Все остальные открытые холмы, сельские поля и грунтовые дороги классифицируются как грунт
                return true;
            }

            createSidewalk(x, z, widthX, lengthZ, cx = null, cz = null) {
                const geo = new THREE.BoxGeometry(widthX, this.SIDEWALK_HEIGHT, lengthZ);
                const mesh = new THREE.Mesh(geo, this.materials.sidewalk);
                mesh.position.set(x, this.SIDEWALK_HEIGHT / 2, z);
                mesh.receiveShadow = true;

                if (this.chunkManager && cx !== null && cz !== null) {
                    this.chunkManager.registerHighLOD(cx, cz, mesh);
                } else {
                    this.scene.add(mesh);
                }

                const body = new CANNON.Body({
                    mass: 0,
                    material: this.physicsMaterials.ground,
                    position: new CANNON.Vec3(x, this.SIDEWALK_HEIGHT / 2, z)
                });
                body.allowSleep = true;
                body.sleep();
                body.addShape(new CANNON.Box(new CANNON.Vec3(widthX / 2, this.SIDEWALK_HEIGHT / 2, lengthZ / 2)));

                if (this.chunkManager && cx !== null && cz !== null) {
                    this.chunkManager.registerPhysicsBody(cx, cz, body);
                } else {
                    this.world.addBody(body);
                }
            }
        }

window.CityRoadNetwork = CityRoadNetwork;
