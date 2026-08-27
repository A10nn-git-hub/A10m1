/**
 * VehicleExplosionSystem - система прочности, деформации, возгорания и взрыва автомобилей
 */
class VehicleExplosionSystem {
    constructor(scene, world, vfxManager) {
        this.scene = scene;
        this.world = world;
        this.vfx = vfxManager;
        this.vehicleHealths = new Map(); // car -> { hp, maxHp, isDestroyed, smokeTimer }
        this.charredMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.95,
            metalness: 0.1
        });
    }

    registerCar(car, maxHp = 150) {
        if (!car) return;
        if (!this.vehicleHealths.has(car)) {
            this.vehicleHealths.set(car, {
                hp: maxHp,
                maxHp: maxHp,
                isDestroyed: false,
                isBurning: false,
                smokeTimer: 0
            });
        }
    }

    damageCar(car, amount, hitPoint, impulse) {
        if (!car) return;
        this.registerCar(car);
        const data = this.vehicleHealths.get(car);
        if (!data || data.isDestroyed) return;

        data.hp -= amount;

        // Искры в точке попадания
        if (hitPoint && this.vfx) {
            this.vfx.createImpactSparks(hitPoint);
        }

        if (data.hp <= 45 && !data.isBurning) {
            data.isBurning = true;
        }

        if (data.hp <= 0 && !data.isDestroyed) {
            this.explodeCar(car);
        }
    }

    explodeCar(car) {
        const data = this.vehicleHealths.get(car);
        if (!data || data.isDestroyed) return;
        data.isDestroyed = true;
        data.isBurning = false;
        data.hp = 0;

        const pos = car.chassisBody ? car.chassisBody.position : car.carGroup.position;
        const blastPos = new THREE.Vector3(pos.x, pos.y + 0.8, pos.z);

        // 1. Спецэффект взрыва
        if (this.vfx) {
            this.vfx.createExplosion(blastPos, 6.5);
        }

        // 2. Звук взрыва и мощная вибрация геймпада
        if (window.soundEngine && typeof window.soundEngine.playExplosion === 'function') {
            window.soundEngine.playExplosion();
        }
        if (window.gameEngine && window.gameEngine.gamepadController) {
            window.gameEngine.gamepadController.vibrate(450, 1.0, 0.9);
        }

        // 3. Подбрасывание и вращение корпуса автомобиля в физике Cannon.js
        if (car.chassisBody) {
            car.chassisBody.velocity.set(
                (Math.random() - 0.5) * 6.0,
                8.5 + Math.random() * 4.0,
                (Math.random() - 0.5) * 6.0
            );
            car.chassisBody.angularVelocity.set(
                (Math.random() - 0.5) * 8.0,
                (Math.random() - 0.5) * 4.0,
                (Math.random() - 0.5) * 8.0
            );
        }

        // 4. Обугливание текстуры корпуса машины
        if (car.carGroup) {
            car.carGroup.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (!child.name || !child.name.includes('wheel')) {
                        child.material = this.charredMaterial;
                    }
                }
            });
        }

        // 5. Высадка игрока, если он был внутри
        if (window.gameEngine && window.gameEngine.vehicleManager) {
            if (window.gameEngine.vehicleManager.activeDrivenCar === car) {
                window.gameEngine.vehicleManager.forceEjectPlayer(window.gameEngine.player);
                if (window.gameEngine.playerController) {
                    window.gameEngine.playerController.takeDamage(60);
                }
            }
        }

        // 6. Урон по близлежащим объектам и людям
        this.applyAreaDamage(blastPos, 7.5, 90);
    }

    applyAreaDamage(center, radius, maxDamage) {
        // Урон по игроку
        if (window.gameEngine && window.gameEngine.player && window.gameEngine.player.body) {
            const pPos = window.gameEngine.player.body.position;
            const dist = center.distanceTo(new THREE.Vector3(pPos.x, pPos.y, pPos.z));
            if (dist < radius) {
                const dmg = Math.round(maxDamage * (1.0 - dist / radius));
                if (window.gameEngine.playerController) {
                    window.gameEngine.playerController.takeDamage(dmg);
                }
            }
        }

        // Урон по пешеходам
        if (window.gameEngine && window.gameEngine.pedestrianManager && window.gameEngine.pedestrianManager.pedestrians) {
            const peds = window.gameEngine.pedestrianManager.pedestrians;
            for (let i = 0; i < peds.length; i++) {
                const npc = peds[i];
                if (!npc.body) continue;
                const dist = center.distanceTo(new THREE.Vector3(npc.body.position.x, npc.body.position.y, npc.body.position.z));
                if (dist < radius) {
                    const blastDir = new THREE.Vector3().subVectors(npc.body.position, center).normalize();
                    npc.body.velocity.x += blastDir.x * 12.0;
                    npc.body.velocity.y += 6.5;
                    npc.body.velocity.z += blastDir.z * 12.0;
                    if (typeof npc.takeDamage === 'function') {
                        npc.takeDamage(100);
                    } else {
                        npc.knockedDownTimer = 5.0;
                        npc.state = 'KNOCKED_DOWN';
                    }
                }
            }
        }
    }

    update(deltaTime, allCars) {
        if (!allCars) return;
        const dt = Math.min(deltaTime, 0.1);

        for (let i = 0; i < allCars.length; i++) {
            const car = allCars[i];
            this.registerCar(car);
            const data = this.vehicleHealths.get(car);
            if (!data) continue;

            if (data.isBurning && !data.isDestroyed) {
                data.smokeTimer += dt;
                if (data.smokeTimer >= 0.08) {
                    data.smokeTimer = 0;
                    if (this.vfx && car.chassisBody) {
                        const p = car.chassisBody.position;
                        this.vfx.createRocketSmoke(new THREE.Vector3(p.x, p.y + 0.9, p.z));
                    }
                }
            }
        }
    }
}
window.VehicleExplosionSystem = VehicleExplosionSystem;
