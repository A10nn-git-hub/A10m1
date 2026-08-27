/**
         * Система динамического дыма из выхлопных труб для всех автомобилей
         */
        class CarExhaustSmokeSystem {
            constructor(scene) {
                this.scene = scene;
                this.maxParticles = 32;
                this.spawnTimer = 0.0;

                const smokeTex = ProceduralTextureFactory.createSmokeTexture();
                this.material = new THREE.SpriteMaterial({
                    map: smokeTex,
                    transparent: true,
                    opacity: 0.0,
                    depthWrite: false,
                    blending: THREE.NormalBlending
                });

                this.pool = [];
                for (let i = 0; i < this.maxParticles; i++) {
                    const sprite = new THREE.Sprite(this.material.clone());
                    sprite.visible = false;
                    this.scene.add(sprite);
                    this.pool.push({
                        sprite: sprite,
                        active: false,
                        life: 0.0,
                        maxLife: 0.8,
                        pos: new THREE.Vector3(),
                        vel: new THREE.Vector3(),
                        scale: 0.18,
                        maxScale: 0.7,
                        baseOpacity: 0.35
                    });
                }
            }

            emit(origin, carBackDir, speedKmh, isAccelerating) {
                const p = this.pool.find(item => !item.active);
                if (!p) return;

                p.active = true;
                p.life = 0.0;
                p.maxLife = 0.65 + Math.random() * 0.4;
                p.scale = 0.16 + Math.random() * 0.08;
                p.maxScale = 0.65 + Math.random() * 0.35 + (speedKmh / 160.0) * 0.4;
                p.baseOpacity = isAccelerating ? 0.45 : 0.24;

                p.pos.copy(origin).add(new THREE.Vector3(
                    (Math.random() - 0.5) * 0.08,
                    (Math.random() - 0.5) * 0.06,
                    (Math.random() - 0.5) * 0.08
                ));

                const speedRatio = Math.min(speedKmh / 60.0, 1.5);
                p.vel.set(
                    carBackDir.x * (1.2 + speedRatio * 2.2) + (Math.random() - 0.5) * 0.35,
                    0.4 + Math.random() * 0.35,
                    carBackDir.z * (1.2 + speedRatio * 2.2) + (Math.random() - 0.5) * 0.35
                );

                p.sprite.position.copy(p.pos);
                p.sprite.scale.set(p.scale, p.scale, 1);
                p.sprite.material.opacity = p.baseOpacity;
                p.sprite.visible = true;
            }

            update(deltaTime, carWorldPos, carQuaternion, speedKmh, isAccelerating) {
                if (window.gameEngine && window.gameEngine.isPowerSavingMode) {
                    for (let i = 0; i < this.pool.length; i++) {
                        if (this.pool[i].active) {
                            this.pool[i].active = false;
                            this.pool[i].sprite.visible = false;
                        }
                    }
                    return;
                }

                const dt = Math.min(deltaTime, 0.1);

                // Генерация клубов дыма из левой и правой выхлопных труб
                this.spawnTimer += dt;
                const spawnInterval = isAccelerating ? 0.04 : 0.085;
                if (this.spawnTimer >= spawnInterval) {
                    this.spawnTimer = 0.0;

                    const backDir = new THREE.Vector3(0, 0, -1).applyQuaternion(carQuaternion);
                    const leftPipeLocal = new THREE.Vector3(-0.6, -0.1, -2.25).applyQuaternion(carQuaternion);
                    const rightPipeLocal = new THREE.Vector3(0.6, -0.1, -2.25).applyQuaternion(carQuaternion);

                    const leftPipeWorld = carWorldPos.clone().add(leftPipeLocal);
                    const rightPipeWorld = carWorldPos.clone().add(rightPipeLocal);

                    this.emit(leftPipeWorld, backDir, speedKmh, isAccelerating);
                    this.emit(rightPipeWorld, backDir, speedKmh, isAccelerating);
                }

                // Обновление физики и прозрачности клубов дыма
                for (let i = 0; i < this.pool.length; i++) {
                    const p = this.pool[i];
                    if (!p.active) continue;

                    p.life += dt;
                    const progress = p.life / p.maxLife;

                    if (progress >= 1.0) {
                        p.active = false;
                        p.sprite.visible = false;
                        continue;
                    }

                    p.pos.addScaledVector(p.vel, dt);
                    p.vel.y += dt * 0.12; // Легкий подъем теплого дыма вверх
                    p.vel.multiplyScalar(0.95);

                    const currentScale = THREE.MathUtils.lerp(p.scale, p.maxScale, Math.pow(progress, 0.7));
                    p.sprite.position.copy(p.pos);
                    p.sprite.scale.set(currentScale, currentScale, 1);

                    p.sprite.material.opacity = p.baseOpacity * (1.0 - progress);
                }
            }
        }

window.CarExhaustSmokeSystem = CarExhaustSmokeSystem;
