/**
         * Менеджер суточного цикла
         */
        class DayNightCycleManager {
            constructor(scene, sky, sunLight, hemiLight, ambientLight, streetLampManager, houseBuilder, orgBuildingBuilder) {
                this.scene = scene;
                this.sky = sky;
                this.sunLight = sunLight;
                this.hemiLight = hemiLight;
                this.ambientLight = ambientLight;
                this.streetLampManager = streetLampManager;
                this.houseBuilder = houseBuilder;
                this.orgBuildingBuilder = orgBuildingBuilder;

                this.calendar = new CalendarAndSeasonSystem();
                this.time = 14.0;
                this.timeScale = 0.0333;
                this.sunPosition = this.calendar.calculateSolarVector(this.time);
                this.moonPosition = new THREE.Vector3(-this.sunPosition.x, -this.sunPosition.y, -this.sunPosition.z).normalize();
                this.nightFactor = 0.0;

                if (this.sky && this.sky.material && this.sky.material.uniforms['sunPosition']) {
                    this.sky.material.uniforms['sunPosition'].value.copy(this.sunPosition);
                }

                this.timeElement = document.getElementById('stat-time-of-day');
                this.initSun();
                this.initMoon();
            }

            initSun() {
                const sunGeo = new THREE.SphereGeometry(18, 32, 32);
                const sunMat = new THREE.MeshBasicMaterial({ color: 0xfffae0, fog: false });
                this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
                this.scene.add(this.sunMesh);

                const glowMat = new THREE.SpriteMaterial({
                    map: ProceduralTextureFactory.createSunGlowTexture(),
                    color: 0xffe28a,
                    transparent: true,
                    opacity: 0.9,
                    depthWrite: false,
                    fog: false
                });
                const glowSprite = new THREE.Sprite(glowMat);
                glowSprite.scale.set(110, 110, 1);
                this.sunMesh.add(glowSprite);
            }

            initMoon() {
                const moonGeo = new THREE.SphereGeometry(16, 32, 32);
                const moonMat = new THREE.MeshBasicMaterial({
                    map: ProceduralTextureFactory.createMoonTexture(),
                    color: 0xffffff,
                    fog: false
                });
                this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
                this.scene.add(this.moonMesh);

                const haloMat = new THREE.SpriteMaterial({
                    map: ProceduralTextureFactory.createMoonHaloTexture(),
                    color: 0xd8e8ff,
                    transparent: true,
                    opacity: 0.85,
                    depthWrite: false,
                    fog: false
                });
                const haloSprite = new THREE.Sprite(haloMat);
                haloSprite.scale.set(85, 85, 1);
                this.moonMesh.add(haloSprite);
            }

            advanceTime(hrs) { this.time = (this.time + hrs) % 24.0; }
            changeSeason() { this.calendar.nextSeason(); }

            update(deltaTime, playerPosition) {
                this.time = (this.time + deltaTime * this.timeScale) % 24.0;
                this.sunPosition.copy(this.calendar.calculateSolarVector(this.time));
                this.moonPosition.set(-this.sunPosition.x, -this.sunPosition.y, -this.sunPosition.z).normalize();

                const pX = playerPosition ? playerPosition.x : 0;
                const pY = playerPosition ? playerPosition.y : 0;
                const pZ = playerPosition ? playerPosition.z : 0;

                const celestialDist = 480.0;
                if (this.sunMesh) {
                    this.sunMesh.position.set(
                        pX + this.sunPosition.x * celestialDist,
                        pY + this.sunPosition.y * celestialDist,
                        pZ + this.sunPosition.z * celestialDist
                    );
                    this.sunMesh.visible = this.sunPosition.y > -0.08;
                }

                if (this.moonMesh) {
                    this.moonMesh.position.set(
                        pX + this.moonPosition.x * celestialDist,
                        pY + this.moonPosition.y * celestialDist,
                        pZ + this.moonPosition.z * celestialDist
                    );
                    this.moonMesh.visible = this.moonPosition.y > -0.08;
                }

                if (this.sky && this.sky.material && this.sky.material.uniforms['sunPosition']) {
                    this.sky.material.uniforms['sunPosition'].value.copy(this.sunPosition);
                }

                const sunH = this.sunPosition.y;

                if (this.sunLight) {
                    // Компактные, мягкие и аккуратные короткие тени прямо под персонажем, NPC и авто (без длинных растянутых полос)
                    const lightElevation = 140.0;
                    const lightDistH = 10.0;
                    const normH = Math.hypot(this.sunPosition.x, this.sunPosition.z) || 1;
                    const normX = this.sunPosition.x / normH;
                    const normZ = this.sunPosition.z / normH;

                    // Строго вертикальный зенитный угол: свет падает строго перпендикулярно сверху вниз (0° наклона, тени строго под ногами и машинами)
                    this.sunLight.position.set(pX, pY + 140.0, pZ);
                    if (this.sunLight.target) {
                        this.sunLight.target.position.set(pX, pY, pZ);
                        this.sunLight.target.updateMatrixWorld();
                    }
                    if (this.sunLight.target) {
                        this.sunLight.target.position.set(pX, pY, pZ);
                        this.sunLight.target.updateMatrixWorld();
                    }
                }

                let nightFactor = sunH <= -0.15 ? 1.0 : (sunH < 0.15 ? (0.15 - sunH) / 0.30 : 0.0);
                this.nightFactor = nightFactor;

                if (this.streetLampManager) this.streetLampManager.updateNightLighting(nightFactor, playerPosition);
                if (this.houseBuilder) this.houseBuilder.updateNightLighting(nightFactor);
                if (this.orgBuildingBuilder) this.orgBuildingBuilder.updateNightLighting(nightFactor);

                // Плавная динамическая синхронизация цвета неба и тумана со временем суток
                const cDaySky = new THREE.Color(0x5c9ce6);
                const cSunsetSky = new THREE.Color(0xe67e22);
                const cTwilightSky = new THREE.Color(0x1e1b4b);
                const cNightSky = new THREE.Color(0x060914);

                const currentSkyColor = new THREE.Color();

                if (sunH > 0.15) {
                    this.sunLight.intensity = 2.0;
                    this.ambientLight.intensity = 0.55;
                    this.hemiLight.intensity = 0.65;
                    currentSkyColor.copy(cDaySky);
                } else if (sunH > 0.0) {
                    // Золотой час / предзакатный свет
                    const t = 1.0 - (sunH / 0.15);
                    this.sunLight.intensity = 2.0 * (1.0 - t * 0.4);
                    this.ambientLight.intensity = THREE.MathUtils.lerp(0.55, 0.4, t);
                    this.hemiLight.intensity = THREE.MathUtils.lerp(0.65, 0.5, t);
                    currentSkyColor.lerpColors(cDaySky, cSunsetSky, t);
                } else if (sunH > -0.15) {
                    // Закат / сумерки
                    const t = (-sunH / 0.15);
                    this.sunLight.intensity = 2.0 * 0.6 * (1.0 - t);
                    this.ambientLight.intensity = THREE.MathUtils.lerp(0.4, 0.25, t);
                    this.hemiLight.intensity = THREE.MathUtils.lerp(0.5, 0.35, t);
                    currentSkyColor.lerpColors(cSunsetSky, cTwilightSky, t);
                } else {
                    // Ночь
                    this.sunLight.intensity = 0.0;
                    this.ambientLight.intensity = 0.25;
                    this.hemiLight.intensity = 0.35;
                    currentSkyColor.copy(cNightSky);
                }

                if (this.scene.background) {
                    this.scene.background.copy(currentSkyColor);
                }
                if (this.scene.fog) {
                    this.scene.fog.color.copy(currentSkyColor);
                }

                const hrs = Math.floor(this.time);
                const mins = Math.floor((this.time - hrs) * 60);
                if (this.timeElement) this.timeElement.innerText = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} (Сутки)`;
            }
        }
