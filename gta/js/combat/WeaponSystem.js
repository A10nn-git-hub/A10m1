/**
 * WeaponSystem - система вооружения, баллистики, процедурных 3D-моделей оружия и инвентаря
 */
class WeaponSystem {
    constructor(scene, camera, player, vfxManager, explosionSystem) {
        this.scene = scene;
        this.camera = camera;
        this.player = player;
        this.vfx = vfxManager;
        this.explosionSystem = explosionSystem;

        this.weapons = [
            { id: 'FISTS', name: 'Кулаки', icon: '🥊', damage: 30, range: 2.5, fireRate: 0.4, ammo: Infinity, maxAmmo: Infinity, isAuto: false, model: null },
            { id: 'PISTOL', name: 'Pistol 9mm', icon: '🔫', damage: 38, range: 75, fireRate: 0.22, ammo: 120, maxAmmo: 300, isAuto: false, model: null },
            { id: 'SMG', name: 'Micro SMG', icon: '⚡', damage: 24, range: 60, fireRate: 0.09, ammo: 240, maxAmmo: 600, isAuto: true, model: null },
            { id: 'SHOTGUN', name: 'Pump Shotgun', icon: '💥', damage: 18, pellets: 6, range: 32, fireRate: 0.75, ammo: 48, maxAmmo: 120, isAuto: false, model: null },
            { id: 'RPG', name: 'RPG-7', icon: '🚀', damage: 300, range: 140, fireRate: 1.5, ammo: 12, maxAmmo: 30, isAuto: false, model: null }
        ];

        this.currentWeaponIndex = 1; // По умолчанию Пистолет
        this.fireCooldown = 0.0;
        this.isAiming = false;
        this.isFiring = false;
        this.rockets = [];

        this.raycaster = new THREE.Raycaster();
        this.weaponContainer = new THREE.Group();

        this.buildProceduralWeaponMeshes();
        this.attachWeaponToHand();
        this.initHUD();
        this.updateHUD();
    }

