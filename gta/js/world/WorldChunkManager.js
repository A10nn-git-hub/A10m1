/**
         * STEP 30: Менеджер пространственных чанков и многоуровневой детализации (LOD System)
         * - Делит гигантский открытый мир (> 1000м х 1000м, 289 чанков 60м х 60м) на пространственные ячейки.
         * - В чанке игрока и непосредственно соседних (дистанция <= 95м):
         *   Рендерит High-LOD геометрию, детальные текстуры, интерьеры, интерактивные двери и АКТИВИРУЕТ физические тела Cannon.js.
         * - В средних чанках (дистанция 95м..380м):
         *   Переключается на низкополигональные прокси-меши (Low-Poly Proxies) и ОТКЛЮЧАЕТ физику Cannon.js из симуляции.
         * - В дальних чанках (> 380м):
         *   Полностью отсекает отрисовку (0 Draw Calls) и держит физику неактивной.
         */
        class WorldChunkManager {
            constructor(scene, world, physicsMaterials) {
                this.scene = scene;
                this.world = world;
                this.physicsMaterials = physicsMaterials;
                this.CHUNK_SIZE = 60.0;
                this.HIGH_LOD_DIST = 95.0;  // 3x3 чанка вокруг игрока
                this.LOW_LOD_DIST = 380.0;  // Средний горизонт видимости

                this.chunks = new Map();
                this.lastUpdatePos = new THREE.Vector3(999999, 999999, 999999);
                this.debugStats = { high: 0, low: 0, inactive: 0 };
                this.statElement = document.getElementById('stat-chunk-lod');
            }

            getChunkKey(cx, cz) {
                return `${cx}_${cz}`;
            }

            getOrCreateChunk(cx, cz) {
                const key = this.getChunkKey(cx, cz);
                let chunk = this.chunks.get(key);
                if (!chunk) {
                    const highLODGroup = new THREE.Group();
                    const lowLODGroup = new THREE.Group();
                    lowLODGroup.visible = false;
                    this.scene.add(highLODGroup);
                    this.scene.add(lowLODGroup);

                    chunk = {
                        cx, cz,
                        center: new THREE.Vector3(cx * this.CHUNK_SIZE, 0, cz * this.CHUNK_SIZE),
                        highLODGroup,
                        lowLODGroup,
                        physicsBodies: [],
                        isPhysicsActive: true,
                        lodState: 'HIGH_LOD'
                    };
                    this.chunks.set(key, chunk);
                }
                return chunk;
            }

            registerHighLOD(cx, cz, object3d) {
                const chunk = this.getOrCreateChunk(cx, cz);
                chunk.highLODGroup.add(object3d);
            }

            registerLowLOD(cx, cz, object3d) {
                const chunk = this.getOrCreateChunk(cx, cz);
                chunk.lowLODGroup.add(object3d);
            }

            registerPhysicsBody(cx, cz, body) {
                const chunk = this.getOrCreateChunk(cx, cz);
                chunk.physicsBodies.push(body);
                this.world.addBody(body);
            }

            update(focusPos) {
                if (!focusPos) return;

                // Немедленное обновление активного сектора в информационной панели HUD
                if (this.statElement) {
                    const pCol = Math.max(0, Math.min(4, Math.floor((focusPos.x + 150) / 60.0)));
                    const pRow = Math.max(0, Math.min(3, Math.floor((focusPos.z + 120) / 60.0)));
                    const sId = pRow * 5 + pCol + 1;
                    if (this.currentSectorId !== sId) {
                        this.currentSectorId = sId;
                        this.statElement.innerText = `СЕКТОР ${String(sId).padStart(2, '0')}`;
                    }
                }

                const moveDistSq = (focusPos.x - this.lastUpdatePos.x) ** 2 + (focusPos.z - this.lastUpdatePos.z) ** 2;
                if (moveDistSq < 9.0) return;

                this.lastUpdatePos.set(focusPos.x, focusPos.y, focusPos.z);

                let countHigh = 0;
                let countLow = 0;
                let countInactive = 0;

                this.chunks.forEach((chunk) => {
                    const dx = focusPos.x - chunk.center.x;
                    const dz = focusPos.z - chunk.center.z;
                    const dist = Math.hypot(dx, dz);

                    // Центральный квартал Maze Bank и лифта держим всегда в HIGH_LOD
                    const isMazeBankChunk = (chunk.cx === 0 && (chunk.cz === 0 || chunk.cz === 1));

                    if (dist <= this.HIGH_LOD_DIST || isMazeBankChunk) {
                        if (chunk.lodState !== 'HIGH_LOD') {
                            chunk.lodState = 'HIGH_LOD';
                            chunk.highLODGroup.visible = true;
                            chunk.lowLODGroup.visible = false;

                            if (!chunk.isPhysicsActive) {
                                for (let i = 0; i < chunk.physicsBodies.length; i++) {
                                    this.world.addBody(chunk.physicsBodies[i]);
                                }
                                chunk.isPhysicsActive = true;
                            }
                        }
                        countHigh++;
                    } else if (dist <= this.LOW_LOD_DIST) {
                        if (chunk.lodState !== 'LOW_LOD') {
                            chunk.lodState = 'LOW_LOD';
                            chunk.highLODGroup.visible = false;
                            chunk.lowLODGroup.visible = true;

                            if (chunk.isPhysicsActive) {
                                for (let i = 0; i < chunk.physicsBodies.length; i++) {
                                    this.world.removeBody(chunk.physicsBodies[i]);
                                }
                                chunk.isPhysicsActive = false;
                            }
                        }
                        countLow++;
                    } else {
                        if (chunk.lodState !== 'INACTIVE') {
                            chunk.lodState = 'INACTIVE';
                            chunk.highLODGroup.visible = false;
                            chunk.lowLODGroup.visible = false;

                            if (chunk.isPhysicsActive) {
                                for (let i = 0; i < chunk.physicsBodies.length; i++) {
                                    this.world.removeBody(chunk.physicsBodies[i]);
                                }
                                chunk.isPhysicsActive = false;
                            }
                        }
                        countInactive++;
                    }
                });
            }
        }
