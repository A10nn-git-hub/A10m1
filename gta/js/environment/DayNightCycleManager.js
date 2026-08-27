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
                this._lastTimeStr = '';
                this._cDaySky = new THREE.Color(0x5c9ce6);
                this._cSunsetSky = new THREE.Color(0xe67e22);
                this._cTwilightSky = new THREE.Color(0x1e1b4b);
                this._cNightSky = new THREE.Color(0x060914);
                this._currentSkyColor = new THREE.Color();

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
                const moonGeo = new THREE.SphereGeometry(14, 24, 24);
                const moonMat = new THREE.MeshBasicMaterial({ color: 0xe0e7ff, fog: false });
                this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
                this.scene.add(this.moonMesh);

                const glowMat = new THREE.SpriteMaterial({
                    map: ProceduralTextureFactory.createSunGlowTexture(),
                    color: 0x93c5fd,
                    transparent: true,
                    opacity: 0.65,
                    depthWrite: false,
                    fog: false
                });
                const glowSprite = new THREE.Sprite(glowMat);
                glowSprite.scale.set(80, 80, 1);
                this.moonMesh.add(glowSprite);
            }

            advanceTime(hours) {
                this.time = (this.time + hours) % 24;
                this.update(0.01);
            }
            changeSeason() { this.calendar.nextSeason(); }

            update(deltaTime, playerPosition) {
                this.time = (this.time + deltaTime * this.timeScale) % 24;
                this.sunPosition = this.calendar.calculateSolarVector(this.time);
                this.moonPosition.set(-this.sunPosition.x, -this.sunPosition.y, -this.sunPosition.z).normalize();

                const sunH = this.sunPosition.y;

                if (this.sky && this.sky.material && this.sky.material.uniforms['sunPosition']) {
                    this.sky.material.uniforms['sunPosition'].value.copy(this.sunPosition);
                }

                const celestialDist = 650.0;
                const camPos = playerPosition || (window.gameEngine && window.gameEngine.camera ? window.gameEngine.camera.position : new THREE.Vector3());
                
                if (this.sunMesh) {
                    this.sunMesh.position.set(
                        camPos.x + this.sunPosition.x * celestialDist,
                        camPos.y + this.sunPosition.y * celestialDist,
                        camPos.z + this.sunPosition.z * celestialDist
                    );
                    this.sunMesh.visible = sunH > -0.2;
                }

                if (this.moonMesh) {
                    this.moonMesh.position.set(
                        camPos.x + this.moonPosition.x * celestialDist,
                        camPos.y + this.moonPosition.y * celestialDist,
                        camPos.z + this.moonPosition.z * celestialDist
                    );
                    this.moonMesh.visible = sunH < 0.2;
                }

                if (this.sunLight) {
                    this.sunLight.position.set(
                        camPos.x + this.sunPosition.x * 120,
                        camPos.y + Math.max(10, this.sunPosition.y * 120),
                        camPos.z + this.sunPosition.z * 120
                    );
                    if (this.sunLight.target) {
                        this.sunLight.target.position.copy(camPos);
                        this.sunLight.target.updateMatrixWorld();
                    }
                }

                let nightFactor = sunH <= -0.15 ? 1.0 : (sunH < 0.15 ? (0.15 - sunH) / 0.30 : 0.0);
                this.nightFactor = nightFactor;

                if (this.streetLampManager) this.streetLampManager.updateNightLighting(nightFactor, playerPosition);
                if (this.houseBuilder) this.houseBuilder.updateNightLighting(nightFactor);
                if (this.orgBuildingBuilder) this.orgBuildingBuilder.updateNightLighting(nightFactor);

                const cDaySky = this._cDaySky;
                const cSunsetSky = this._cSunsetSky;
                const cTwilightSky = this._cTwilightSky;
                const cNightSky = this._cNightSky;
                const currentSkyColor = this._currentSkyColor;

                if (sunH > 0.15) {
                    this.sunLight.intensity = 2.0;
                    this.ambientLight.intensity = 0.55;
                    this.hemiLight.intensity = 0.65;
                    currentSkyColor.copy(cDaySky);
                } else if (sunH > 0.0) {
                    const t = 1.0 - (sunH / 0.15);
                    this.sunLight.intensity = 2.0 * (1.0 - t * 0.4);
                    this.ambientLight.intensity = THREE.MathUtils.lerp(0.55, 0.4, t);
                    this.hemiLight.intensity = THREE.MathUtils.lerp(0.65, 0.5, t);
                    currentSkyColor.lerpColors(cDaySky, cSunsetSky, t);
                } else if (sunH > -0.15) {
                    const t = (-sunH / 0.15);
                    this.sunLight.intensity = 2.0 * 0.6 * (1.0 - t);
                    this.ambientLight.intensity = THREE.MathUtils.lerp(0.4, 0.25, t);
                    this.hemiLight.intensity = THREE.MathUtils.lerp(0.5, 0.35, t);
                    currentSkyColor.lerpColors(cSunsetSky, cTwilightSky, t);
                } else {
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
                const timeStr = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} (Сутки)`;
                if (this.timeElement && this._lastTimeStr !== timeStr) {
                    this._lastTimeStr = timeStr;
                    this.timeElement.innerText = timeStr;
                }
            }
        }

window.DayNightCycleManager = DayNightCycleManager;
