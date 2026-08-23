/**
         * STEP 35: Главный менеджер автономного ambient-трафика
         */
        class AmbientTrafficManager {
            constructor(scene, world, physicsMaterials, terrainManager, roadNetwork, isMobile = false) {
                this.scene = scene;
                this.world = world;
                this.physicsMaterials = physicsMaterials;
                this.terrainManager = terrainManager;
                this.roadNetwork = roadNetwork;
                this.isMobile = isMobile;

                this.waypointNetwork = new TrafficWaypointNetwork();
                this.vehicles = [];
                this.MAX_AI_CARS = this.isMobile ? 10 : 24;

                this.spawnInitialTraffic();
            }

            spawnInitialTraffic() {
                for (let i = 0; i < this.MAX_AI_CARS; i++) {
                    const car = new AITrafficVehicle(
                        this.scene, this.world, this.physicsMaterials, this.terrainManager, i
                    );
                    const route = this.waypointNetwork.getRandomRoute();
                    const wpIdx = Math.floor(Math.random() * route.length);
                    car.spawnOnRoute(route, wpIdx);
                    this.vehicles.push(car);
                }
            }

            update(deltaTime, playerPos, activeDrivenCar, dayNightCycle, allPedestrians = []) {
                const nightFactor = dayNightCycle ? dayNightCycle.nightFactor : 0.0;
                const centerPos = activeDrivenCar ? activeDrivenCar.chassisBody.position : playerPos;
                if (!centerPos) return;

                const playerCol = Math.max(0, Math.min(4, Math.floor((centerPos.x + 150) / 60)));
                const playerRow = Math.max(0, Math.min(3, Math.floor((centerPos.z + 120) / 60)));

                for (let i = 0; i < this.vehicles.length; i++) {
                    const car = this.vehicles[i];
                    const cp = car.chassisBody.position;
                    const cCol = Math.max(0, Math.min(4, Math.floor((cp.x + 150) / 60)));
                    const cRow = Math.max(0, Math.min(3, Math.floor((cp.z + 120) / 60)));
                    const isActive = (Math.abs(cCol - playerCol) <= 1 && Math.abs(cRow - playerRow) <= 1);

                    if (isActive) {
                        if (car.isSleeping) {
                            car.isSleeping = false;
                            car.chassisBody.wakeUp();
                            car.setShadowsEnabled(true);
                        }
                        car.update(deltaTime, playerPos, activeDrivenCar, this.vehicles, nightFactor, allPedestrians);
                    } else {
                        if (!car.isSleeping) {
                            car.isSleeping = true;
                            car.chassisBody.velocity.set(0, 0, 0);
                            car.chassisBody.angularVelocity.set(0, 0, 0);
                            car.chassisBody.sleep();
                            car.setShadowsEnabled(false);
                        }
                    }

                    // Рециркуляция/переспавн слишком далеких машин (быстрая проверка по distSq > 320^2)
                    const dx = car.chassisBody.position.x - centerPos.x;
                    const dz = car.chassisBody.position.z - centerPos.z;
                    const distSq = dx * dx + dz * dz;

                    if (distSq > 102400.0) {
                        const newRoute = this.waypointNetwork.getRandomRoute();
                        let bestWpIdx = 0;
                        let minDiff = 999;
                        for (let w = 0; w < newRoute.length; w++) {
                            const wp = newRoute[w];
                            const d = Math.hypot(wp.x - centerPos.x, wp.z - centerPos.z);
                            if (Math.abs(d - 120.0) < minDiff) {
                                minDiff = Math.abs(d - 120.0);
                                bestWpIdx = w;
                            }
                        }
                        car.spawnOnRoute(newRoute, bestWpIdx);
                    }
                }
            }

            getAllCars() {
                return this.vehicles;
            }
        }

        /**
         * STEP 27 & 29: Конфигурация разнообразных локаций и действий внутри интерьеров и под навесами
         */
        const INTERIOR_DESTINATIONS = [
            // MAZE BANK INTERIOR SPOTS
            {
                id: 'BANK_NEWSPAPER',
                building: 'BANK',
                entrance: { x: 0.0, z: 47.0 },
                indoorWaypoints: [{ x: 0.0, z: 53.0 }, { x: -6.5, z: 56.5 }],
                exitWaypoints: [{ x: 0.0, z: 53.0 }, { x: 0.0, z: 47.0 }],
                actionType: 'READ_NEWSPAPER',
                targetRotation: 0.2,
                duration: 35.0
            },
            {
                id: 'BANK_BOOK',
                building: 'BANK',
                entrance: { x: 0.0, z: 47.0 },
                indoorWaypoints: [{ x: 0.0, z: 53.0 }, { x: 6.8, z: 56.0 }],
                exitWaypoints: [{ x: 0.0, z: 53.0 }, { x: 0.0, z: 47.0 }],
                actionType: 'READ_BOOK',
                targetRotation: -Math.PI / 2,
                duration: 40.0
            },
            {
                id: 'BANK_PHONE',
                building: 'BANK',
                entrance: { x: 0.0, z: 47.0 },
                indoorWaypoints: [{ x: 0.0, z: 53.0 }, { x: 5.5, z: 62.0 }],
                exitWaypoints: [{ x: 0.0, z: 53.0 }, { x: 0.0, z: 47.0 }],
                actionType: 'PHONE_CALL',
                targetRotation: Math.PI,
                duration: 30.0
            },
            {
                id: 'BANK_COFFEE',
                building: 'BANK',
                entrance: { x: 0.0, z: 47.0 },
                indoorWaypoints: [{ x: 0.0, z: 53.0 }, { x: -7.0, z: 63.5 }],
                exitWaypoints: [{ x: 0.0, z: 53.0 }, { x: 0.0, z: 47.0 }],
                actionType: 'DRINK_COFFEE',
                targetRotation: Math.PI / 2,
                duration: 32.0
            },
            {
                id: 'BANK_TELLER',
                building: 'BANK',
                entrance: { x: 0.0, z: 47.0 },
                indoorWaypoints: [{ x: 0.0, z: 53.0 }, { x: 0.0, z: 65.5 }],
                exitWaypoints: [{ x: 0.0, z: 53.0 }, { x: 0.0, z: 47.0 }],
                actionType: 'BANK_TALK',
                targetRotation: 0,
                duration: 28.0
            },
            {
                id: 'BANK_WINDOW',
                building: 'BANK',
                entrance: { x: 0.0, z: 47.0 },
                indoorWaypoints: [{ x: 0.0, z: 53.0 }, { x: -4.0, z: 49.5 }],
                exitWaypoints: [{ x: 0.0, z: 53.0 }, { x: 0.0, z: 47.0 }],
                actionType: 'WINDOW_WATCH',
                targetRotation: Math.PI,
                duration: 35.0
            },

            // PILLBOX HOSPITAL SPOTS
            {
                id: 'HOSPITAL_MAGAZINE',
                building: 'HOSPITAL',
                entrance: { x: 60.0, z: 47.0 },
                indoorWaypoints: [{ x: 60.0, z: 53.0 }, { x: 54.5, z: 56.5 }],
                exitWaypoints: [{ x: 60.0, z: 53.0 }, { x: 60.0, z: 47.0 }],
                actionType: 'READ_BOOK',
                targetRotation: Math.PI / 2,
                duration: 35.0
            },
            {
                id: 'HOSPITAL_PHONE',
                building: 'HOSPITAL',
                entrance: { x: 60.0, z: 47.0 },
                indoorWaypoints: [{ x: 60.0, z: 53.0 }, { x: 66.5, z: 57.0 }],
                exitWaypoints: [{ x: 60.0, z: 53.0 }, { x: 60.0, z: 47.0 }],
                actionType: 'PHONE_CALL',
                targetRotation: -Math.PI / 2,
                duration: 30.0
            },
            {
                id: 'HOSPITAL_COFFEE',
                building: 'HOSPITAL',
                entrance: { x: 60.0, z: 47.0 },
                indoorWaypoints: [{ x: 60.0, z: 53.0 }, { x: 57.0, z: 64.0 }],
                exitWaypoints: [{ x: 60.0, z: 53.0 }, { x: 60.0, z: 47.0 }],
                actionType: 'DRINK_COFFEE',
                targetRotation: 0,
                duration: 35.0
            },
            {
                id: 'HOSPITAL_SIT',
                building: 'HOSPITAL',
                entrance: { x: 60.0, z: 47.0 },
                indoorWaypoints: [{ x: 60.0, z: 53.0 }, { x: 64.0, z: 64.5 }],
                exitWaypoints: [{ x: 60.0, z: 53.0 }, { x: 60.0, z: 47.0 }],
                actionType: 'HOSPITAL_SIT',
                targetRotation: -Math.PI / 2,
                duration: 40.0
            },

            // LSPD POLICE PRECINCT SPOTS
            {
                id: 'POLICE_CLIPBOARD',
                building: 'POLICE',
                entrance: { x: -60.0, z: 47.0 },
                indoorWaypoints: [{ x: -60.0, z: 53.0 }, { x: -55.0, z: 58.0 }],
                exitWaypoints: [{ x: -60.0, z: 53.0 }, { x: -60.0, z: 47.0 }],
                actionType: 'POLICE_REPORT',
                targetRotation: -Math.PI / 2,
                duration: 30.0
            },
            {
                id: 'POLICE_NEWSPAPER',
                building: 'POLICE',
                entrance: { x: -60.0, z: 47.0 },
                indoorWaypoints: [{ x: -60.0, z: 53.0 }, { x: -65.5, z: 56.5 }],
                exitWaypoints: [{ x: -60.0, z: 53.0 }, { x: -60.0, z: 47.0 }],
                actionType: 'READ_NEWSPAPER',
                targetRotation: Math.PI / 2,
                duration: 35.0
            },
            {
                id: 'POLICE_COFFEE',
                building: 'POLICE',
                entrance: { x: -60.0, z: 47.0 },
                indoorWaypoints: [{ x: -60.0, z: 53.0 }, { x: -66.0, z: 63.5 }],
                exitWaypoints: [{ x: -60.0, z: 53.0 }, { x: -60.0, z: 47.0 }],
                actionType: 'DRINK_COFFEE',
                targetRotation: 0,
                duration: 35.0
            },
            {
                id: 'POLICE_LEAN',
                building: 'POLICE',
                entrance: { x: -60.0, z: 47.0 },
                indoorWaypoints: [{ x: -60.0, z: 53.0 }, { x: -54.0, z: 64.0 }],
                exitWaypoints: [{ x: -60.0, z: 53.0 }, { x: -60.0, z: 47.0 }],
                actionType: 'POLICE_LEAN',
                targetRotation: Math.PI,
                duration: 35.0
            },

            // COVERED CANOPIES & STOREFRONTS (Уличные навесы от дождя)
            {
                id: 'AWNING_SOCCER_1',
                building: 'AWNING_WEST',
                entrance: { x: -14.0, z: 12.0 },
                indoorWaypoints: [{ x: -14.0, z: 14.5 }],
                exitWaypoints: [{ x: -14.0, z: 12.0 }],
                actionType: 'SOCCER_JUGGLE',
                targetRotation: 0,
                duration: 35.0
            },
            {
                id: 'AWNING_SOCCER_2',
                building: 'AWNING_WEST',
                entrance: { x: -14.0, z: 12.0 },
                indoorWaypoints: [{ x: -14.0, z: 18.5 }],
                exitWaypoints: [{ x: -14.0, z: 12.0 }],
                actionType: 'SOCCER_JUGGLE',
                targetRotation: Math.PI,
                duration: 35.0
            },
            {
                id: 'AWNING_NEWSPAPER_EAST',
                building: 'AWNING_EAST',
                entrance: { x: 14.0, z: 12.0 },
                indoorWaypoints: [{ x: 14.0, z: 15.0 }],
                exitWaypoints: [{ x: 14.0, z: 12.0 }],
                actionType: 'READ_NEWSPAPER',
                targetRotation: -Math.PI / 2,
                duration: 35.0
            },
            {
                id: 'AWNING_BOOK_EAST',
                building: 'AWNING_EAST',
                entrance: { x: 14.0, z: 12.0 },
                indoorWaypoints: [{ x: 14.0, z: 20.0 }],
                exitWaypoints: [{ x: 14.0, z: 12.0 }],
                actionType: 'READ_BOOK',
                targetRotation: -Math.PI / 2,
                duration: 40.0
            },
            {
                id: 'AWNING_PHONE_NORTH',
                building: 'AWNING_NORTH',
                entrance: { x: -12.0, z: -14.0 },
                indoorWaypoints: [{ x: -15.0, z: -14.0 }],
                exitWaypoints: [{ x: -12.0, z: -14.0 }],
                actionType: 'PHONE_CALL',
                targetRotation: Math.PI / 2,
                duration: 30.0
            },

            // SUBURBAN HOUSES
            {
                id: 'HOUSE_NW_BOOK',
                building: 'HOUSE_NW',
                entrance: { x: -90.0, z: -96.5 },
                indoorWaypoints: [{ x: -90.0, z: -90.0 }, { x: -93.5, z: -88.5 }],
                exitWaypoints: [{ x: -90.0, z: -90.0 }, { x: -90.0, z: -96.5 }],
                actionType: 'READ_BOOK',
                targetRotation: 0,
                duration: 45.0
            },
            {
                id: 'HOUSE_NE_PHONE',
                building: 'HOUSE_NE',
                entrance: { x: 90.0, z: -96.5 },
                indoorWaypoints: [{ x: 90.0, z: -90.0 }, { x: 86.5, z: -88.5 }],
                exitWaypoints: [{ x: 90.0, z: -90.0 }, { x: 90.0, z: -96.5 }],
                actionType: 'PHONE_CALL',
                targetRotation: 0,
                duration: 45.0
            },
            {
                id: 'HOUSE_SW_NEWSPAPER',
                building: 'HOUSE_SW',
                entrance: { x: -90.0, z: 83.5 },
                indoorWaypoints: [{ x: -90.0, z: 90.0 }, { x: -93.5, z: 91.5 }],
                exitWaypoints: [{ x: -90.0, z: 90.0 }, { x: -90.0, z: 83.5 }],
                actionType: 'READ_NEWSPAPER',
                targetRotation: 0,
                duration: 45.0
            },
            {
                id: 'HOUSE_SE_COFFEE',
                building: 'HOUSE_SE',
                entrance: { x: 90.0, z: 83.5 },
                indoorWaypoints: [{ x: 90.0, z: 90.0 }, { x: 86.5, z: 91.5 }],
                exitWaypoints: [{ x: 90.0, z: 90.0 }, { x: 90.0, z: 83.5 }],
                actionType: 'DRINK_COFFEE',
                targetRotation: 0,
                duration: 45.0
            }
        ];