    buildProceduralWeaponMeshes() {
        const gunMetalMat = new THREE.MeshStandardMaterial({ color: 0x1f2428, roughness: 0.35, metalness: 0.85 });
        const gunGripMat = new THREE.MeshStandardMaterial({ color: 0x3d271d, roughness: 0.8, metalness: 0.1 });
        const oliveMat = new THREE.MeshStandardMaterial({ color: 0x3c4826, roughness: 0.7, metalness: 0.2 });
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xcc9900, roughness: 0.3, metalness: 0.9 });

        // 1. Pistol
        const pistolGroup = new THREE.Group();
        const slide = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.32), gunMetalMat);
        slide.position.set(0, 0.06, -0.06);
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.1), gunGripMat);
        grip.position.set(0, -0.05, 0.04);
        grip.rotation.x = -0.25;
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8), gunMetalMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.06, -0.23);
        pistolGroup.add(slide, grip, barrel);
        pistolGroup.scale.setScalar(1.2);
        this.weapons[1].model = pistolGroup;

        // 2. SMG
        const smgGroup = new THREE.Group();
        const smgBody = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.45), gunMetalMat);
        const smgMag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.08), gunMetalMat);
        smgMag.position.set(0, -0.16, -0.05);
        smgMag.rotation.x = 0.15;
        const smgGrip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.09), gunGripMat);
        smgGrip.position.set(0, -0.08, 0.12);
        smgGrip.rotation.x = -0.2;
        const smgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 8), gunMetalMat);
        smgBarrel.rotation.x = Math.PI / 2;
        smgBarrel.position.set(0, 0.03, -0.3);
        smgGroup.add(smgBody, smgMag, smgGrip, smgBarrel);
        smgGroup.scale.setScalar(1.2);
        this.weapons[2].model = smgGroup;

        // 3. Shotgun
        const shotGroup = new THREE.Group();
        const shotBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.85, 8), gunMetalMat);
        shotBarrel.rotation.x = Math.PI / 2;
        shotBarrel.position.set(0, 0.04, -0.25);
        const shotPump = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.28, 8), gunGripMat);
        shotPump.rotation.x = Math.PI / 2;
        shotPump.position.set(0, 0.01, -0.3);
        const shotStock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.42), gunGripMat);
        shotStock.position.set(0, -0.04, 0.25);
        shotStock.rotation.x = -0.12;
        shotGroup.add(shotBarrel, shotPump, shotStock);
        shotGroup.scale.setScalar(1.1);
        this.weapons[3].model = shotGroup;

        // 4. RPG
        const rpgGroup = new THREE.Group();
        const rpgTube = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.25, 12), oliveMat);
        rpgTube.rotation.x = Math.PI / 2;
        const rpgGrip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.1), gunMetalMat);
        rpgGrip.position.set(0, -0.14, 0.1);
        const rpgWarhead = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 8), goldMat);
        rpgWarhead.rotation.x = -Math.PI / 2;
        rpgWarhead.position.set(0, 0, -0.75);
        rpgGroup.add(rpgTube, rpgGrip, rpgWarhead);
        rpgGroup.scale.setScalar(1.1);
        this.weapons[4].model = rpgGroup;
    }

    attachWeaponToHand() {
        if (this.player && this.player.limbs && this.player.limbs.rightArm && this.player.limbs.rightArm.forearm) {
            this.player.limbs.rightArm.forearm.add(this.weaponContainer);
            this.weaponContainer.position.set(0, -0.38, -0.05);
            this.weaponContainer.rotation.set(Math.PI / 2, 0, -Math.PI / 2);
        }
    }

    initHUD() {
        let hud = document.getElementById('weapon-hud');
        if (!hud) {
            hud = document.createElement('div');
            hud.id = 'weapon-hud';
            hud.className = 'weapon-hud';
            hud.innerHTML = `
                <div class="weapon-icon" id="weapon-icon">🔫</div>
                <div class="weapon-info">
                    <div class="weapon-name" id="weapon-name">Pistol 9mm</div>
                    <div class="weapon-ammo" id="weapon-ammo">120</div>
                </div>
            `;
            const uiLayer = document.getElementById('ui-layer') || document.body;
            uiLayer.appendChild(hud);
        }
    }

    updateHUD() {
        const cur = this.weapons[this.currentWeaponIndex];
        const iconEl = document.getElementById('weapon-icon');
        const nameEl = document.getElementById('weapon-name');
        const ammoEl = document.getElementById('weapon-ammo');

        if (iconEl) iconEl.innerText = cur.icon;
        if (nameEl) nameEl.innerText = cur.name;
        if (ammoEl) ammoEl.innerText = (cur.ammo === Infinity) ? '∞' : cur.ammo;

        // Обновление 3D-модели в руке
        while (this.weaponContainer.children.length > 0) {
            this.weaponContainer.remove(this.weaponContainer.children[0]);
        }

        if (cur.model) {
            this.weaponContainer.add(cur.model);
            this.weaponContainer.visible = true;
        } else {
            this.weaponContainer.visible = false;
        }
    }

    selectWeapon(index) {
        if (index < 0 || index >= this.weapons.length) return;
        this.currentWeaponIndex = index;
        this.updateHUD();
    }

    nextWeapon() {
        this.currentWeaponIndex = (this.currentWeaponIndex + 1) % this.weapons.length;
        this.updateHUD();
    }

    prevWeapon() {
        this.currentWeaponIndex = (this.currentWeaponIndex - 1 + this.weapons.length) % this.weapons.length;
        this.updateHUD();
    }

    addAmmo(weaponId, amount) {
        const w = this.weapons.find(item => item.id === weaponId);
        if (w && w.ammo !== Infinity) {
            w.ammo = Math.min(w.maxAmmo, w.ammo + amount);
            this.updateHUD();
        }
    }

    fire() {
        if (this.fireCooldown > 0) return;
        const cur = this.weapons[this.currentWeaponIndex];
        if (cur.ammo !== Infinity && cur.ammo <= 0) return;

        if (cur.ammo !== Infinity) {
            cur.ammo--;
            this.updateHUD();
        }

        this.fireCooldown = cur.fireRate;

        // 1. Воспроизведение звука выстрела
        if (window.soundEngine && typeof window.soundEngine.playGunshot === 'function') {
            window.soundEngine.playGunshot(cur.id);
        }

        // 2. Оповещение системы розыска о стрельбе
        if (window.gameEngine && window.gameEngine.wantedManager) {
            window.gameEngine.wantedManager.reportCrime(cur.id === 'FISTS' ? 'PUNCH' : 'GUNFIRE');
        }

        const isDriving = (window.gameEngine && window.gameEngine.vehicleManager && window.gameEngine.vehicleManager.activeDrivenCar !== null);
        const playerPos = (this.player && this.player.body) ? this.player.body.position : this.camera.position;

        // Позиция ствола оружия
        const shootOrigin = new THREE.Vector3();
        if (this.weaponContainer && this.weaponContainer.visible) {
            this.weaponContainer.getWorldPosition(shootOrigin);
        } else {
            shootOrigin.set(playerPos.x, playerPos.y + 0.8, playerPos.z);
        }

        // Направление стрельбы (по прицелу камеры)
        const shootDir = new THREE.Vector3();
        this.camera.getWorldDirection(shootDir);

        // 3. Вспышка выстрела и тактильная вибрация геймпада
        if (cur.id !== 'FISTS' && this.vfx) {
            this.vfx.createMuzzleFlash(shootOrigin, shootDir);
        }

        if (window.gameEngine && window.gameEngine.gamepadController) {
            const strong = cur.id === 'RPG' ? 1.0 : (cur.id === 'SHOTGUN' ? 0.85 : (cur.id === 'FISTS' ? 0.35 : 0.45));
            const dur = cur.id === 'RPG' ? 320 : (cur.id === 'SHOTGUN' ? 200 : 90);
            window.gameEngine.gamepadController.vibrate(dur, strong, strong * 0.75);
        }

        // 4. Поведение по типам оружия
        if (cur.id === 'FISTS') {
            this.performMeleeAttack(shootOrigin, shootDir, cur.damage);
        } else if (cur.id === 'RPG') {
            this.launchRocket(shootOrigin, shootDir, cur.damage);
        } else if (cur.id === 'SHOTGUN') {
            for (let i = 0; i < (cur.pellets || 6); i++) {
                const spreadDir = shootDir.clone().add(new THREE.Vector3(
                    (Math.random() - 0.5) * 0.12,
                    (Math.random() - 0.5) * 0.12,
                    (Math.random() - 0.5) * 0.12
                )).normalize();
                this.performRaycastShot(shootOrigin, spreadDir, cur.damage, cur.range);
            }
        } else {
            // Pistol & SMG
            const spread = (cur.id === 'SMG') ? 0.04 : 0.01;
            const spreadDir = shootDir.clone().add(new THREE.Vector3(
                (Math.random() - 0.5) * spread,
                (Math.random() - 0.5) * spread,
                (Math.random() - 0.5) * spread
            )).normalize();
            this.performRaycastShot(shootOrigin, spreadDir, cur.damage, cur.range);
        }
    }

    performMeleeAttack(origin, dir, damage) {
        const attackRange = 2.4;
        const peds = (window.gameEngine && window.gameEngine.pedestrianManager) ? window.gameEngine.pedestrianManager.pedestrians : [];

        for (let i = 0; i < peds.length; i++) {
            const npc = peds[i];
            if (!npc.body) continue;
            const dist = origin.distanceTo(new THREE.Vector3(npc.body.position.x, npc.body.position.y, npc.body.position.z));
            if (dist < attackRange) {
                npc.body.velocity.x += dir.x * 6.0;
                npc.body.velocity.y += 2.0;
                npc.body.velocity.z += dir.z * 6.0;

                if (typeof npc.takeDamage === 'function') {
                    npc.takeDamage(damage);
                } else {
                    npc.knockedDownTimer = 3.5;
                    npc.state = 'KNOCKED_DOWN';
                }

                if (this.vfx) this.vfx.triggerHitMarker();
                break;
            }
        }
    }

    performRaycastShot(origin, dir, damage, maxRange) {
        this.raycaster.set(origin, dir);
        this.raycaster.far = maxRange;

        const hitTargets = [];

        // 1. Проверка пешеходов
        const peds = (window.gameEngine && window.gameEngine.pedestrianManager) ? window.gameEngine.pedestrianManager.pedestrians : [];
        for (let i = 0; i < peds.length; i++) {
            const npc = peds[i];
            if (npc.group) {
                npc.group.traverse((c) => {
                    if (c.isMesh) {
                        c.userData.npcRef = npc;
                        hitTargets.push(c);
                    }
                });
            }
        }

        // 2. Проверка машин
        const cars = (window.gameEngine && window.gameEngine.vehicleManager) ? window.gameEngine.vehicleManager.cars : [];
        for (let i = 0; i < cars.length; i++) {
            const car = cars[i];
            if (car.carGroup) {
                car.carGroup.traverse((c) => {
                    if (c.isMesh) {
                        c.userData.carRef = car;
                        hitTargets.push(c);
                    }
                });
            }
        }

        const intersects = this.raycaster.intersectObjects(hitTargets, false);
        let endPoint = origin.clone().addScaledVector(dir, maxRange);

        if (intersects.length > 0) {
            const hit = intersects[0];
            endPoint = hit.point;

            if (hit.object.userData.npcRef) {
                const npc = hit.object.userData.npcRef;
                if (typeof npc.takeDamage === 'function') {
                    npc.takeDamage(damage);
                } else {
                    npc.knockedDownTimer = 4.0;
                    npc.state = 'KNOCKED_DOWN';
                }
                if (this.vfx) this.vfx.triggerHitMarker();
            } else if (hit.object.userData.carRef) {
                const car = hit.object.userData.carRef;
                if (this.explosionSystem) {
                    this.explosionSystem.damageCar(car, damage, hit.point);
                }
                if (this.vfx) this.vfx.triggerHitMarker();
            }
        }

        // Трассер пули
        if (this.vfx) {
            this.vfx.createBulletTracer(origin, endPoint);
            if (intersects.length > 0) {
                this.vfx.createImpactSparks(endPoint, intersects[0].face ? intersects[0].face.normal : null);
            }
        }
    }

    launchRocket(origin, dir, damage) {
        const rocketGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8);
        rocketGeo.rotateX(Math.PI / 2);
        const rocketMat = new THREE.MeshBasicMaterial({ color: 0xcc9900 });
        const rocketMesh = new THREE.Mesh(rocketGeo, rocketMat);
        rocketMesh.position.copy(origin);
        rocketMesh.lookAt(origin.clone().add(dir));
        this.scene.add(rocketMesh);

        this.rockets.push({
            mesh: rocketMesh,
            dir: dir.normalize(),
            speed: 55.0,
            life: 3.5,
            damage
        });
    }

    update(deltaTime) {
        const dt = Math.min(deltaTime, 0.1);
        if (this.fireCooldown > 0) {
            this.fireCooldown -= dt;
        }

        // Автострельба для SMG
        const cur = this.weapons[this.currentWeaponIndex];
        if (this.isFiring && cur.isAuto && this.fireCooldown <= 0) {
            this.fire();
        }

        // Полет ракет RPG
        for (let i = this.rockets.length - 1; i >= 0; i--) {
            const r = this.rockets[i];
            r.life -= dt;
            r.mesh.position.addScaledVector(r.dir, r.speed * dt);

            if (this.vfx) {
                this.vfx.createRocketSmoke(r.mesh.position);
            }

            // Проверка столкновения ракеты с поверхностью или авто
            const hitPos = r.mesh.position.clone();
            const groundY = (window.gameEngine && window.gameEngine.terrainManager)
                ? window.gameEngine.terrainManager.getTerrainHeight(hitPos.x, hitPos.z)
                : 0.0;

            if (hitPos.y <= groundY + 0.2 || r.life <= 0) {
                if (this.explosionSystem) {
                    this.explosionSystem.applyAreaDamage(hitPos, 9.0, r.damage);
                }
                if (this.vfx) {
                    this.vfx.createExplosion(hitPos, 7.5);
                }
                if (window.soundEngine && typeof window.soundEngine.playExplosion === 'function') {
                    window.soundEngine.playExplosion();
                }

                this.scene.remove(r.mesh);
                this.rockets.splice(i, 1);
            }
        }
    }
}
window.WeaponSystem = WeaponSystem;
