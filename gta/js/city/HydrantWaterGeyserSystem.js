/**
         * STEP 37: Система водяных гейзеров высокого давления при сбивании пожарных гидрантов
         */
        class HydrantWaterGeyserSystem {
            constructor(scene) {
                this.scene = scene;
                this.geysers = [];
                this.maxParticlesPerGeyser = 75;

                const waterDropTex = ProceduralTextureFactory.createSmokeTexture();
                this.material = new THREE.SpriteMaterial({
                    map: waterDropTex,
                    color: 0x93c5fd,
                    transparent: true,
                    opacity: 0.7,
                    depthWrite: false,
                    blending: THREE.AdditiveBlending
                });
            }

            addGeyser(posX, posY, posZ) {
                const particles = [];
                for (let i = 0; i < this.maxParticlesPerGeyser; i++) {
                    const sprite = new THREE.Sprite(this.material.clone());
                    sprite.scale.set(0.3, 0.3, 1);
                    sprite.position.set(posX, posY, posZ);
                    this.scene.add(sprite);

                    particles.push({
                        sprite: sprite,
                        life: Math.random() * 1.1,
                        maxLife: 1.1 + Math.random() * 0.45,
                        origin: new THREE.Vector3(posX, posY, posZ),
                        pos: new THREE.Vector3(posX, posY, posZ),
                        vel: new THREE.Vector3(
                            (Math.random() - 0.5) * 1.6,
                            7.2 + Math.random() * 3.8, // Мощная струя воды вверх 7 - 11 м/с
                            (Math.random() - 0.5) * 1.6
                        ),
                        scale: 0.28 + Math.random() * 0.15
                    });
                }

                this.geysers.push({
                    pos: new THREE.Vector3(posX, posY, posZ),
                    particles: particles,
                    active: true,
                    soundTimer: 0.0
                });

                if (window.soundEngine) {
                    window.soundEngine.playWaterSprayBurst(posX, posY, posZ);
                }
            }

            update(deltaTime) {
                const dt = Math.min(deltaTime, 0.05);

                for (let g = 0; g < this.geysers.length; g++) {
                    const geyser = this.geysers[g];
                    if (!geyser.active) continue;

                    geyser.soundTimer += dt;
                    if (geyser.soundTimer >= 0.35) {
                        geyser.soundTimer = 0.0;
                        if (window.soundEngine) {
                            window.soundEngine.playWaterSprayBurst(geyser.pos.x, geyser.pos.y, geyser.pos.z);
                        }
                    }

                    for (let i = 0; i < geyser.particles.length; i++) {
                        const p = geyser.particles[i];
                        p.life += dt;
                        if (p.life >= p.maxLife) {
                            p.life = 0;
                            p.pos.copy(geyser.origin).add(new THREE.Vector3((Math.random() - 0.5) * 0.2, 0, (Math.random() - 0.5) * 0.2));
                            p.vel.set(
                                (Math.random() - 0.5) * 1.6,
                                7.5 + Math.random() * 3.2,
                                (Math.random() - 0.5) * 1.6
                            );
                        }

                        p.pos.x += p.vel.x * dt;
                        p.pos.y += p.vel.y * dt;
                        p.pos.z += p.vel.z * dt;
                        p.vel.y -= 13.0 * dt; // Гравитация воды

                        const progress = p.life / p.maxLife;
                        const curScale = THREE.MathUtils.lerp(p.scale, p.scale * 3.4, progress);
                        p.sprite.position.copy(p.pos);
                        p.sprite.scale.set(curScale, curScale, 1);
                        p.sprite.material.opacity = Math.sin(progress * Math.PI) * 0.7;
                    }
                }
            }
        }

window.HydrantWaterGeyserSystem = HydrantWaterGeyserSystem;
