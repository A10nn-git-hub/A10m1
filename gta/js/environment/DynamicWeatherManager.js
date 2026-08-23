/**
         * STEP 24 & 29: Менеджер динамической погоды и реалистичной системы капель дождя
         */
        class DynamicWeatherManager {
            constructor(scene, roadNetwork, dayNightCycle) {
                this.scene = scene;
                this.roadNetwork = roadNetwork;
                this.dayNightCycle = dayNightCycle;

                // 4 типа погоды с разной интенсивностью
                this.weatherTypes = ['CLEAR', 'DRIZZLE', 'RAIN', 'SHOWER'];
                this.currentWeatherIndex = 0;
                this.weatherState = 'CLEAR';

                this.rainIntensity = 0.0;
                this.targetRainIntensity = 0.0;
                this.wetness = 0.0;

                this.weatherTimer = 0.0;
                this.autoWeatherDuration = 100.0;

                this.weatherStatElement = document.getElementById('stat-weather');

                // Предрассчитанные границы крыш для мгновенной проверки без аллокаций
                this.roofBounds = [
                    { minX: -13.5, maxX: 13.5, minZ: 46.5, maxZ: 73.5, roofY: 92.0 }, // Maze Bank
                    { minX: -75.5, maxX: -44.5, minZ: 46.5, maxZ: 73.5, roofY: 6.8 },  // LSPD
                    { minX: 46.5, maxX: 73.5, minZ: 46.5, maxZ: 73.5, roofY: 6.8 },   // Pillbox Hospital
                    { minX: -42.5, maxX: -27.5, minZ: -41.0, maxZ: -29.0, roofY: 7.2 }, // House 1
                    { minX: 27.5, maxX: 42.5, minZ: -41.0, maxZ: -29.0, roofY: 7.2 },  // House 2
                    { minX: -42.5, maxX: -27.5, minZ: 29.0, maxZ: 41.0, roofY: 7.2 },  // House 3
                    { minX: 27.5, maxX: 42.5, minZ: 29.0, maxZ: 41.0, roofY: 7.2 }   // House 4
                ];

                this.initRainParticleSystem();
            }

            initRainParticleSystem() {
                // Высокопроизводительный плотный 3D дождь (850 струй вокруг фокуса = 1700 вершин)
                const streakCount = 850;
                const geometry = new THREE.BufferGeometry();
                const positions = new Float32Array(streakCount * 6);
                const dropData = [];

                for (let i = 0; i < streakCount; i++) {
                    const ox = (Math.random() - 0.5) * 55.0;
                    const oy = Math.random() * 36.0;
                    const oz = (Math.random() - 0.5) * 55.0;
                    const len = 1.4 + Math.random() * 0.9;
                    const spd = 28.0 + Math.random() * 10.0;

                    dropData.push({ x: ox, y: oy, z: oz, len: len, speed: spd });

                    // Top vertex
                    positions[i * 6 + 0] = ox;
                    positions[i * 6 + 1] = oy + len;
                    positions[i * 6 + 2] = oz;

                    // Bottom vertex
                    positions[i * 6 + 3] = ox;
                    positions[i * 6 + 4] = oy;
                    positions[i * 6 + 5] = oz;
                }

                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

                this.rainMaterial = new THREE.LineBasicMaterial({
                    color: 0x82bcf8,
                    transparent: true,
                    opacity: 0.0,
                    depthWrite: false,
                    blending: THREE.NormalBlending
                });

                this.rainLines = new THREE.LineSegments(geometry, this.rainMaterial);
                this.rainLines.dropData = dropData;
                this.rainLines.visible = false;
                this.scene.add(this.rainLines);
            }

            cycleWeather() {
                this.currentWeatherIndex = (this.currentWeatherIndex + 1) % this.weatherTypes.length;
                this.setWeather(this.weatherTypes[this.currentWeatherIndex]);
            }

            setWeather(type) {
                this.weatherState = type;
                if (type === 'CLEAR') {
                    this.targetRainIntensity = 0.0;
                } else if (type === 'DRIZZLE') {
                    this.targetRainIntensity = 0.22;
                } else if (type === 'RAIN') {
                    this.targetRainIntensity = 0.55;
                } else if (type === 'SHOWER') {
                    this.targetRainIntensity = 0.82;
                }
                this.updateUI();
            }

            updateUI() {
                if (this.weatherStatElement) {
                    const names = {
                        CLEAR: 'Ясно [U]',
                        DRIZZLE: 'Легкая морось [U]',
                        RAIN: 'Умеренный дождь [U]',
                        SHOWER: 'Ливень [U]'
                    };
                    const colors = {
                        CLEAR: '#ffd700',
                        DRIZZLE: '#81d4fa',
                        RAIN: '#29b6f6',
                        SHOWER: '#00e5ff'
                    };
                    this.weatherStatElement.innerText = names[this.weatherState] || this.weatherState;
                    this.weatherStatElement.style.color = colors[this.weatherState] || '#ffffff';
                }
            }

            isPositionCoveredByRoof(wx, y, wz) {
                if (y >= 92.0) return false;
                const bounds = this.roofBounds;
                for (let i = 0; i < bounds.length; i++) {
                    const b = bounds[i];
                    if (y < b.roofY && wx >= b.minX && wx <= b.maxX && wz >= b.minZ && wz <= b.maxZ) {
                        return true;
                    }
                }
                return false;
            }

            isFocusInsideBuilding(pos) {
                if (!pos) return false;
                const px = pos.x, pz = pos.z, py = pos.y;
                if (Math.abs(px) < 12.0 && Math.abs(pz - 60.0) < 12.0 && py < 85.0) return true;
                if (Math.abs(px - (-60.0)) < 14.0 && Math.abs(pz - 60.0) < 12.0 && py < 6.5) return true;
                if (Math.abs(px - 60.0) < 12.0 && Math.abs(pz - 60.0) < 11.0 && py < 6.5) return true;
                return false;
            }

            update(deltaTime, focusPos) {
                this.weatherTimer += deltaTime;
                if (this.weatherTimer >= this.autoWeatherDuration) {
                    this.weatherTimer = 0.0;
                    this.cycleWeather();
                }

                // Естественная легкая пульсация интенсивности дождя (то чуть слабее, то сильнее)
                let effectiveTarget = this.targetRainIntensity;
                if (this.targetRainIntensity > 0.05) {
                    const naturalPulse = Math.sin(this.weatherTimer * 0.3) * 0.08;
                    effectiveTarget = Math.max(0.05, Math.min(1.0, this.targetRainIntensity + naturalPulse));
                }

                // Плавная интерполяция интенсивности дождя
                const rainLerpRate = 0.6;
                this.rainIntensity += (effectiveTarget - this.rainIntensity) * Math.min(deltaTime * rainLerpRate, 1.0);

                // Накопление и высыхание влажности асфальта (Wetness)
                if (this.rainIntensity > 0.05) {
                    this.wetness = Math.min(1.0, this.wetness + deltaTime * 0.14 * this.rainIntensity);
                } else {
                    this.wetness = Math.max(0.0, this.wetness - deltaTime * 0.035);
                }

                // Обновление влажности и отражающей способности дорог
                if (this.roadNetwork) {
                    this.roadNetwork.updateWetness(this.wetness);
                }

                // Плотность тумана (Fog) и мягкая дымка при дожде
                if (this.scene && this.scene.fog) {
                    const baseFog = 0.0012;
                    const rainFogBonus = 0.0022;
                    this.scene.fog.density = baseFog + rainFogBonus * this.rainIntensity;
                }

                // Анимация вертикальных падающих сверху вниз струй дождя
                if (this.rainLines && this.rainMaterial) {
                    const isInside = this.isFocusInsideBuilding(focusPos);
                    // Внутри зданий капли не отрисовываются перед камерой
                    this.rainMaterial.opacity = isInside ? 0.0 : (this.rainIntensity * 0.58);
                    this.rainLines.visible = (!isInside && this.rainIntensity > 0.01);

                    if (this.rainLines.visible && focusPos) {
                        const positions = this.rainLines.geometry.attributes.position.array;
                        const drops = this.rainLines.dropData;
                        const dt = Math.min(deltaTime, 0.1);

                        this.rainLines.position.x = focusPos.x;
                        this.rainLines.position.z = focusPos.z;

                        for (let i = 0; i < drops.length; i++) {
                            const d = drops[i];
                            d.y -= d.speed * dt;

                            const wx = focusPos.x + d.x;
                            const wz = focusPos.z + d.z;

                            // Дождь падает строго сверху вниз и блокируется крышами зданий
                            if (d.y <= 0.0 || this.isPositionCoveredByRoof(wx, d.y, wz)) {
                                d.y = 35.0 + Math.random() * 4.0;
                                d.x = (Math.random() - 0.5) * 70.0;
                                d.z = (Math.random() - 0.5) * 70.0;
                            }

                            // Top vertex
                            positions[i * 6 + 0] = d.x;
                            positions[i * 6 + 1] = d.y + d.len;
                            positions[i * 6 + 2] = d.z;

                            // Bottom vertex
                            positions[i * 6 + 3] = d.x;
                            positions[i * 6 + 4] = d.y;
                            positions[i * 6 + 5] = d.z;
                        }
                        this.rainLines.geometry.attributes.position.needsUpdate = true;
                    }
                }
            }
        }
