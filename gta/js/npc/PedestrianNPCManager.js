class PedestrianNPCManager {
            constructor(scene, world, physicsMaterials, camera, isMobile = false) {
                this.scene = scene;
                this.world = world;
                this.physicsMaterials = physicsMaterials;
                this.camera = camera;
                this.isMobile = isMobile;
                this.pedestrians = [];
                this.soccerBalls = [];
                this.maxPedestrians = this.isMobile ? 12 : 24;

                this.sidewalkRoutes = [
                    [
                        { x: -9.8, z: -9.8 }, { x: -9.8, z: -48.0 }, { x: -9.8, z: -9.8 }
                    ],
                    [
                        { x: -9.8, z: -9.8 }, { x: 9.8, z: -9.8, isCrosswalk: true },
                        { x: 9.8, z: 9.8 }, { x: -9.8, z: 9.8, isCrosswalk: true },
                        { x: -9.8, z: -9.8 }
                    ],
                    [
                        { x: 9.8, z: -48.0 }, { x: 9.8, z: 48.0 }, { x: 9.8, z: -48.0 }
                    ],
                    [
                        { x: -48.0, z: 9.8 }, { x: 48.0, z: 9.8 }, { x: -48.0, z: 9.8 }
                    ],
                    [
                        { x: -48.0, z: -9.8 }, { x: 48.0, z: -9.8 }, { x: -48.0, z: -9.8 }
                    ]
                ];

                this.initSoccerBalls();
                this.initPedestrianPool();

                this.buildingVisitTimers = {
                    'BANK': 10.0,
                    'HOSPITAL': 25.0,
                    'POLICE': 40.0
                };
            }

            initSoccerBalls() {
                const matchBall = new PhysicalSoccerBall(this.scene, this.world, this.physicsMaterials, -9.8, 0.4, 25.0);
                this.soccerBalls.push(matchBall);

                const freeBall1 = new PhysicalSoccerBall(this.scene, this.world, this.physicsMaterials, 9.8, 0.4, 30.0);
                const freeBall2 = new PhysicalSoccerBall(this.scene, this.world, this.physicsMaterials, -9.8, 0.4, -25.0);
                const freeBall3 = new PhysicalSoccerBall(this.scene, this.world, this.physicsMaterials, 25.0, 0.4, -9.8);
                this.soccerBalls.push(freeBall1, freeBall2, freeBall3);
            }

            initPedestrianPool() {
                for (let i = 0; i < this.maxPedestrians; i++) {
                    const isSoccerFriendPair = (i === 4 || i === 5);
                    let startPos;
                    let route = null;
                    let waypointIndex = 0;

                    if (isSoccerFriendPair) {
                        startPos = { x: -9.8, z: (i === 4 ? 22.0 : 28.0) };
                    } else {
                        const routeIndex = i % this.sidewalkRoutes.length;
                        route = this.sidewalkRoutes[routeIndex];
                        waypointIndex = (i * 2) % route.length;
                        const wpA = route[waypointIndex];
                        const wpB = route[(waypointIndex + 1) % route.length];
                        const lerpFactor = ((i * 0.41) % 1.0);

                        startPos = {
                            x: THREE.MathUtils.lerp(wpA.x, wpB.x, lerpFactor),
                            z: THREE.MathUtils.lerp(wpA.z, wpB.z, lerpFactor)
                        };
                    }

                    const npc = new HumanoidNPC(
                        this.scene, this.world, this.physicsMaterials,
                        startPos, route, (waypointIndex + 1) % (route ? route.length : 1), i, (i === 5)
                    );

                    this.pedestrians.push(npc);
                }

                if (this.pedestrians[4] && this.pedestrians[5]) {
                    this.pedestrians[4].partnerNPC = this.pedestrians[5];
                    this.pedestrians[5].partnerNPC = this.pedestrians[4];
                    this.pedestrians[4].soccerBall = this.soccerBalls[0];
                    this.pedestrians[5].soccerBall = this.soccerBalls[0];
                }
            }

            update(deltaTime, playerPosition, drivenCar, allCars) {
                for (let i = 0; i < this.soccerBalls.length; i++) {
                    this.soccerBalls[i].update();
                }

                const buildingKeys = ['BANK', 'HOSPITAL', 'POLICE'];
                for (const bKey of buildingKeys) {
                    if (this.buildingVisitTimers[bKey] !== undefined) {
                        this.buildingVisitTimers[bKey] -= deltaTime;
                        if (this.buildingVisitTimers[bKey] <= 0) {
                            this.buildingVisitTimers[bKey] = 40.0 + Math.random() * 25.0;

                            const occupiedIds = new Set(
                                this.pedestrians
                                    .filter(p => p.interiorState !== 'NONE' && p.interiorMission)
                                    .map(p => p.interiorMission.id)
                            );

                            const freeSpots = INTERIOR_DESTINATIONS.filter(d => d.building === bKey && !occupiedIds.has(d.id));
                            if (freeSpots.length > 0) {
                                const dest = freeSpots[Math.floor(Math.random() * freeSpots.length)];
                                let bestNpc = null;
                                let minDistance = Infinity;
                                for (let p of this.pedestrians) {
                                    if (p.npcType !== 'SOCCER_PLAYER' && p.state !== 'KNOCKED_DOWN' && p.interiorState === 'NONE') {
                                        const dist = Math.hypot(p.body.position.x - dest.entrance.x, p.body.position.z - dest.entrance.z);
                                        if (dist < minDistance) {
                                            minDistance = dist;
                                            bestNpc = p;
                                        }
                                    }
                                }
                                if (bestNpc) {
                                    bestNpc.interiorMission = dest;
                                    bestNpc.interiorState = 'HEADING_TO_ENTRANCE';
                                    bestNpc.interiorWaypointIndex = 0;
                                }
                            }
                        }
                    }
                }

                if (!playerPosition) return;
                const playerCol = Math.max(0, Math.min(4, Math.floor((playerPosition.x + 150) / 60)));
                const playerRow = Math.max(0, Math.min(3, Math.floor((playerPosition.z + 120) / 60)));

                for (let i = 0; i < this.pedestrians.length; i++) {
                    const npc = this.pedestrians[i];
                    if (!npc || !npc.body) continue;
                    const nx = npc.body.position.x;
                    const nz = npc.body.position.z;
                    const nCol = Math.max(0, Math.min(4, Math.floor((nx + 150) / 60)));
                    const nRow = Math.max(0, Math.min(3, Math.floor((nz + 120) / 60)));
                    const isActive = (Math.abs(nCol - playerCol) <= 1 && Math.abs(nRow - playerRow) <= 1);

                    if (isActive) {
                        if (npc.isSleeping) {
                            npc.isSleeping = false;
                            npc.body.wakeUp();
                            npc.setShadowsEnabled(true);
                        }
                        npc.update(deltaTime, playerPosition, this.pedestrians, this.soccerBalls, drivenCar, allCars);
                    } else {
                        if (!npc.isSleeping) {
                            npc.isSleeping = true;
                            npc.body.velocity.set(0, 0, 0);
                            npc.body.sleep();
                            npc.setShadowsEnabled(false);
                        }
                    }
                }
            }
        }
