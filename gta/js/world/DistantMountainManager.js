/**
         * STEP 36: Дальние низкополигональные горные хребты (120м - 380м) на границе горизонта
         */
        class DistantMountainManager {
            constructor(scene, terrainManager) {
                this.scene = scene;
                this.terrainManager = terrainManager;
                this.mountainMesh = null;
                this.noise = new ProceduralNoiseGenerator(777);

                this.buildDistantMountains();
            }

            buildDistantMountains() {
                // Создание горного кольца от R = 380м до R = 1200м (Северные и Восточные хребты)
                const rings = 12;
                const segments = 120;
                const minR = 380.0;
                const maxR = 1200.0;

                const geo = new THREE.RingGeometry(minR, maxR, segments, rings);
                geo.rotateX(-Math.PI / 2);

                const pos = geo.attributes.position;
                const count = pos.count;
                const colors = new Float32Array(count * 3);

                const cDarkRock = new THREE.Color(0x332f2c);
                const cMidRock = new THREE.Color(0x57534e);
                const cSnowPeak = new THREE.Color(0xf8fafc);
                const tempC = new THREE.Color();

                for (let i = 0; i < count; i++) {
                    const x = pos.getX(i);
                    const z = pos.getZ(i);
                    const dist = Math.hypot(x, z);
                    const angle = Math.atan2(z, x);

                    // Горы преимущественно на Севере, Северо-Востоке и Востоке
                    const isLandSector = Math.sin(angle * 0.8 + 0.4) > -0.25 || z < 0;

                    let altitude = 0.0;
                    if (isLandSector) {
                        const n1 = this.noise.fbm(x * 0.0035, z * 0.0035, 4);
                        const n2 = this.noise.noise2D(x * 0.008, z * 0.008);
                        
                        // Высоты нарастают от границы города (380м) к дальнему горизонту (1000м)
                        const distFactor = THREE.MathUtils.smoothstep(dist, minR, 900.0);
                        const ridgeProfile = Math.pow(Math.abs(n1), 1.8) * 140.0;
                        altitude = ridgeProfile * distFactor + (n2 * 20.0 * distFactor);
                    } else {
                        altitude = -2.5;
                    }

                    pos.setY(i, altitude);

                    // Окрашивание вершин: скалы у подножия -> снежные шапки на вершинах > 180м
                    if (altitude > 190.0) {
                        const snowLerp = Math.min(1.0, (altitude - 190.0) / 110.0);
                        tempC.lerpColors(cMidRock, cSnowPeak, snowLerp);
                    } else if (altitude > 40.0) {
                        tempC.lerpColors(cDarkRock, cMidRock, altitude / 190.0);
                    } else {
                        tempC.copy(cDarkRock);
                    }

                    colors[i * 3 + 0] = tempC.r;
                    colors[i * 3 + 1] = tempC.g;
                    colors[i * 3 + 2] = tempC.b;
                }

                geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                geo.computeVertexNormals();

                const mat = new THREE.MeshStandardMaterial({
                    vertexColors: true,
                    roughness: 0.95,
                    metalness: 0.05,
                    flatShading: true
                });

                this.mountainMesh = new THREE.Mesh(geo, mat);
                this.mountainMesh.receiveShadow = true;
                this.scene.add(this.mountainMesh);
            }

            setEcoMode(isEco) {
                if (this.mountainMesh) {
                    this.mountainMesh.visible = !isEco;
                }
            }
        }

window.DistantMountainManager = DistantMountainManager;
