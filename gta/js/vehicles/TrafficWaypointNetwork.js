class TrafficWaypointNetwork {
            constructor() {
                this.routes = [];
                this.buildCityRoutes();
                this.buildHighwayRoutes();
                this.buildDirtRoutes();
            }

            buildCityRoutes() {
                const isBuildingBlocked = (px, pz) => {
                    if (Math.hypot(px - 0, pz - 60) < 32.0) return true;     // Maze Bank Lobby
                    if (Math.hypot(px - 0, pz - 0) < 32.0) return true;      // Maze Bank Tower
                    if (Math.hypot(px - 60, pz - 60) < 32.0) return true;    // Hospital
                    if (Math.hypot(px - (-60), pz - 60) < 32.0) return true; // Police
                    if (Math.hypot(px - 60, pz - (-60)) < 28.0) return true; // House 2
                    if (Math.hypot(px - (-60), pz - (-60)) < 28.0) return true; // House 1
                    if (Math.hypot(px - (-120), pz - 60) < 30.0) return true; // Warehouse
                    if (Math.hypot(px - 120, pz - 60) < 30.0) return true; // Factory
                    return false;
                };

                const laneOffset = 3.8;
                for (let gz = -6; gz <= 6; gz++) {
                    const z = gz * 60.0;
                    const rWE = [];
                    for (let x = -420; x <= 420; x += 30) {
                        const pt = { x, z: z + laneOffset, speed: 12.5, type: 'CITY' };
                        if (!isBuildingBlocked(pt.x, pt.z)) rWE.push(pt);
                    }
                    if (rWE.length >= 2) this.routes.push(rWE);

                    const rEW = [];
                    for (let x = 420; x >= -420; x -= 30) {
                        const pt = { x, z: z - laneOffset, speed: 12.5, type: 'CITY' };
                        if (!isBuildingBlocked(pt.x, pt.z)) rEW.push(pt);
                    }
                    if (rEW.length >= 2) this.routes.push(rEW);
                }

                for (let gx = -6; gx <= 6; gx++) {
                    const x = gx * 60.0;
                    const rSN = [];
                    for (let z = 420; z >= -420; z -= 30) {
                        const pt = { x: x + laneOffset, z, speed: 12.5, type: 'CITY' };
                        if (!isBuildingBlocked(pt.x, pt.z)) rSN.push(pt);
                    }
                    if (rSN.length >= 2) this.routes.push(rSN);

                    const rNS = [];
                    for (let z = -420; z <= 420; z += 30) {
                        const pt = { x: x - laneOffset, z, speed: 12.5, type: 'CITY' };
                        if (!isBuildingBlocked(pt.x, pt.z)) rNS.push(pt);
                    }
                    if (rNS.length >= 2) this.routes.push(rNS);
                }
            }

            buildHighwayRoutes() {
                const hwOuter = [];
                const rOut = 458.0;
                const segs = 32;
                for (let i = 0; i <= segs; i++) {
                    const angle = (i / segs) * Math.PI * 2;
                    hwOuter.push({
                        x: Math.cos(angle) * rOut,
                        z: Math.sin(angle) * rOut,
                        speed: 26.4,
                        type: 'HIGHWAY'
                    });
                }
                this.routes.push(hwOuter);

                const hwInner = [];
                const rIn = 442.0;
                for (let i = segs; i >= 0; i--) {
                    const angle = (i / segs) * Math.PI * 2;
                    hwInner.push({
                        x: Math.cos(angle) * rIn,
                        z: Math.sin(angle) * rIn,
                        speed: 26.4,
                        type: 'HIGHWAY'
                    });
                }
                this.routes.push(hwInner);
            }

            buildDirtRoutes() {
                const dirt1 = [
                    { x: -300, z: -280, speed: 10.5, type: 'DIRT' },
                    { x: -210, z: -320, speed: 9.0, type: 'DIRT' },
                    { x: -120, z: -360, speed: 11.0, type: 'DIRT' },
                    { x: 0, z: -390, speed: 9.5, type: 'DIRT' },
                    { x: 140, z: -370, speed: 11.0, type: 'DIRT' },
                    { x: 280, z: -310, speed: 10.0, type: 'DIRT' }
                ];
                this.routes.push(dirt1);

                const dirt2 = [
                    { x: 280, z: -310, speed: 10.0, type: 'DIRT' },
                    { x: 140, z: -370, speed: 11.0, type: 'DIRT' },
                    { x: 0, z: -390, speed: 9.5, type: 'DIRT' },
                    { x: -120, z: -360, speed: 11.0, type: 'DIRT' },
                    { x: -210, z: -320, speed: 9.0, type: 'DIRT' },
                    { x: -300, z: -280, speed: 10.5, type: 'DIRT' }
                ];
                this.routes.push(dirt2);
            }

            getRandomRoute() {
                return this.routes[Math.floor(Math.random() * this.routes.length)];
            }
        }
